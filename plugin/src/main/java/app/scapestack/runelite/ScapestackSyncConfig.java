package app.scapestack.runelite;

import net.runelite.client.config.Config;
import net.runelite.client.config.ConfigGroup;
import net.runelite.client.config.ConfigItem;

@ConfigGroup("scapestackSync")
public interface ScapestackSyncConfig extends Config {

    @ConfigItem(
        keyName = "syncNow",
        name = "Sync now",
        description = "Update ScapeStack now. Resets automatically after sync starts."
    )
    default boolean syncNow() {
        return false;
    }

    @ConfigItem(
        keyName = "autoSync",
        name = "Sync on login",
        description = "Keeps your ScapeStack planner current with account mode, skills, quests, diaries and Slayer task. Bank checks stay separate."
    )
    default boolean autoSync() {
        return false;
    }

    @ConfigItem(
        keyName = "syncBankItems",
        name = "Use bank for readiness",
        description = "Lets ScapeStack check which quest and diary items are already in your bank. Never sends inventory, equipment, chat, screenshots or account login."
    )
    default boolean syncBankItems() {
        return false;
    }

    @ConfigItem(
        keyName = "syncOnQuestComplete",
        name = "Refresh after quests",
        description = "Updates Scapestack right after a quest completion. Requires Sync on login to be enabled."
    )
    default boolean syncOnQuestComplete() {
        return false;
    }

    @ConfigItem(
        keyName = "forceClaimOnNextSync",
        name = "Reconnect player",
        description = "Reconnect this RuneLite install to your current player on the next sync. Use this after changing RSN."
    )
    default boolean forceClaimOnNextSync() {
        return false;
    }

    @ConfigItem(
        keyName = "chatFeedback",
        name = "Compact chat updates",
        description = "Show short RuneLite chat updates when Scapestack starts, completes or needs attention."
    )
    default boolean chatFeedback() {
        return true;
    }
}
