package app.scapestack.runelite;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import lombok.extern.slf4j.Slf4j;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import java.io.IOException;
import java.net.URI;
import java.util.Objects;
import java.util.function.Consumer;

/** Approves a short browser pairing code using the existing install claim. */
@Slf4j
final class PairingClient {
    private static final MediaType JSON = MediaType.parse("application/json");
    private final OkHttpClient http;

    PairingClient(OkHttpClient http) {
        this.http = http;
    }

    boolean approve(String syncUrl, String rsn, String code, String token, String userAgent) {
        JsonObject body = new JsonObject();
        body.addProperty("rsn", rsn);
        body.addProperty("code", normalizeCode(code));
        try {
            Request request = new Request.Builder()
                .url(pairingUrlFromSyncUrl(syncUrl))
                .post(RequestBody.create(JSON, body.toString()))
                .header("User-Agent", userAgent)
                .header("Authorization", "Bearer " + token)
                .build();
            try (Response response = http.newCall(request).execute()) {
                String responseBody = ServerResponseSummary.readBody(response);
                if (response.isSuccessful()) return true;
                log.warn("Scapestack browser connection failed: {}",
                    ServerResponseSummary.logDetail(response.code(), responseBody));
                return false;
            }
        } catch (IllegalArgumentException ex) {
            log.warn("Scapestack browser connection URL is invalid");
            return false;
        } catch (IOException ex) {
            log.warn("Scapestack browser connection request failed", ex);
            return false;
        }
    }

    /** Starts the inverse pairing flow and returns only a same-origin /link URL. */
    boolean openBrowserLink(
        String syncUrl,
        String rsn,
        String token,
        String userAgent,
        Consumer<String> browser
    ) {
        JsonObject body = new JsonObject();
        body.addProperty("rsn", rsn);
        try {
            Request request = new Request.Builder()
                .url(pairingOpenUrlFromSyncUrl(syncUrl))
                .post(RequestBody.create(JSON, body.toString()))
                .header("User-Agent", userAgent)
                .header("Authorization", "Bearer " + token)
                .build();
            try (Response response = http.newCall(request).execute()) {
                String responseBody = ServerResponseSummary.readBody(response);
                if (!response.isSuccessful()) {
                    log.warn("Scapestack browser link failed: {}",
                        ServerResponseSummary.logDetail(response.code(), responseBody));
                    return false;
                }
                String link = browserLinkFromBody(syncUrl, responseBody);
                if (link == null) return false;
                browser.accept(link);
                return true;
            }
        } catch (IllegalArgumentException ex) {
            log.warn("Scapestack browser link URL is invalid");
            return false;
        } catch (IOException ex) {
            log.warn("Scapestack browser link request failed", ex);
            return false;
        }
    }

    static String normalizeCode(String code) {
        if (code == null) return "";
        String clean = code.toUpperCase().replaceAll("[^A-Z0-9]", "");
        return clean.substring(0, Math.min(8, clean.length()));
    }

    static String pairingUrlFromSyncUrl(String syncUrl) {
        return pairingEndpointFromSyncUrl(syncUrl, "approve");
    }

    static String pairingOpenUrlFromSyncUrl(String syncUrl) {
        return pairingEndpointFromSyncUrl(syncUrl, "open");
    }

    private static String pairingEndpointFromSyncUrl(String syncUrl, String action) {
        String clean = ClaimClient.normalizeSyncUrl(syncUrl);
        if (clean.endsWith("/api/sync")) {
            return clean.substring(0, clean.length() - "/api/sync".length()) + "/api/account/pair/" + action;
        }
        if (clean.endsWith("/sync")) {
            return clean.substring(0, clean.length() - "/sync".length()) + "/account/pair/" + action;
        }
        return clean + "/account/pair/" + action;
    }

    private static String browserLinkFromBody(String syncUrl, String body) {
        try {
            JsonElement parsed = new JsonParser().parse(body);
            if (!parsed.isJsonObject()) return null;
            JsonElement pairing = parsed.getAsJsonObject().get("pairing");
            if (pairing == null || !pairing.isJsonObject()) return null;
            JsonElement link = pairing.getAsJsonObject().get("linkUrl");
            if (link == null || !link.isJsonPrimitive() || !link.getAsJsonPrimitive().isString()) return null;

            URI sync = URI.create(ClaimClient.normalizeSyncUrl(syncUrl));
            URI candidate = URI.create(link.getAsString());
            if (!Objects.equals(sync.getScheme(), candidate.getScheme())
                || !Objects.equals(sync.getHost(), candidate.getHost())
                || effectivePort(sync) != effectivePort(candidate)
                || !"/link".equals(candidate.getPath())) {
                return null;
            }
            String query = candidate.getRawQuery();
            if (query == null || !query.matches("(?:^|.*&)code=[A-Z0-9]{8}(?:&.*|$)")) return null;
            return candidate.toString();
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static int effectivePort(URI uri) {
        if (uri.getPort() >= 0) return uri.getPort();
        return "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
    }
}
