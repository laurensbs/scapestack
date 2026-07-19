package app.scapestack.runelite;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.FixMethodOrder;
import org.junit.Test;
import org.junit.runners.MethodSorters;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static org.junit.Assert.*;

/**
 * Volledige end-to-end smoketest: voert de exacte HTTP-flow uit die de
 * RuneLite plugin doet, tegen de live Next.js dev-server op
 * http://localhost:4173. De server praat met een geisoleerde Neon-branch.
 *
 * Voorwaarden:
 *   - dev-server draait (npm run dev)
 *   - SCAPESTACK_E2E_DATABASE_URL wijst naar een tijdelijke Neon-branch
 *   - SCAPESTACK_E2E_RSN is een echte Hiscores-naam
 *   - Hiscores bereikbaar (gebruikt 'Lynx Titan' — bestaat altijd)
 *
 * Draait alleen via de expliciete `pluginE2e` Gradle-task. Ontbrekende
 * voorwaarden falen hard; ze worden nooit als groene skip verborgen.
 *
 * De assertions verifieren de volledige threat model:
 *   1. Eerste claim slaagt (200)
 *   2. Sync zonder token wordt geweigerd (401)
 *   3. Sync met andere token wordt geweigerd (403)
 *   4. Sync met juiste token slaagt + receipt, status en opslag kloppen
 *   5. Rival-install kan dezelfde RSN niet stelen (409)
 *   6. Idempotent re-claim met zelfde token werkt
 *   7. InstallToken in-memory store gedraagt zich identiek aan
 *      ConfigManager-pad (cache hit, cache miss, claim memo)
 */
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class EndToEndSmokeTest {

    private static String base;
    private static String rsn;
    private static String dbUrl;
    // Uniek per run; het formaat voldoet aan [A-Za-z0-9-_.~]{16,200}.
    private static final String TEST_TOKEN = "e2e-test-" + UUID.randomUUID();
    private static final String OTHER_TOKEN = "e2e-rival-" + UUID.randomUUID();

    private static final OkHttpClient http = new OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .build();
    private static final MediaType JSON = MediaType.parse("application/json");

    @BeforeClass
    public static void requireServer() throws Exception {
        base = requiredProperty("SCAPESTACK_E2E_BASE_URL").replaceAll("/+$", "");
        rsn = requiredProperty("SCAPESTACK_E2E_RSN");
        dbUrl = requiredProperty("SCAPESTACK_E2E_DATABASE_URL");
        assertTrue("E2E-server niet bereikbaar op " + base, serverReachable());
        deleteTestIdentity();
    }

    /** Converteert Neon's postgresql://user:pass@host/db?sslmode=...
     *  naar JDBC's jdbc:postgresql://host/db?sslmode=... + properties. */
    static String toJdbcUrl(String connStr) {
        URI uri = URI.create(connStr);
        StringBuilder sb = new StringBuilder("jdbc:postgresql://");
        sb.append(uri.getHost());
        if (uri.getPort() != -1) sb.append(':').append(uri.getPort());
        sb.append(uri.getPath());
        if (uri.getQuery() != null) {
            // Filter alleen JDBC-bekende params door; channel_binding is
            // pg-libpq-specifiek en wordt niet door de JDBC driver herkend.
            StringBuilder qs = new StringBuilder();
            for (String pair : uri.getQuery().split("&")) {
                if (pair.startsWith("sslmode=")) {
                    if (qs.length() > 0) qs.append('&');
                    qs.append(pair);
                }
            }
            if (qs.length() > 0) sb.append('?').append(qs);
        }
        return sb.toString();
    }

    static Properties jdbcProps(String connStr) {
        URI uri = URI.create(connStr);
        Properties props = new Properties();
        if (uri.getUserInfo() != null) {
            String[] up = uri.getUserInfo().split(":", 2);
            props.setProperty("user", up[0]);
            if (up.length > 1) props.setProperty("password", up[1]);
        }
        return props;
    }

    @AfterClass
    public static void cleanup() throws Exception {
        if (dbUrl != null && rsn != null) deleteTestIdentity();
    }

    // ---------- 1) eerste claim ----------

    @Test
    public void testA_firstClaimSucceeds() throws IOException {
        Result r = postJson(base + "/api/sync/claim",
            "{\"rsn\":\"" + rsn + "\"}",
            "Bearer " + TEST_TOKEN);
        // BeforeClass heeft de claim opgeruimd, dus dit is altijd eerste keer.
        assertEquals("Eerste claim moet 200 zijn. body=" + r.body, 200, r.status);
        assertTrue("body moet ok:true bevatten", r.body.contains("\"ok\":true"));
    }

    // ---------- 2) sync zonder token wordt geweigerd ----------

    @Test
    public void testB_syncWithoutTokenIs401() throws IOException {
        Result r = postJson(base + "/api/sync",
            "{\"rsn\":\"" + rsn + "\",\"questsCompleted\":[],\"diariesCompleted\":[],\"collectionLogItemIds\":[]}",
            null);
        assertEquals("Geen token → 401. body=" + r.body, 401, r.status);
    }

    // ---------- 3) sync met verkeerde token → 403 ----------

    @Test
    public void testC_syncWithWrongTokenIs403() throws IOException {
        Result r = postJson(base + "/api/sync",
            "{\"rsn\":\"" + rsn + "\",\"questsCompleted\":[],\"diariesCompleted\":[],\"collectionLogItemIds\":[]}",
            "Bearer " + OTHER_TOKEN);
        assertEquals("Verkeerde token → 403. body=" + r.body, 403, r.status);
    }

    // ---------- 4) volledige sync via plugin-pad ----------

    @Test
    public void testD_fullSyncRoundTrip() throws Exception {
        // Gebruik dezelfde v3-serializerfixture als de echte plugin. Alleen
        // identiteit en versie worden voor deze geisoleerde run aangepast.
        JsonObject body = SyncPayloadFixtureWriter.fixturePayload();
        body.addProperty("rsn", rsn);
        body.addProperty("displayName", rsn);

        Result r = postJson(base + "/api/sync", body.toString(),
            "Bearer " + TEST_TOKEN);
        assertEquals("Volledige sync moet 200 zijn. body=" + r.body, 200, r.status);
        JsonObject response = parseObject(r.body);
        JsonObject accepted = response.getAsJsonObject("accepted");
        assertNotNull("Een HTTP 200 zonder accepted receipt telt niet", accepted);
        assertEquals(3, accepted.get("contractVersion").getAsInt());
        assertEquals("0.3.0", accepted.get("pluginVersion").getAsString());
        assertEquals(rsn.toLowerCase(), accepted.getAsJsonObject("claim").get("rsn").getAsString());
        assertEquals("verified", accepted.getAsJsonObject("claim").get("status").getAsString());
        assertFalse("accepted sync time ontbreekt", accepted.get("syncedAt").getAsString().isBlank());

        JsonObject acceptedCoverage = accepted.getAsJsonObject("coverage");
        for (String domain : PluginSnapshotContract.DOMAINS) {
            assertEquals(domain + " moet eerlijk als available terugkomen voor de volledige fixture",
                "available", acceptedCoverage.getAsJsonObject(domain).get("state").getAsString());
        }

        JsonObject counts = response.getAsJsonObject("counts");
        assertEquals(2, counts.get("quests").getAsInt());
        assertEquals(2, counts.get("skills").getAsInt());
        assertEquals(1, counts.get("diaries").getAsInt());
        assertEquals(3, counts.get("collectionLogItems").getAsInt());
        assertEquals(2, counts.get("bankItems").getAsInt());

        assertPersistedSnapshot(accepted);
        assertPublicReadback(accepted);
    }

    // ---------- 5) rival-install kan RSN niet stelen ----------

    @Test
    public void testE_rivalClaimIs409() throws IOException {
        Result r = postJson(base + "/api/sync/claim",
            "{\"rsn\":\"" + rsn + "\"}",
            "Bearer " + OTHER_TOKEN);
        assertEquals("Rival token op zelfde RSN → 409. body=" + r.body, 409, r.status);
    }

    // ---------- 6) idempotent re-claim ----------

    @Test
    public void testF_sameTokenReclaim() throws IOException {
        Result r = postJson(base + "/api/sync/claim",
            "{\"rsn\":\"" + rsn + "\"}",
            "Bearer " + TEST_TOKEN);
        assertEquals("Re-claim met zelfde token → 200. body=" + r.body, 200, r.status);
    }

    // ---------- 7) InstallToken gedrag (de plugin-side helper) ----------

    @Test
    public void testG_installTokenCacheHit() {
        Map<String, String> store = new HashMap<>();
        store.put("installToken", "preexisting-token-vanuit-runelite-config");
        InstallToken.KeyValueStore kv = mapStore(store);

        String got = InstallToken.getOrCreate(kv);
        assertEquals("Bestaande token moet teruggegeven worden, niet overschreven",
            "preexisting-token-vanuit-runelite-config", got);
    }

    @Test
    public void testH_installTokenCacheMissGeneratesUuid() {
        Map<String, String> store = new HashMap<>();
        InstallToken.KeyValueStore kv = mapStore(store);

        String got = InstallToken.getOrCreate(kv);
        assertNotNull(got);
        assertTrue("Nieuwe token moet UUID-vorm hebben: " + got,
            got.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"));
        assertEquals("Token moet naar store geschreven zijn", got, store.get("installToken"));
    }

    @Test
    public void testI_claimedRsnMemo() {
        Map<String, String> store = new HashMap<>();
        InstallToken.KeyValueStore kv = mapStore(store);
        assertNull("Vers, niets onthouden", InstallToken.claimedRsn(kv));
        InstallToken.rememberClaimedRsn(kv, rsn);
        assertEquals(rsn, InstallToken.claimedRsn(kv));
    }

    @Test
    public void testJ_forgetClaimKeepsInstallToken() {
        Map<String, String> store = new HashMap<>();
        InstallToken.KeyValueStore kv = mapStore(store);
        String token = InstallToken.getOrCreate(kv);
        InstallToken.rememberClaimedRsn(kv, rsn);

        InstallToken.forgetClaim(kv);

        assertNull("Claim-cache is cleared", InstallToken.claimedRsn(kv));
        assertEquals("Install token remains stable", token, InstallToken.getOrCreate(kv));
    }

    // ---------- helpers ----------

    private static InstallToken.KeyValueStore mapStore(Map<String, String> backing) {
        return new InstallToken.KeyValueStore() {
            @Override public String get(String key) { return backing.get(key); }
            @Override public void set(String key, String value) { backing.put(key, value); }
        };
    }

    private static boolean serverReachable() {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(base).openConnection();
            c.setConnectTimeout(1000);
            c.setReadTimeout(1000);
            c.setRequestMethod("HEAD");
            int code = c.getResponseCode();
            return code < 500;
        } catch (IOException e) {
            return false;
        }
    }

    private static String requiredProperty(String name) {
        String value = System.getProperty(name);
        assertNotNull(name + " ontbreekt", value);
        assertFalse(name + " is leeg", value.isBlank());
        return value.trim();
    }

    private static void assertPersistedSnapshot(JsonObject accepted) throws Exception {
        try (Connection c = DriverManager.getConnection(toJdbcUrl(dbUrl), jdbcProps(dbUrl))) {
            String projectionSql =
                "SELECT plugin_version, synced_at, " +
                "jsonb_array_length(skills) AS skills_count, " +
                "jsonb_array_length(quests_completed) AS quests_count, " +
                "jsonb_array_length(diaries_completed) AS diaries_count, " +
                "cardinality(collection_log_item_ids) AS clog_count, " +
                "jsonb_array_length(bank_items) AS bank_count, " +
                "boss_kc ->> 'Vorkath' AS vorkath_kc, " +
                "slayer ->> 'taskName' AS task_name, " +
                "snapshot_coverage -> 'bank' ->> 'state' AS bank_coverage " +
                "FROM player_sync WHERE rsn=?";
            try (PreparedStatement p = c.prepareStatement(projectionSql)) {
                p.setString(1, rsn.toLowerCase());
                try (ResultSet row = p.executeQuery()) {
                    assertTrue("player_sync projection ontbreekt na geaccepteerde POST", row.next());
                    assertEquals("0.3.0", row.getString("plugin_version"));
                    assertEquals(Instant.parse(accepted.get("syncedAt").getAsString()),
                        row.getTimestamp("synced_at").toInstant());
                    assertEquals(2, row.getInt("skills_count"));
                    assertEquals(2, row.getInt("quests_count"));
                    assertEquals(1, row.getInt("diaries_count"));
                    assertEquals(3, row.getInt("clog_count"));
                    assertEquals(2, row.getInt("bank_count"));
                    assertEquals("48", row.getString("vorkath_kc"));
                    assertEquals("Dust devils", row.getString("task_name"));
                    assertEquals("available", row.getString("bank_coverage"));
                    assertFalse("Meer dan een projection-row voor de E2E-identiteit", row.next());
                }
            }

            String historySql =
                "SELECT snapshot.plugin_version, snapshot.captured_at, " +
                "snapshot.coverage -> 'skills' ->> 'state' AS skills_coverage, " +
                "jsonb_array_length(snapshot.skills) AS skills_count " +
                "FROM account_identity identity " +
                "JOIN sync_snapshot snapshot ON snapshot.account_id=identity.account_id " +
                "WHERE identity.rsn=? ORDER BY snapshot.captured_at DESC LIMIT 1";
            try (PreparedStatement p = c.prepareStatement(historySql)) {
                p.setString(1, rsn.toLowerCase());
                try (ResultSet row = p.executeQuery()) {
                    assertTrue("Immutable sync_snapshot ontbreekt", row.next());
                    assertEquals("0.3.0", row.getString("plugin_version"));
                    assertEquals(Instant.parse(accepted.get("syncedAt").getAsString()),
                        row.getTimestamp("captured_at").toInstant());
                    assertEquals("available", row.getString("skills_coverage"));
                    assertEquals(2, row.getInt("skills_count"));
                }
            }
        }
    }

    private static void assertPublicReadback(JsonObject accepted) throws IOException {
        String encodedRsn = URLEncoder.encode(rsn, StandardCharsets.UTF_8);
        Result status = get(base + "/api/sync/status?rsn=" + encodedRsn);
        assertEquals("Browser readback moet dezelfde scan vinden. body=" + status.body, 200, status.status);
        JsonObject receipt = parseObject(status.body).getAsJsonObject("player");
        assertNotNull(receipt);
        assertEquals(accepted.get("syncedAt").getAsString(), receipt.get("syncedAt").getAsString());
        assertEquals(accepted.get("pluginVersion").getAsString(), receipt.get("pluginVersion").getAsString());
        assertEquals(3, receipt.get("contractVersion").getAsInt());
        assertEquals("verified", receipt.getAsJsonObject("claim").get("status").getAsString());
        assertEquals("available", receipt.getAsJsonObject("coverage")
            .getAsJsonObject("collectionLog").get("state").getAsString());
        assertFalse("Status receipt mag geen questwaarden lekken", status.body.contains("Dragon Slayer I"));
        assertFalse("Status receipt mag geen bankwaarden lekken", status.body.contains("Iron bar"));
        assertFalse("Status receipt mag geen Slayer-taak lekken", status.body.contains("Dust devils"));
    }

    private static void deleteTestIdentity() throws Exception {
        try (Connection c = DriverManager.getConnection(toJdbcUrl(dbUrl), jdbcProps(dbUrl))) {
            c.setAutoCommit(false);
            try {
                deleteByRsn(c, "DELETE FROM player_claim WHERE rsn=?");
                deleteByRsn(c, "DELETE FROM player_sync WHERE rsn=?");
                deleteByRsn(c, "DELETE FROM account_identity WHERE rsn=?");
                c.commit();
            } catch (Exception error) {
                c.rollback();
                throw error;
            }
        }
    }

    private static void deleteByRsn(Connection connection, String sql) throws Exception {
        try (PreparedStatement p = connection.prepareStatement(sql)) {
            p.setString(1, rsn.toLowerCase());
            p.executeUpdate();
        }
    }

    private static JsonObject parseObject(String body) {
        return new Gson().fromJson(body, JsonObject.class);
    }

    private static final class Result {
        final int status;
        final String body;
        Result(int s, String b) { this.status = s; this.body = b; }
    }

    private static Result postJson(String url, String json, String authHeader) throws IOException {
        Request.Builder b = new Request.Builder()
            .url(url)
            .post(RequestBody.create(JSON, json))
            .header("User-Agent", "scapestack-junit-e2e");
        if (authHeader != null) b.header("Authorization", authHeader);
        try (Response res = http.newCall(b.build()).execute()) {
            String body = res.body() != null ? res.body().string() : "";
            return new Result(res.code(), body);
        }
    }

    private static Result get(String url) throws IOException {
        Request request = new Request.Builder()
            .url(url)
            .get()
            .header("User-Agent", "scapestack-junit-e2e")
            .build();
        try (Response res = http.newCall(request).execute()) {
            String body = res.body() != null ? res.body().string() : "";
            return new Result(res.code(), body);
        }
    }
}
