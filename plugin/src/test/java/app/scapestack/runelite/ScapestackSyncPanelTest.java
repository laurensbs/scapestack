package app.scapestack.runelite;

import org.junit.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class ScapestackSyncPanelTest {

    private static String panelSource() throws Exception {
        return Files.readString(
            Path.of("src/main/java/app/scapestack/runelite/ScapestackSyncPanel.java"),
            StandardCharsets.UTF_8
        );
    }

    @Test
    public void panelCopyIsProductFocusedAndHidesDeveloperDetails() throws Exception {
        String source = panelSource();

        assertTrue(source.contains("Scapestack Sync"));
        assertTrue(source.contains("Sends your progress to scapestack.org."));
        assertTrue(source.contains("Sync now"));
        assertTrue(source.contains("Account mode"));
        assertTrue(source.contains("Last update"));
        assertTrue(source.contains("Auto update"));
        assertTrue(source.contains("Next action"));
        assertTrue(source.contains("Turn everything on"));
        assertTrue(source.contains("What gets sent"));
        assertTrue(source.contains("Skills, XP, quests, diaries, boss KC RuneLite has seen, Slayer task and bank items"));
        assertTrue(source.contains("Auto update refreshes after login and then every 15 minutes while you play"));
        assertTrue(source.contains("Bank off sends everything except your bank"));
        assertTrue(source.contains("Collection Log"));
        assertTrue(source.contains("Troubleshooting"));
        assertTrue(source.contains("Connect this browser"));
        assertTrue(source.contains("Get a code on Scapestack"));
        assertTrue(source.contains("shouldShowCollectionLogInstruction"));

        String lower = source.toLowerCase();
        assertFalse(lower.contains("paste endpoint"));
        assertFalse(lower.contains("sync url"));
        assertFalse(lower.contains("payload"));
        assertFalse(lower.contains("http status"));
    }

    /**
     * Players judge a plugin that talks to a server by whether it names the
     * destination, not by whether it reassures them. Every high-trust peer on
     * the hub names its domain; this panel has to keep doing it in the copy the
     * player sees first, not only inside collapsed troubleshooting.
     */
    @Test
    public void panelNamesTheDestinationDomain() throws Exception {
        assertTrue(panelSource().contains("scapestack.org"));
    }

    /**
     * The panel has to be built from RuneLite's own tokens or it reads as
     * bolted on: its own browns and Font.SANS_SERIF were the single biggest
     * thing making it look foreign, and every arc in RuneLite's theme is 0.
     */
    @Test
    public void panelIsBuiltFromRuneLiteTokens() throws Exception {
        String source = panelSource();

        assertTrue(source.contains("import net.runelite.client.ui.ColorScheme;"));
        assertTrue(source.contains("import net.runelite.client.ui.FontManager;"));
        assertTrue(source.contains("ColorScheme.DARK_GRAY_COLOR"));
        assertTrue(source.contains("ColorScheme.DARKER_GRAY_COLOR"));
        assertTrue(source.contains("FontManager.getRunescapeSmallFont()"));

        assertFalse("panel must not define its own palette", source.contains("new Color("));
        assertFalse("panel must not pick its own typeface", source.contains("Font.SANS_SERIF"));
        assertFalse("every arc in RuneLite's theme is 0", source.contains("RoundRect"));
    }

    /**
     * Zero of these words appear across 1,985 player-written Plugin Hub
     * descriptions. See docs/design/SCAPESTACK-DESIGN-SYSTEM.md section 5.
     */
    @Test
    public void panelCopyAvoidsMarketingVocabulary() throws Exception {
        String lower = panelSource().toLowerCase();
        String[] banned = {
            "seamless", "powerful", "effortless", "elevate", "empower", "intuitive",
            "robust", "leverage", "streamline", "supercharge", "ultimate", "unleash",
            "curated", "personalised", "personalized", "next-level", "game-changing"
        };
        for (String word : banned) {
            assertFalse("panel copy uses marketing word: " + word, lower.contains(word));
        }
    }
}
