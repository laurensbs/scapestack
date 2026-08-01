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
import java.util.ArrayList;
import java.util.List;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/** RuneLite-native sidebar that answers “what should I do now?” in 225px. */
final class ScapestackSyncPanel extends PluginPanel {
    private static final Color PAGE = ColorScheme.DARK_GRAY_COLOR;
    private static final Color CARD = ColorScheme.DARKER_GRAY_COLOR;
    private static final Color CONTROL = ColorScheme.DARK_GRAY_COLOR;
    private static final Color CONTROL_HOVER = ColorScheme.DARKER_GRAY_HOVER_COLOR;
    private static final Color KEY = ColorScheme.LIGHT_GRAY_COLOR;
    private static final Color VALUE = Color.WHITE;
    private static final Color ACCENT = ColorScheme.BRAND_ORANGE;

    private static final int CARD_PADDING = 10;
    private static final int CARD_GAP = 5;
    private static final int ROW_GAP = 4;
    private static final int CONTROL_HEIGHT = 30;
    // Swing HTML maps px to 1.3pt. PluginPanel has 193 real content pixels,
    // so pt is required here or the final word on wrapped rows gets clipped.
    private static final String WRAP = "width:"
        + (PANEL_WIDTH - (BORDER_OFFSET * 2) - (CARD_PADDING * 2)) + "pt";

    private final BooleanSupplier syncOnLogin;
    private final Consumer<Boolean> setSyncOnLogin;
    private final Runnable syncNow;
    private final Runnable openBrowser;
    private final Consumer<String> approveBrowserCode;
    private final ItemSpriteLoader spriteLoader;

    private final JLabel answerSprite = new JLabel();
    private final JLabel answerTitle = heading("Sync once for your next trip");
    private final WrappedLabel answerDetail = copy("RuneLite will send the data you enabled and put the answer here.");
    private final StatusRow stopAt = new StatusRow("Stop at", "One useful trip");
    private final StatusRow goal = new StatusRow("Goal", "Not measured yet");
    private final WrappedLabel timers = copy("");
    private final WrappedLabel bankInsight = copy("");
    private final WrappedLabel status = copy("Not synced yet");
    private final JButton anotherButton = primaryButton("Get answer");
    private final JButton loginToggle = button("Sync on login: off");
    private final JPanel pairingBody = new JPanel();
    private final List<ServerResponseSummary.PanelAnswer> answers = new ArrayList<>();
    private int answerIndex;

    ScapestackSyncPanel(
        ScapestackSyncConfig config,
        ConfigManager configManager,
        Runnable syncNow,
        Runnable openBrowser,
        Consumer<String> approveBrowserCode,
        ItemSpriteLoader spriteLoader
    ) {
        this(
            config::autoSync,
            enabled -> configManager.setConfiguration(
                ScapestackSyncPlugin.CONFIG_GROUP,
                ScapestackSyncPlugin.KEY_AUTO_SYNC,
                enabled
            ),
            syncNow,
            openBrowser,
            approveBrowserCode,
            spriteLoader
        );
    }

    /** Narrow constructor makes the actual Swing behavior testable without ConfigManager. */
    ScapestackSyncPanel(
        BooleanSupplier syncOnLogin,
        Consumer<Boolean> setSyncOnLogin,
        Runnable syncNow,
        Runnable openBrowser,
        Consumer<String> approveBrowserCode,
        ItemSpriteLoader spriteLoader
    ) {
        this.syncOnLogin = syncOnLogin;
        this.setSyncOnLogin = setSyncOnLogin;
        this.syncNow = syncNow;
        this.openBrowser = openBrowser;
        this.approveBrowserCode = approveBrowserCode;
        this.spriteLoader = spriteLoader;

        setLayout(new BorderLayout());
        setBackground(PAGE);
        setBorder(new EmptyBorder(BORDER_OFFSET, BORDER_OFFSET, BORDER_OFFSET, BORDER_OFFSET));

        JPanel content = new JPanel();
        content.setLayout(new BoxLayout(content, BoxLayout.Y_AXIS));
        content.setBackground(PAGE);
        content.add(heading("Scapestack"));
        content.add(Box.createVerticalStrut(CARD_GAP));
        content.add(answerCard());
        content.add(Box.createVerticalStrut(CARD_GAP));
        content.add(controlCard());
        add(content, BorderLayout.NORTH);

        anotherButton.addActionListener(event -> showAnotherAnswer());
        loginToggle.addActionListener(event -> {
            setSyncOnLogin.accept(!syncOnLogin.getAsBoolean());
            refresh();
        });
        refresh();
    }

    static BufferedImage createIcon() {
        BufferedImage image = new BufferedImage(32, 32, BufferedImage.TYPE_INT_ARGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        graphics.setColor(ACCENT);
        graphics.setFont(FontManager.getRunescapeBoldFont().deriveFont(28f));
        FontMetrics metrics = graphics.getFontMetrics();
        int x = (32 - metrics.stringWidth("S")) / 2;
        int y = (32 - metrics.getHeight()) / 2 + metrics.getAscent();
        graphics.drawString("S", x, y);
        graphics.dispose();
        return image;
    }

    void setStatus(String value) {
        SwingUtilities.invokeLater(() -> status.setCopy(value));
    }

    void setLastSync(String value) {
        setStatus(value == null || value.isBlank() ? "Not synced yet" : value);
    }

    void setTimers(String value) {
        SwingUtilities.invokeLater(() -> timers.setCopy(value));
    }

    void setBankInsight(String value) {
        SwingUtilities.invokeLater(() -> bankInsight.setCopy(value));
    }

    void setReceipt(ServerResponseSummary.PanelReceipt receipt) {
        SwingUtilities.invokeLater(() -> {
            answers.clear();
            if (receipt != null) answers.addAll(receipt.answers);
            answerIndex = 0;
            if (!answers.isEmpty()) renderAnswer(answers.get(0));
            bankInsight.setCopy(receipt == null ? "" : receipt.bankInsight);
            anotherButton.setText(answers.size() > 1 ? "Something else" : "Refresh answer");
            revalidate();
            repaint();
        });
    }

    void refresh() {
        SwingUtilities.invokeLater(() -> {
            loginToggle.setText("Sync on login: " + (syncOnLogin.getAsBoolean() ? "on" : "off"));
            revalidate();
            repaint();
        });
    }

    private JPanel answerCard() {
        JPanel panel = card();
        JPanel answer = new JPanel(new BorderLayout(CARD_GAP, 0));
        answer.setOpaque(false);
        answer.setAlignmentX(Component.LEFT_ALIGNMENT);
        answer.setMaximumSize(new Dimension(Integer.MAX_VALUE, 48));
        answerSprite.setVisible(false);
        JPanel words = new JPanel();
        words.setLayout(new BoxLayout(words, BoxLayout.Y_AXIS));
        words.setOpaque(false);
        stack(words, answerTitle, answerDetail);
        answer.add(answerSprite, BorderLayout.WEST);
        answer.add(words, BorderLayout.CENTER);
        stack(
            panel,
            eyebrow("NOW"),
            answer,
            Box.createVerticalStrut(ROW_GAP),
            stopAt,
            goal,
            Box.createVerticalStrut(ROW_GAP),
            timers,
            bankInsight,
            Box.createVerticalStrut(ROW_GAP),
            anotherButton
        );
        return panel;
    }

    private JPanel controlCard() {
        JPanel panel = card();
        JTextField code = new JTextField();
        code.setToolTipText("Scapestack connection code");
        code.setAlignmentX(Component.LEFT_ALIGNMENT);
        code.setMaximumSize(new Dimension(Integer.MAX_VALUE, CONTROL_HEIGHT));
        code.setBackground(PAGE);
        code.setForeground(VALUE);
        code.setCaretColor(VALUE);

        JButton approve = button("Approve connection");
        approve.addActionListener(event -> {
            String value = code.getText();
            if (PairingClient.normalizeCode(value).length() != 8) {
                setStatus("Enter the 8-character code");
                return;
            }
            approveBrowserCode.accept(value);
        });

        pairingBody.setLayout(new BoxLayout(pairingBody, BoxLayout.Y_AXIS));
        pairingBody.setBackground(CARD);
        pairingBody.setAlignmentX(Component.LEFT_ALIGNMENT);
        stack(pairingBody, copy("Browser blocked? Get a code on Scapestack and enter it here."), code, approve);
        pairingBody.setVisible(false);

        JButton connect = primaryButton("Connect");
        connect.addActionListener(event -> openBrowser.run());
        JButton fallback = button("Enter code instead");
        fallback.addActionListener(event -> {
            pairingBody.setVisible(!pairingBody.isVisible());
            panel.revalidate();
            panel.repaint();
        });
        stack(panel, loginToggle, status, connect, fallback, pairingBody);
        return panel;
    }

    private void showAnotherAnswer() {
        if (answers.size() < 2) {
            setStatus("Refreshing answer");
            syncNow.run();
            return;
        }
        answerIndex = (answerIndex + 1) % answers.size();
        renderAnswer(answers.get(answerIndex));
    }

    private void renderAnswer(ServerResponseSummary.PanelAnswer answer) {
        answerTitle.setText(answer.title);
        answerDetail.setCopy(answer.detail);
        stopAt.setValue(answer.stopAt);
        goal.setValue(answer.current);
        answerSprite.setIcon(null);
        answerSprite.setVisible(answer.spriteItemId != null);
        if (answer.spriteItemId != null) spriteLoader.load(answer.spriteItemId, answerSprite);
    }

    private static JPanel card() {
        JPanel panel = new JPanel();
        panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
        panel.setBackground(CARD);
        panel.setBorder(new EmptyBorder(CARD_PADDING, CARD_PADDING, CARD_PADDING, CARD_PADDING));
        panel.setAlignmentX(Component.LEFT_ALIGNMENT);
        return panel;
    }

    private static void stack(JPanel parent, Component... children) {
        for (int index = 0; index < children.length; index++) {
            if (index > 0) parent.add(Box.createVerticalStrut(ROW_GAP));
            parent.add(children[index]);
        }
    }

    private static JLabel heading(String text) {
        JLabel label = new JLabel(text);
        label.setForeground(VALUE);
        label.setFont(FontManager.getRunescapeBoldFont());
        label.setAlignmentX(Component.LEFT_ALIGNMENT);
        return label;
    }

    private static JLabel eyebrow(String text) {
        JLabel label = heading(text);
        label.setForeground(ACCENT);
        return label;
    }

    private static WrappedLabel copy(String text) {
        return new WrappedLabel(text);
    }

    private static String html(String value) {
        if (value == null) return "";
        return value
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;");
    }

    private static final class WrappedLabel extends JLabel {
        WrappedLabel(String value) {
            setForeground(KEY);
            setFont(FontManager.getRunescapeSmallFont());
            setAlignmentX(Component.LEFT_ALIGNMENT);
            setCopy(value);
        }

        void setCopy(String value) {
            boolean shown = value != null && !value.isBlank();
            setText(shown ? "<html><body style='" + WRAP + "'>" + html(value) + "</body></html>" : "");
            setVisible(shown);
        }
    }

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
                + "<span style='color:#A5A5A5'>" + html(key) + ":</span> "
                + "<span style='color:#FFFFFF'>" + html(shown) + "</span>"
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
            public void mouseEntered(MouseEvent event) {
                button.setBackground(CONTROL_HOVER);
            }

            @Override
            public void mouseExited(MouseEvent event) {
                button.setBackground(CONTROL);
            }
        });
        return button;
    }

    private static JButton primaryButton(String text) {
        JButton button = button(text);
        button.setBorder(edge(ACCENT));
        return button;
    }

    private static Border edge(Color bottom) {
        return BorderFactory.createCompoundBorder(
            BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(1, 1, 0, 1, ColorScheme.BORDER_COLOR),
                BorderFactory.createMatteBorder(0, 0, 1, 0, bottom)
            ),
            new EmptyBorder(5, 10, 4, 10)
        );
    }

    @FunctionalInterface
    interface ItemSpriteLoader {
        void load(int itemId, JLabel label);
    }
}
