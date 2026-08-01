package app.scapestack.runelite;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class ServerResponseSummaryTest {

    @Test
    public void extractsErrorFromJsonBody() {
        assertEquals(
            "Token does not match RSN claim",
            ServerResponseSummary.errorFromBody("{\"ok\":false,\"error\":\"Token does not match RSN claim\"}")
        );
    }

    @Test
    public void failureDetailPrefersServerError() {
        assertEquals(
            "RSN not found on Hiscores",
            ServerResponseSummary.failureDetail(404, "{\"error\":\"RSN not found on Hiscores\"}")
        );
    }

    @Test
    public void failureDetailFallsBackToHttpStatus() {
        assertEquals(
            "HTTP 500",
            ServerResponseSummary.failureDetail(500, "<html>bad gateway</html>")
        );
    }

    @Test
    public void logDetailIncludesCompactFallbackBody() {
        assertEquals(
            "HTTP 502: upstream unavailable",
            ServerResponseSummary.logDetail(502, " upstream\nunavailable ")
        );
    }

    @Test
    public void extractsAcceptedCountsFromSuccessBody() {
        ServerResponseSummary.AcceptedCounts counts = ServerResponseSummary.acceptedCounts(
            "{\"ok\":true,\"counts\":{\"skills\":24,\"quests\":180,\"diaries\":44,\"collectionLogItems\":612,\"bankItems\":900}}"
        );

        assertEquals(Integer.valueOf(24), counts.skills);
        assertEquals(Integer.valueOf(180), counts.quests);
        assertEquals(Integer.valueOf(44), counts.diaries);
        assertEquals(Integer.valueOf(612), counts.collectionLogItems);
        assertEquals(Integer.valueOf(900), counts.bankItems);
    }

    @Test
    public void ignoresMalformedAcceptedCounts() {
        assertEquals(null, ServerResponseSummary.acceptedCounts("{\"ok\":true}"));
        assertEquals(null, ServerResponseSummary.acceptedCounts("not json"));
    }

    @Test
    public void detectsNewProgressFromSyncSummary() {
        assertEquals(
            true,
            ServerResponseSummary.hasNewProgress("{\"ok\":true,\"syncSummary\":{\"questsCompleted\":[\"Biohazard\"],\"diariesCompleted\":[],\"collectionLogItemIds\":[]}}")
        );
        assertEquals(
            false,
            ServerResponseSummary.hasNewProgress("{\"ok\":true,\"syncSummary\":null}")
        );
        assertEquals(false, ServerResponseSummary.hasNewProgress("not json"));
    }

    @Test
    public void parsesBoundedPanelReceiptWithoutRequiringItFromOlderServers() {
        ServerResponseSummary.PanelReceipt receipt = ServerResponseSummary.panelReceipt(
            "{\"ok\":true,\"panel\":{\"answers\":[{"
                + "\"title\":\"Vorkath\","
                + "\"detail\":\"Blowpipe + dragon darts are in your bank.\","
                + "\"stopAt\":\"20 kills\","
                + "\"current\":\"7 / 20\","
                + "\"left\":\"~34 min\","
                + "\"spriteItemId\":7462}],"
                + "\"bankInsight\":\"14,500,000 gp banked. Ahrim's robeskirt — 1,572,490 gp. That finishes Ahrim's.\"}}"
        );

        assertEquals(1, receipt.answers.size());
        assertEquals("Vorkath", receipt.answers.get(0).title);
        assertEquals("20 kills", receipt.answers.get(0).stopAt);
        assertEquals("7 / 20", receipt.answers.get(0).current);
        assertEquals("~34 min", receipt.answers.get(0).left);
        assertEquals(Integer.valueOf(7462), receipt.answers.get(0).spriteItemId);
        assertEquals(
            "14,500,000 gp banked. Ahrim's robeskirt — 1,572,490 gp. That finishes Ahrim's.",
            receipt.bankInsight
        );
        assertEquals(null, ServerResponseSummary.panelReceipt("{\"ok\":true}"));
    }
}
