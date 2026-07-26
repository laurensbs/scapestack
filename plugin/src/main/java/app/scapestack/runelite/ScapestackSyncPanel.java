package app.scapestack.runelite;

import net.runelite.client.config.ConfigManager;
import net.runelite.client.ui.ColorScheme;
import net.runelite.client.ui.FontManager;
import net.runelite.client.ui.PluginPanel;

import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;
import javax.swing.border.Border;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.image.BufferedImage;
import java.util.function.Consumer;

/**
 * Sidebar panel.
 *
 * Every surface, colour and font here comes from RuneLite's own
 * {@link ColorScheme} and {@link FontManager} rather than from Scapestack's
 * web palette. A plugin panel that brings its own browns reads as bolted on
 * next to the twenty stock panels a player already has open; the client's
 * greys are the only ones that sit right beside them. Same reason every arc
 * is zero: RuneLite's look-and-feel sets Button.arc, Component.arc and
 * CheckBox.arc to 0, so a rounded corner is the fastest tell that a panel is
 * foreign.
 */
final class ScapestackSyncPanel extends PluginPanel {
    private static final Color PAGE = ColorScheme.DARK_GRAY_COLOR;            // #282828
    private static final Color CARD = ColorScheme.DARKER_GRAY_COLOR;          // #1E1E1E
    private static final Color CONTROL = ColorScheme.DARK_GRAY_COLOR;         // #282828
    private static final Color CONTROL_HOVER = ColorScheme.DARKER_GRAY_HOVER_COLOR; // #3C3C3C
    private static final Color KEY = ColorScheme.LIGHT_GRAY_COLOR;            // #A5A5A5
    private static final Color VALUE = Color.WHITE;
    private static final Color ACCENT = ColorScheme.BRAND_ORANGE;             // #DC8A00

    private static final int CARD_PADDING = 10;
    private static final int CARD_GAP = 5;
    private static final int ROW_GAP = 3;
    private static final int CONTROL_HEIGHT = 30;

    /**
     * PluginPanel is exactly PANEL_WIDTH (225px) and hard-disables horizontal
     * scrolling, so anything wider than this is silently clipped: 193px here.
     *
     * The unit below is pt, not px, and that is load-bearing. Swing's HTML CSS
     * maps px to 1.3pt, so a label declared width:193px lays its text out at
     * 250 and then paints it into a 193px slot — every wrapped line loses its
     * last word or two mid-word. pt maps 1:1. Measured, not assumed.
     */
    private static final String WRAP = "width:" + (PANEL_WIDTH - (BORDER_OFFSET * 2) - (CARD_PADDING * 2)) + "pt";

    private final ScapestackSyncConfig config;
    private final ConfigManager configManager;
    private final Runnable syncNow;
    private final Consumer<String> connectBrowser;

    private final StatusRow statusValue = new StatusRow("Status", "Ready");
    private final StatusRow lastSyncValue = new StatusRow("Last update", "Not synced yet");
    private final StatusRow autoRefreshValue = new StatusRow("Auto update", "Off");
    private final StatusRow accountModeValue = new StatusRow("Account mode", "Unknown");
    private final StatusRow playerValue = new StatusRow("Player", "Log in to detect");
    private final StatusRow bankValue = new StatusRow("Bank", "Off");
    private final StatusRow farmingValue = new StatusRow("Farming", "Not read yet");
    // Was keyed "Clog" — the only jargon in the panel — because the value it
    // carried was the instruction "Open Collection Log once, then sync again",
    // and "Collection Log: Open Collection Log once" stuttered. The value is
    // now state, like every other row, so the stutter is gone and there is no
    // longer a reason to make a first-time installer decode an abbreviation.
    // Instructions live in one place only: Next action.
    private final StatusRow collectionLogValue = new StatusRow("Collection log", "Not opened");
    // Next action is the only row that tells the player to do something. Every
    // other row reports state. When two things are blocking, Next action names
    // the first one and the rows show the rest — the previous pass printed the
    // same sentence twice instead.
    private final StatusRow nextActionValue = new StatusRow("Next action", "Press Sync now");
    private final JButton bankToggle = button("Bank off");
    private final JPanel troubleshootingBody = new JPanel();

    ScapestackSyncPanel(
        ScapestackSyncConfig config,
        ConfigManager configManager,
        Runnable syncNow,
        Consumer<String> connectBrowser
    ) {
        this.config = config;
        this.configManager = configManager;
        this.syncNow = syncNow;
        this.connectBrowser = connectBrowser;

        setLayout(new BorderLayout());
        setBackground(PAGE);
        setBorder(new EmptyBorder(BORDER_OFFSET, BORDER_OFFSET, BORDER_OFFSET, BORDER_OFFSET));

        JPanel content = new JPanel();
        content.setLayout(new BoxLayout(content, BoxLayout.Y_AXIS));
        content.setBackground(PAGE);

        // The title sits on the page, not in a card. RuneLite has one type size
        // in three styles — there is no heading scale to reach for — so white
        // bold on the page is the only hierarchy the client actually has.
        content.add(heading("Scapestack Sync"));
        content.add(Box.createVerticalStrut(ROW_GAP));
        content.add(copy("Sends your progress to scapestack.org."));
        content.add(Box.createVerticalStrut(CARD_GAP));
        content.add(syncCard());
        content.add(Box.createVerticalStrut(CARD_GAP));
        content.add(connectBrowserCard());
        content.add(Box.createVerticalStrut(CARD_GAP));
        content.add(whatSyncsCard());
        content.add(Box.createVerticalStrut(CARD_GAP));
        content.add(troubleshootingCard());

        add(content, BorderLayout.NORTH);
        refresh();
    }

    static BufferedImage createIcon() {
        BufferedImage image = new BufferedImage(32, 32, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        // ClientUI downscales every sidebar icon to 16x16, so the mark is a bare
        // glyph in the client's own accent — no plate, no rounded corner.
        g.setColor(ACCENT);
        g.setFont(FontManager.getRunescapeBoldFont().deriveFont(28f));
        FontMetrics metrics = g.getFontMetrics();
        String mark = "S";
        int x = (32 - metrics.stringWidth(mark)) / 2;
        int y = (32 - metrics.getHeight()) / 2 + metrics.getAscent();
        g.drawString(mark, x, y);
        g.dispose();
        return image;
    }

    void setStatus(String status) {
        setValue(statusValue, status);
    }

    void setLastSync(String lastSync) {
        setValue(lastSyncValue, lastSync);
    }

    void setAccountMode(String accountMode) {
        setValue(accountModeValue, accountMode);
    }

    void setPlayerName(String playerName) {
        setValue(playerValue, playerName == null || playerName.isBlank() ? "Log in to detect" : playerName);
    }

    void setBankStatus(String bankStatus) {
        setValue(bankValue, bankStatus);
    }

    void setCollectionLogStatus(String collectionLogStatus) {
        setValue(collectionLogValue, collectionLogStatus);
    }

    void setFarmingStatus(String farmingStatus) {
        setValue(farmingValue, farmingStatus);
    }

    void setNextAction(String nextAction) {
        setValue(nextActionValue, nextAction);
    }

    void refresh() {
        SwingUtilities.invokeLater(() -> {
            bankToggle.setText(config.syncBankItems() ? "Bank on" : "Bank off");
            autoRefreshValue.setValue(config.autoSync()
                ? "Every " + ScapestackSyncPlugin.normalizedAutoSyncIntervalMinutes(config.autoSyncIntervalMinutes()) + " min"
                : "Off");
            revalidate();
            repaint();
        });
    }

    private JPanel syncCard() {
        JPanel panel = card();
        JButton syncButton = primaryButton("Sync now");
        syncButton.addActionListener(e -> syncNow.run());
        bankToggle.setToolTipText("Send bank items with every sync");
        bankToggle.addActionListener(e -> {
            configManager.setConfiguration(
                ScapestackSyncPlugin.CONFIG_GROUP,
                ScapestackSyncPlugin.KEY_SYNC_BANK_ITEMS,
                !config.syncBankItems()
            );
            refresh();
        });
        // Names what it switches on rather than calling itself recommended —
        // one of the four is "send my bank", which the player should see coming.
        JButton recommendedButton = button("Turn everything on");
        recommendedButton.setToolTipText("Sync on login, every 15 min, bank items, chat updates");
        recommendedButton.addActionListener(e -> {
            configManager.setConfiguration(
                ScapestackSyncPlugin.CONFIG_GROUP,
                ScapestackSyncPlugin.KEY_AUTO_SYNC,
                true
            );
            configManager.setConfiguration(
                ScapestackSyncPlugin.CONFIG_GROUP,
                ScapestackSyncPlugin.KEY_SYNC_BANK_ITEMS,
                true
            );
            configManager.setConfiguration(
                ScapestackSyncPlugin.CONFIG_GROUP,
                ScapestackSyncPlugin.KEY_AUTO_SYNC_INTERVAL_MINUTES,
                ScapestackSyncPlugin.DEFAULT_AUTO_SYNC_INTERVAL_MINUTES
            );
            configManager.setConfiguration(
                ScapestackSyncPlugin.CONFIG_GROUP,
                ScapestackSyncPlugin.KEY_CHAT_FEEDBACK,
                true
            );
            setStatus("Everything on");
            refresh();
        });

        stack(
            panel,
            statusValue,
            playerValue,
            accountModeValue,
            lastSyncValue,
            autoRefreshValue,
            bankValue,
            collectionLogValue,
            farmingValue,
            nextActionValue,
            syncButton,
            recommendedButton,
            bankToggle
        );
        return panel;
    }

    private JPanel whatSyncsCard() {
        JPanel panel = card();
        stack(
            panel,
            heading("What gets sent"),
            copy("Skills, XP, quests, diaries, boss KC RuneLite has seen, Slayer task, farm and birdhouse timers, and bank items."),
            copy("Auto update refreshes after login and then every 15 minutes while you play."),
            copy("Bank off sends everything except your bank.")
        );
        return panel;
    }

    private JPanel connectBrowserCard() {
        JPanel panel = card();
        JTextField code = new JTextField();
        code.setToolTipText("Scapestack connection code");
        code.setAlignmentX(Component.LEFT_ALIGNMENT);
        code.setMaximumSize(new Dimension(Integer.MAX_VALUE, CONTROL_HEIGHT));
        code.setBackground(PAGE);
        code.setForeground(VALUE);
        code.setCaretColor(VALUE);

        JButton approve = button("Connect browser");
        approve.addActionListener(e -> {
            String value = code.getText();
            if (PairingClient.normalizeCode(value).length() != 8) {
                setStatus("Enter the 8-character code");
                return;
            }
            connectBrowser.accept(value);
        });

        stack(
            panel,
            heading("Connect this browser"),
            copy("Get a code on Scapestack, enter it here, then continue on that browser."),
            code,
            approve
        );
        return panel;
    }

    private JPanel troubleshootingCard() {
        JPanel wrapper = card();
        JButton toggle = button("Troubleshooting");
        // These used to be three conditional workarounds the player had to
        // match against their own situation. Scapestack already knows which
        // one applies — it receives per-domain coverage on every sync and says
        // so on the page, at the moment it matters. Point there instead of
        // making the player diagnose the plugin.
        troubleshootingBody.setLayout(new BoxLayout(troubleshootingBody, BoxLayout.Y_AXIS));
        troubleshootingBody.setBackground(CARD);
        troubleshootingBody.setAlignmentX(Component.LEFT_ALIGNMENT);
        stack(
            troubleshootingBody,
            copy("Scapestack shows what it could and could not read on your plan page."),
            copy("Open scapestack.org/plugin for the current state of this install."),
            copy("Changed your RSN? Turn on Reconnect player, then sync once.")
        );
        troubleshootingBody.setVisible(false);
        toggle.addActionListener(e -> {
            troubleshootingBody.setVisible(!troubleshootingBody.isVisible());
            wrapper.revalidate();
            wrapper.repaint();
        });
        stack(wrapper, toggle, troubleshootingBody);
        return wrapper;
    }

    /** The stock RuneLite card: DARKER_GRAY block, 10px padding, no border, no arc. */
    private static JPanel card() {
        JPanel panel = new JPanel();
        panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
        panel.setBackground(CARD);
        panel.setBorder(new EmptyBorder(CARD_PADDING, CARD_PADDING, CARD_PADDING, CARD_PADDING));
        panel.setAlignmentX(Component.LEFT_ALIGNMENT);
        return panel;
    }

    private static void stack(JPanel parent, Component... children) {
        for (int i = 0; i < children.length; i++) {
            if (i > 0) {
                parent.add(Box.createVerticalStrut(ROW_GAP));
            }
            parent.add(children[i]);
        }
    }

    private static JLabel heading(String text) {
        JLabel label = new JLabel(text);
        label.setForeground(VALUE);
        label.setFont(FontManager.getRunescapeBoldFont());
        label.setAlignmentX(Component.LEFT_ALIGNMENT);
        return label;
    }

    private static JLabel copy(String text) {
        JLabel label = new JLabel("<html><body style='" + WRAP + "'>" + text + "</body></html>");
        label.setForeground(KEY);
        label.setFont(FontManager.getRunescapeSmallFont());
        label.setAlignmentX(Component.LEFT_ALIGNMENT);
        return label;
    }

    /**
     * RuneLite's status line, used verbatim in InfoPanel and XpInfoBox: a grey
     * key and a white value in one wrapped HTML label. Wrapping is the point —
     * "Open Collection Log once, then sync again" does not fit on one 193px row,
     * and a fixed-height row would silently truncate it to an ellipsis.
     */
    private static final class StatusRow extends JLabel {
        private final String key;

        StatusRow(String key, String value) {
            this.key = key;
            setFont(FontManager.getRunescapeSmallFont());
            setAlignmentX(Component.LEFT_ALIGNMENT);
            setValue(value);
        }

        void setValue(String value) {
            String shown = value == null || value.isBlank() ? "-" : value;
            setText("<html><body style='" + WRAP + "'>"
                + "<span style='color:#A5A5A5'>" + key + ":</span> "
                + "<span style='color:#FFFFFF'>" + shown + "</span>"
                + "</body></html>");
        }
    }

    private static JButton button(String text) {
        JButton button = new JButton(text);
        button.setBackground(CONTROL);
        button.setForeground(VALUE);
        button.setFocusPainted(false);
        button.setBorder(edge(ColorScheme.BORDER_COLOR));
        button.setAlignmentX(Component.LEFT_ALIGNMENT);
        button.setMaximumSize(new Dimension(Integer.MAX_VALUE, CONTROL_HEIGHT));
        button.setCursor(new Cursor(Cursor.HAND_CURSOR));
        button.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseEntered(MouseEvent e) {
                button.setBackground(CONTROL_HOVER);
            }

            @Override
            public void mouseExited(MouseEvent e) {
                button.setBackground(CONTROL);
            }
        });
        return button;
    }

    /**
     * The one accented thing in the panel, and it differs from every other
     * button by exactly one pixel row. RuneLite spends BRAND_ORANGE in a single
     * place in a stock panel — the 1px underline on a selected MaterialTab — so
     * a 1px underline is the emphasis the client already owns.
     */
    private static JButton primaryButton(String text) {
        JButton button = button(text);
        button.setBorder(edge(ACCENT));
        return button;
    }

    /** RuneLiteLAF's own control edge: 1px BORDER_COLOR, arc 0. */
    private static Border edge(Color bottom) {
        return BorderFactory.createCompoundBorder(
            BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(1, 1, 0, 1, ColorScheme.BORDER_COLOR),
                BorderFactory.createMatteBorder(0, 0, 1, 0, bottom)
            ),
            new EmptyBorder(5, 10, 4, 10)
        );
    }

    private static void setValue(StatusRow row, String text) {
        SwingUtilities.invokeLater(() -> row.setValue(text));
    }
}
