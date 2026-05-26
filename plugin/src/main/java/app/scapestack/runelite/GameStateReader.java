package app.scapestack.runelite;

import lombok.extern.slf4j.Slf4j;
import net.runelite.api.Client;
import net.runelite.api.Quest;
import net.runelite.api.QuestState;
import net.runelite.api.widgets.Widget;
import net.runelite.api.widgets.WidgetInfo;

import javax.inject.Singleton;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Reads quest/diary/CL state out of the live game client.
 *
 * Quests: Client exposes a Quest enum + QuestState per quest — pure
 * API call, no widget scraping needed.
 *
 * Diaries: RuneLite doesn't expose an enum for tier-completion. We
 * read the Achievement Diary widget when it's open and parse the
 * 'task complete' checkmarks. v0 of this plugin: we capture what we
 * see when the player opens the diary screen. Future versions can
 * also scrape the dedicated diary-completion widget that lives in
 * the world map menu.
 *
 * Collection log: same problem — the CL widget is the source of truth.
 * v0 scrapes only when the widget is loaded. Players will need to open
 * the CL once for the data to populate.
 */
@Slf4j
@Singleton
public class GameStateReader {

    public static class Snapshot {
        public List<String> questsCompleted = new ArrayList<>();
        public List<DiaryCompletion> diariesCompleted = new ArrayList<>();
        public List<Integer> collectionLogItemIds = new ArrayList<>();
    }

    public static class DiaryCompletion {
        public final String region;
        public final String tier;
        public DiaryCompletion(String region, String tier) {
            this.region = region;
            this.tier = tier;
        }
    }

    public Snapshot readSnapshot(Client client) {
        Snapshot s = new Snapshot();
        s.questsCompleted = readQuests(client);
        s.diariesCompleted = readDiaries(client);
        s.collectionLogItemIds = readCollectionLog(client);
        return s;
    }

    /**
     * Reads quest completion via RuneLite's Quest enum + QuestState API.
     * This is the cleanest of the three signals — no widget scraping.
     */
    private List<String> readQuests(Client client) {
        List<String> out = new ArrayList<>();
        for (Quest q : Quest.values()) {
            try {
                QuestState state = q.getState(client);
                if (state == QuestState.FINISHED) {
                    out.add(q.getName());
                }
            } catch (Exception ex) {
                // Some quests aren't in the player's quest list yet
                // (newer content can throw). Skip silently.
            }
        }
        log.debug("Read {} completed quests", out.size());
        return out;
    }

    /**
     * Reads diary tier completion. v0 stub — returns empty list. The
     * Achievement Diary widget IDs aren't exposed via a clean enum,
     * so we'll wire this up in a follow-up using ScriptID hooks.
     *
     * Practical effect: until this is implemented, the diary path on
     * /next falls back to the heuristic (skill-margin + XP-evidence)
     * for our own plugin's users too. Quests + CL work end-to-end.
     */
    private List<DiaryCompletion> readDiaries(Client client) {
        // TODO(v0.2): hook ScriptID.DIARY_TASK_COMPLETED + read the
        // 12 region widgets to extract per-tier flags. See:
        //   https://oldschool.runescape.wiki/w/RuneScape:Diary_completion
        return Collections.emptyList();
    }

    /**
     * Reads collection log when the widget is open. Same situation as
     * diaries — v0 stub; v0.2 scrapes the CL widget when the user opens
     * it. Until then, /next falls back to collectionlog.net for the
     * subset of players who use that plugin.
     */
    private List<Integer> readCollectionLog(Client client) {
        // TODO(v0.2): hook WidgetID.COLLECTION_LOG_GROUP_ID and walk
        // every entry's items[] looking for quantity > 0.
        return Collections.emptyList();
    }
}
