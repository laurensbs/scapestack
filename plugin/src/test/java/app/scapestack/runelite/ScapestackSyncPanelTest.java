package app.scapestack.runelite;

import org.junit.Test;

import javax.swing.AbstractButton;
import javax.swing.ImageIcon;
import javax.swing.JLabel;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;
import java.awt.Component;
import java.awt.Container;
import java.awt.image.BufferedImage;
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
        AtomicInteger fullResyncs = new AtomicInteger();
        AtomicInteger browserOpens = new AtomicInteger();
        List<String> approvedCodes = new ArrayList<>();
        List<Integer> spriteIds = new ArrayList<>();
        ScapestackSyncPanel[] holder = new ScapestackSyncPanel[1];
        SwingUtilities.invokeAndWait(() -> holder[0] = new ScapestackSyncPanel(
            syncOnLogin::get,
            enabled -> {
                settingWrites.add(enabled);
                syncOnLogin.set(enabled);
            },
            manualSyncs::incrementAndGet,
            fullResyncs::incrementAndGet,
            browserOpens::incrementAndGet,
            approvedCodes::add,
            (itemId, label) -> {
                spriteIds.add(itemId);
                label.setIcon(new ImageIcon(new BufferedImage(36, 32, BufferedImage.TYPE_INT_ARGB)));
            }
        ));
        ScapestackSyncPanel panel = holder[0];
        String beforeFirstSync = visibleText(panel);
        assertTrue(beforeFirstSync.contains("Quests"));
        assertTrue(beforeFirstSync.contains("not read yet"));
        assertTrue(beforeFirstSync.contains("Collection log"));
        assertTrue(beforeFirstSync.contains("not opened this session — open it once to include it"));
        assertTrue(beforeFirstSync.contains("Bank"));

        panel.setTimers("herbs ready in 12 min · birdhouses ready");
        panel.setProgressStatus(
            "180 read",
            "not opened this session — open it once to include it",
            "read 4 minutes ago"
        );
        panel.setReceipt(new ServerResponseSummary.PanelReceipt(
            Arrays.asList(
                new ServerResponseSummary.PanelAnswer(
                    "Vorkath",
                    "Blowpipe + dragon darts are in your bank.",
                    "20 kills",
                    "7 / 20",
                    "~34 min",
                    7462
                ),
                new ServerResponseSummary.PanelAnswer(
                    "Barrows",
                    "One chest run fits the supplies RuneLite saw.",
                    "5 chests",
                    "0 / 5",
                    "~25 min",
                    4710
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
        assertTrue(visible.contains("Goal"));
        assertTrue(visible.contains("herbs ready in 12 min · birdhouses ready"));
        assertTrue(visible.contains("Quests"));
        assertTrue(visible.contains("180 read"));
        assertTrue(visible.contains("Collection log"));
        assertTrue(visible.contains("not opened this session — open it once to include it"));
        assertTrue(visible.contains("Bank"));
        assertTrue(visible.contains("read 4 minutes ago"));
        assertTrue(visible.contains("That finishes Ahrim&#39;s."));
        assertFalse(visible.contains("Turn everything on"));
        assertFalse(visible.contains("Bank on"));
        assertFalse(visible.contains("Bank off"));
        assertEquals(List.of(7462), spriteIds);

        AbstractButton connect = findButton(panel, "Connect");
        assertNotNull(connect);
        SwingUtilities.invokeAndWait(connect::doClick);
        assertEquals(1, browserOpens.get());

        AbstractButton fallback = findButton(panel, "Enter code instead");
        assertNotNull(fallback);
        SwingUtilities.invokeAndWait(fallback::doClick);
        JTextField code = findTextField(panel);
        assertNotNull(code);
        SwingUtilities.invokeAndWait(() -> code.setText("abcd-efgh"));
        SwingUtilities.invokeAndWait(findButton(panel, "Approve connection")::doClick);
        assertEquals(List.of("abcd-efgh"), approvedCodes);

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

        AbstractButton fullResync = findButton(panel, "Full resync");
        assertNotNull(fullResync);
        SwingUtilities.invokeAndWait(fullResync::doClick);
        assertEquals(1, fullResyncs.get());
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

    private static JTextField findTextField(Component component) {
        if (component instanceof JTextField) return (JTextField) component;
        if (component instanceof Container) {
            for (Component child : ((Container) component).getComponents()) {
                JTextField found = findTextField(child);
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
