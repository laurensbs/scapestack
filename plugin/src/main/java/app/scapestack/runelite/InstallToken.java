package app.scapestack.runelite;

import net.runelite.client.config.ConfigManager;

import java.util.UUID;

/**
 * Per-install secret used to bind a RuneLite installation to an RSN.
 *
 * Lifecycle:
 *   1. First plugin run: generate a UUID, persist via ConfigManager under
 *      ("scapestackSync", "installToken").
 *   2. Plugin's first sync POSTs {rsn, token} to /api/sync/claim. The
 *      server stores sha256(token) keyed by RSN, first-write-wins.
 *   3. Every subsequent /api/sync POST carries Authorization: Bearer <token>.
 *      Server rejects when the hash doesn't match the bound claim.
 *
 * The token is generated client-side so we never have to ship a secret
 * through any out-of-band channel; only this install knows it.
 *
 * Threat model + caveats live in src/lib/sync-auth.ts on the server side.
 */
public final class InstallToken {

    private static final String GROUP = "scapestackSync";
    private static final String KEY   = "installToken";

    private InstallToken() {}

    /**
     * Returns the persisted token if present, otherwise generates a new
     * UUID and writes it to ConfigManager before returning it.
     */
    public static String getOrCreate(ConfigManager cm) {
        String existing = cm.getConfiguration(GROUP, KEY);
        if (existing != null && !existing.isBlank()) {
            return existing.trim();
        }
        String fresh = UUID.randomUUID().toString();
        cm.setConfiguration(GROUP, KEY, fresh);
        return fresh;
    }

    /**
     * Returns the bound RSN that this token has already claimed in a prior
     * run (or null). Used to skip the claim POST when we've already done it
     * for the current player.
     */
    public static String claimedRsn(ConfigManager cm) {
        String v = cm.getConfiguration(GROUP, "claimedRsn");
        return v == null || v.isBlank() ? null : v.trim();
    }

    public static void rememberClaimedRsn(ConfigManager cm, String rsn) {
        cm.setConfiguration(GROUP, "claimedRsn", rsn);
    }
}
