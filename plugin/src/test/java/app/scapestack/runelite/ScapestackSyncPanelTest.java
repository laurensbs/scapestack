package app.scapestack.runelite;

import org.junit.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class ScapestackSyncPanelTest {

    @Test
    public void panelCopyIsProductFocusedAndHidesDeveloperDetails() throws Exception {
        String source = Files.readString(
            Path.of("src/main/java/app/scapestack/runelite/ScapestackSyncPanel.java"),
            StandardCharsets.UTF_8
        );

        assertTrue(source.contains("ScapeStack Sync"));
        assertTrue(source.contains("Sync now"));
        assertTrue(source.contains("Account mode"));
        assertTrue(source.contains("Last sync"));
        assertTrue(source.contains("What syncs"));
        assertTrue(source.contains("Bank items only when bank checks are on"));
        assertTrue(source.contains("Open Collection Log once"));
        assertTrue(source.contains("Troubleshooting"));

        String lower = source.toLowerCase();
        assertFalse(lower.contains("paste endpoint"));
        assertFalse(lower.contains("sync url"));
        assertFalse(lower.contains("payload"));
    }
}
