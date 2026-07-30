package app.scapestack.runelite;

import org.junit.Test;

import javax.swing.AbstractButton;
import javax.swing.JLabel;
import javax.swing.SwingUtilities;
import java.awt.Component;
import java.awt.Container;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

public class ScapestackSyncPanelTest {

    @Test
    public void rendersTheAnswerAndOneSettingToggleAtPanelWidth() throws Exception {
        AtomicBoolean syncOnLogin = new AtomicBoolean(false);
        List<Boolean> settingWrites = new ArrayList<>();
        AtomicInteger manualSyncs = new AtomicInteger();
        ScapestackSyncPanel[] holder = new ScapestackSyncPanel[1];
        SwingUtilities.invokeAndWait(() -> holder[0] = new ScapestackSyncPanel(
            syncOnLogin::get,
            enabled -> {
                settingWrites.add(enabled);
                syncOnLogin.set(enabled);
            },
            manualSyncs::incrementAndGet,
            code -> { }
        ));
        ScapestackSyncPanel panel = holder[0];

        panel.setTimers("herbs ready in 12 min · birdhouses ready");
        panel.setReceipt(new ServerResponseSummary.PanelReceipt(
            Arrays.asList(
                new ServerResponseSummary.PanelAnswer(
                    "Vorkath",
                    "Blowpipe + dragon darts are in your bank.",
                    "20 kills",
                    "7 / 20",
                    "~34 min"
                ),
                new ServerResponseSummary.PanelAnswer(
                    "Barrows",
                    "One chest run fits the supplies RuneLite saw.",
                    "5 chests",
                    "0 / 5",
                    "~25 min"
                )
            ),
            "14,500,000 gp banked. Ahrim's robeskirt — 1,572,490 gp. That finishes Ahrim's."
        ));
        flushEdt();

        String visible = visibleText(panel);
        assertTrue(visible.contains("NOW"));
        assertTrue(visible.contains("Vorkath"));
        assertTrue(visible.contains("Blowpipe + dragon darts are in your bank."));
        assertTrue(visible.contains("Stop at"));
        assertTrue(visible.contains("20 kills"));
        assertTrue(visible.contains("7 / 20"));
        assertTrue(visible.contains("~34 min"));
        assertTrue(visible.contains("herbs ready in 12 min · birdhouses ready"));
        assertTrue(visible.contains("That finishes Ahrim&#39;s."));
        assertFalse(visible.contains("Turn everything on"));
        assertFalse(visible.contains("Bank on"));
        assertFalse(visible.contains("Bank off"));

        AbstractButton another = findButton(panel, "Something else");
        assertNotNull(another);
        SwingUtilities.invokeAndWait(another::doClick);
        assertTrue(visibleText(panel).contains("Barrows"));

        AbstractButton toggle = findButton(panel, "Sync on login: off");
        assertNotNull(toggle);
        SwingUtilities.invokeAndWait(toggle::doClick);
        flushEdt();
        assertEquals(List.of(true), settingWrites);
        assertEquals(0, manualSyncs.get());
        assertNotNull(findButton(panel, "Sync on login: on"));
        assertEquals(225, ScapestackSyncPanel.PANEL_WIDTH);
    }

    private static void flushEdt() throws Exception {
        SwingUtilities.invokeAndWait(() -> { });
    }

    private static String visibleText(Component component) {
        StringBuilder out = new StringBuilder();
        appendVisibleText(component, out);
        return out.toString();
    }

    private static void appendVisibleText(Component component, StringBuilder out) {
        if (!component.isVisible()) return;
        if (component instanceof JLabel) out.append(((JLabel) component).getText()).append('\n');
        if (component instanceof AbstractButton) out.append(((AbstractButton) component).getText()).append('\n');
        if (component instanceof Container) {
            for (Component child : ((Container) component).getComponents()) appendVisibleText(child, out);
        }
    }

    private static AbstractButton findButton(Component component, String text) {
        if (component instanceof AbstractButton && text.equals(((AbstractButton) component).getText())) {
            return (AbstractButton) component;
        }
        if (component instanceof Container) {
            for (Component child : ((Container) component).getComponents()) {
                AbstractButton found = findButton(child, text);
                if (found != null) return found;
            }
        }
        return null;
    }

    private static String panelSource() throws Exception {
        return Files.readString(
            Path.of("src/main/java/app/scapestack/runelite/ScapestackSyncPanel.java"),
            StandardCharsets.UTF_8
        );
    }

    @Test
    public void panelIsBuiltFromRuneLiteTokens() throws Exception {
        String source = panelSource();
        assertTrue(source.contains("import net.runelite.client.ui.ColorScheme;"));
        assertTrue(source.contains("import net.runelite.client.ui.FontManager;"));
        assertTrue(source.contains("ColorScheme.DARK_GRAY_COLOR"));
        assertTrue(source.contains("ColorScheme.DARKER_GRAY_COLOR"));
        assertTrue(source.contains("FontManager.getRunescapeSmallFont()"));
        assertFalse(source.contains("new Color("));
        assertFalse(source.contains("Font.SANS_SERIF"));
        assertFalse(source.contains("RoundRect"));
    }

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
