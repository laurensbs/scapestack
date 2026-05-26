package app.scapestack.runelite;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.inject.Provides;
import lombok.extern.slf4j.Slf4j;
import net.runelite.api.Client;
import net.runelite.api.GameState;
import net.runelite.api.events.ChatMessage;
import net.runelite.api.events.GameStateChanged;
import net.runelite.api.events.WidgetLoaded;
import net.runelite.client.callback.ClientThread;
import net.runelite.client.config.ConfigManager;
import net.runelite.client.eventbus.Subscribe;
import net.runelite.client.plugins.Plugin;
import net.runelite.client.plugins.PluginDescriptor;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import javax.inject.Inject;
import java.io.IOException;
import java.util.HashSet;
import java.util.Set;

/**
 * Scapestack Sync — reads the player's quest list, diary completion state,
 * and collection log out of the running game client and POSTs them to
 * scapestack.app/api/sync.
 *
 * Triggers:
 *   - Login → full sync (autoSync config)
 *   - Quest-complete chat message → re-sync (syncOnQuestComplete config)
 *
 * Why three signals: each fills a gap in what Jagex's public APIs expose.
 *   - Quests: no public completion API; we scrape the Quest List widget.
 *   - Diaries: no public per-tier API; we scrape the Diary widget.
 *   - Collection log: cl.net plugin already does this, but they require
 *     a separate upload step. We integrate it so one plugin gives
 *     Scapestack everything.
 *
 * State extraction details intentionally light here — first version
 * focuses on the round-trip. Widget IDs + parsing live in
 * GameStateReader to keep this entry-point readable.
 */
@Slf4j
@PluginDescriptor(
    name = "Scapestack Sync",
    description = "Sync your quest/diary/CL state to scapestack.app",
    tags = {"external", "sync", "scapestack"}
)
public class ScapestackSyncPlugin extends Plugin {

    @Inject private Client client;
    @Inject private ClientThread clientThread;
    @Inject private ScapestackSyncConfig config;
    @Inject private GameStateReader reader;

    private final OkHttpClient http = new OkHttpClient();
    private static final MediaType JSON = MediaType.parse("application/json");
    private static final String PLUGIN_VERSION = "0.1.0";

    @Override
    protected void startUp() {
        log.info("Scapestack Sync started");
    }

    @Override
    protected void shutDown() {
        log.info("Scapestack Sync stopped");
    }

    @Subscribe
    public void onGameStateChanged(GameStateChanged e) {
        if (!config.autoSync()) return;
        // LOGGING_IN fires once when the world handshake settles. We wait
        // for LOGGED_IN since widgets aren't readable before that.
        if (e.getGameState() == GameState.LOGGED_IN) {
            // Delay the read so the quest-list widget has time to populate.
            // 3s is RuneLite-community standard for this kind of poll.
            clientThread.invokeLater(this::triggerSync);
        }
    }

    @Subscribe
    public void onChatMessage(ChatMessage event) {
        if (!config.syncOnQuestComplete()) return;
        String message = event.getMessage();
        // RuneLite chat-message text on quest completion is consistent:
        // 'Congratulations! Quest complete! You are awarded ...' — the
        // first three words suffice.
        if (message.startsWith("Congratulations! Quest complete!")) {
            log.debug("Quest completion detected, scheduling re-sync");
            clientThread.invokeLater(this::triggerSync);
        }
    }

    @Subscribe
    public void onWidgetLoaded(WidgetLoaded e) {
        // Hook reserved for future diary widget detection — when the
        // player opens the Diary widget we re-read its state. v0 syncs
        // on login so this isn't critical.
    }

    private void triggerSync() {
        String rsn = client.getLocalPlayer() != null ? client.getLocalPlayer().getName() : null;
        if (rsn == null || rsn.isBlank()) {
            log.debug("triggerSync called but RSN unknown — skipping");
            return;
        }

        GameStateReader.Snapshot snap;
        try {
            snap = reader.readSnapshot(client);
        } catch (Exception ex) {
            log.warn("Failed to read game state", ex);
            return;
        }

        Gson gson = new Gson();
        JsonObject body = new JsonObject();
        body.addProperty("rsn", rsn);
        body.addProperty("displayName", rsn);
        body.addProperty("pluginVersion", PLUGIN_VERSION);
        body.add("questsCompleted", gson.toJsonTree(snap.questsCompleted));
        JsonArray diaries = new JsonArray();
        for (GameStateReader.DiaryCompletion d : snap.diariesCompleted) {
            JsonObject row = new JsonObject();
            row.addProperty("region", d.region);
            row.addProperty("tier", d.tier);
            diaries.add(row);
        }
        body.add("diariesCompleted", diaries);
        body.add("collectionLogItemIds", gson.toJsonTree(snap.collectionLogItemIds));

        Request req = new Request.Builder()
            .url(config.syncUrl())
            .post(RequestBody.create(JSON, body.toString()))
            .header("User-Agent", "scapestack-plugin/" + PLUGIN_VERSION)
            .build();

        // Fire-and-forget — we don't block the game thread on the sync.
        new Thread(() -> {
            try (Response res = http.newCall(req).execute()) {
                if (res.isSuccessful()) {
                    log.info("Synced to Scapestack: {} quests, {} diaries, {} CL items",
                        snap.questsCompleted.size(),
                        snap.diariesCompleted.size(),
                        snap.collectionLogItemIds.size());
                } else {
                    log.warn("Sync failed: HTTP {}", res.code());
                }
            } catch (IOException ex) {
                log.warn("Sync request failed", ex);
            }
        }, "scapestack-sync").start();
    }

    @Provides
    ScapestackSyncConfig provideConfig(ConfigManager configManager) {
        return configManager.getConfig(ScapestackSyncConfig.class);
    }
}
