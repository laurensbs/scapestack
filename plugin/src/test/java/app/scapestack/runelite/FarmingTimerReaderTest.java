package app.scapestack.runelite;

import org.junit.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

public class FarmingTimerReaderTest {
    private static final String CAPTURED_AT = "2026-07-18T12:34:56Z";
    private static final long NOW = Instant.parse(CAPTURED_AT).getEpochSecond();

    private static FarmingTimerReader.Context context() {
        return new FarmingTimerReader.Context(NOW, null, null, false);
    }

    // ------------------------------------------------------------ honesty

    @Test
    public void noStoredPatchIsUnknownRatherThanAnEmptyFarm() {
        FarmingTimerReader.Result result = FarmingTimerReader.read(
            FarmingTimerReader.birdHouseSlots(),
            key -> null,
            context(),
            CAPTURED_AT
        );

        assertEquals("not-loaded", result.state);
        assertFalse(result.isAvailable());
        assertTrue(result.rows.isEmpty());
        assertEquals("farming-patches-not-observed", result.reason);
        assertNull(result.capturedAt);
    }

    @Test
    public void everyLookupFailingIsUnavailableNotEmpty() {
        FarmingTimerReader.Result result = FarmingTimerReader.read(
            FarmingTimerReader.birdHouseSlots(),
            key -> { throw new IllegalStateException("no rs profile"); },
            context(),
            CAPTURED_AT
        );

        assertEquals("unavailable", result.state);
        assertEquals("farming-config-unavailable", result.reason);
    }

    @Test
    public void anEmptyCatalogIsUnavailable() {
        FarmingTimerReader.Result result = FarmingTimerReader.read(
            new ArrayList<>(),
            key -> "1:2",
            context(),
            CAPTURED_AT
        );
        assertEquals("unavailable", result.state);
    }

    @Test
    public void unparseableStoredValuesNeverBecomeState() {
        Map<String, String> store = new HashMap<>();
        for (FarmingTimerReader.Slot slot : FarmingTimerReader.birdHouseSlots()) {
            store.put(slot.configKey, "not-a-patch");
        }
        FarmingTimerReader.Result result = FarmingTimerReader.read(
            FarmingTimerReader.birdHouseSlots(),
            store::get,
            context(),
            CAPTURED_AT
        );
        assertEquals("not-loaded", result.state);
        assertEquals(0, result.observedSlots);
    }

    // ------------------------------------------------------------ bird houses

    @Test
    public void aSeededBirdHouseCountsDownFiftyMinutesFromWhenItWasSeen() {
        // varp 21 -> (21-1)/3 = 6 = YEW, and 21 % 3 == 0 -> seeded.
        long seededAt = NOW - (10 * 60);
        FarmingTimerReader.Row row = FarmingTimerReader.decodeBirdHouse("bh", 21, seededAt, context());

        assertNotNull(row);
        assertEquals("Yew Bird House", row.crop);
        assertEquals("growing", row.state);
        assertEquals(Instant.ofEpochSecond(seededAt + 3000).toString(), row.readyAt);
    }

    @Test
    public void aSeededBirdHouseThatFinishedWhileLoggedOutIsReady() {
        FarmingTimerReader.Row row = FarmingTimerReader.decodeBirdHouse("bh", 21, NOW - 86_400, context());

        assertEquals("ready", row.state);
        assertNull("ready now has no future timestamp", row.readyAt);
    }

    @Test
    public void anEmptySpaceAndABuiltButUnseededHouseAreBothEmpty() {
        FarmingTimerReader.Row empty = FarmingTimerReader.decodeBirdHouse("bh", 0, NOW - 60, context());
        assertEquals("empty", empty.state);
        assertNull(empty.crop);

        // varp 20 -> YEW, 20 % 3 != 0 -> built, no seeds in it.
        FarmingTimerReader.Row built = FarmingTimerReader.decodeBirdHouse("bh", 20, NOW - 60, context());
        assertEquals("empty", built.state);
        assertEquals("Yew Bird House", built.crop);
        assertNull(built.readyAt);
    }

    @Test
    public void aVarpOutsideTheEncodingIsDroppedRatherThanGuessed() {
        assertNull(FarmingTimerReader.decodeBirdHouse("bh", 99, NOW - 60, context()));
        assertNull(FarmingTimerReader.decodeBirdHouse("bh", -1, NOW - 60, context()));
    }

    @Test
    public void birdHouseSlotsUseRuneLitesOwnConfigKeys() {
        List<FarmingTimerReader.Slot> slots = FarmingTimerReader.birdHouseSlots();
        assertEquals(4, slots.size());
        // BirdHouseTracker stores under "birdhouse." + varp, varps 1626..1629.
        assertEquals("birdhouse.1626", slots.get(0).configKey);
        assertEquals("birdhouse.1629", slots.get(3).configKey);
        assertEquals("birdhouse-mushroom-meadow-north", slots.get(0).id);
    }

    // ------------------------------------------------------------ ordering and bounds

    @Test
    public void rowsAreOrderedSoTruncationDropsTheLeastUsefulFirst() {
        List<FarmingTimerReader.Slot> slots = new ArrayList<>();
        Map<String, String> store = new HashMap<>();
        // 70 rows from one decoder we control, so the cap is exercised.
        for (int i = 0; i < 70; i++) {
            final String state = i < 5 ? "empty" : i < 10 ? "ready" : "growing";
            final String readyAt = "growing".equals(state)
                ? Instant.ofEpochSecond(NOW + (70 - i) * 60L).toString()
                : null;
            String id = "patch-" + i;
            slots.add(new FarmingTimerReader.Slot(
                id,
                "key-" + i,
                (rowId, value, observedAt, ctx) -> new FarmingTimerReader.Row(rowId, "Ranarr", state, readyAt)
            ));
            store.put("key-" + i, "1:" + (NOW - 600));
        }

        FarmingTimerReader.Result result = FarmingTimerReader.read(slots, store::get, context(), CAPTURED_AT);

        assertTrue(result.isAvailable());
        assertEquals(FarmingTimerReader.MAX_ROWS, result.rows.size());
        assertEquals(70, result.observedSlots);
        assertEquals("runelite-timetracking-observed-patches-truncated", result.reason);
        assertEquals("ready", result.rows.get(0).state);
        for (FarmingTimerReader.Row row : result.rows) {
            assertFalse("empty rows are dropped before growing ones", "empty".equals(row.state));
        }
    }

    @Test
    public void aReadyAtBeyondAnythingThatGrowsIsDroppedRatherThanSent() {
        // The server rejects the whole payload for a readyAt more than 8 days
        // out; a junk stored timestamp must not be able to do that.
        FarmingTimerReader.Row row = FarmingTimerReader.decodeBirdHouse(
            "bh",
            21,
            NOW + (30L * 24 * 3600),
            context()
        );
        assertEquals("growing", row.state);
        assertNull(row.readyAt);
    }

    // ------------------------------------------------------------ tick maths

    @Test
    public void tickTimeAlignsToTheFarmTickGrid() {
        FarmingTimerReader.Context ctx = context();
        // 5-minute ticks: any time inside a tick resolves to that tick's start.
        assertEquals(300L, FarmingTimerReader.tickTime(5, 0, 599, ctx));
        assertEquals(600L, FarmingTimerReader.tickTime(5, 1, 599, ctx));
    }

    @Test
    public void tickTimeAppliesThePlayersOwnFarmTickOffset() {
        FarmingTimerReader.Context withOffset = new FarmingTimerReader.Context(NOW, 2, 40, false);
        FarmingTimerReader.Context without = context();
        assertFalse(
            FarmingTimerReader.tickTime(5, 0, 599, withOffset)
                == FarmingTimerReader.tickTime(5, 0, 599, without)
        );
    }

    @Test
    public void slugIsAsciiHyphenatedAndBounded() {
        assertEquals("fruit-tree-anglers-retreat", FarmingTimerReader.slug("FRUIT_TREE", "Anglers' Retreat", ""));
        assertEquals("allotment-catherby-north", FarmingTimerReader.slug("ALLOTMENT", "Catherby", "North"));
        assertTrue(FarmingTimerReader.slug("x".repeat(200)).length() <= 64);
    }

    @Test
    public void storedValuesAreParsedInRuneLitesOwnEncoding() {
        assertNull(FarmingTimerReader.parseStoredValue("7"));
        assertNull(FarmingTimerReader.parseStoredValue("7:0"));
        assertNull(FarmingTimerReader.parseStoredValue("seven:8"));
        long[] parsed = FarmingTimerReader.parseStoredValue("7:1700000000");
        assertEquals(7L, parsed[0]);
        assertEquals(1_700_000_000L, parsed[1]);
    }

    // ------------------------------------------------------------ the real RuneLite model

    /**
     * The load-bearing one. Everything above runs against decoders this test
     * file wrote; this runs against the pinned client jar, which is the only
     * thing that can prove the reflective catalog still resolves. If RuneLite
     * moves FarmingWorld, PatchImplementation or PatchState, this fails here
     * instead of silently reporting an empty farm to every player.
     */
    @Test
    public void theCatalogResolvesAgainstThePinnedRuneLiteClient() {
        FarmingTimerReader.Catalog.reset();
        List<FarmingTimerReader.Slot> slots = FarmingTimerReader.Catalog.farmingSlots();

        assertNotNull("RuneLite's farming model did not resolve", slots);
        // 107 patches ship in client 1.12.33; compost bins are excluded here.
        assertTrue("expected the whole farming world, got " + slots.size(), slots.size() > 70);

        Set<String> ids = new HashSet<>();
        Set<String> keys = new HashSet<>();
        for (FarmingTimerReader.Slot slot : slots) {
            assertTrue("id must be a bounded slug: " + slot.id, slot.id.length() <= 64 && !slot.id.isEmpty());
            assertTrue("configKey must be <regionId>.<varbit>: " + slot.configKey,
                slot.configKey.matches("\\d+\\.\\d+"));
            assertTrue("duplicate patch id: " + slot.id, ids.add(slot.id));
            keys.add(slot.configKey);
        }
        assertTrue(ids.contains("herb-catherby"));
        assertTrue(ids.contains("allotment-catherby-north"));
        assertFalse("compost bins carry no timer worth planning around",
            ids.stream().anyMatch(id -> id.startsWith("compost")));
        assertTrue(keys.size() > 70);
    }

    /**
     * Decoding through RuneLite's own PatchImplementation tables. A Catherby
     * herb patch storing varbit 4 is a growing herb; the growth duration comes
     * from Produce, not from anything written here.
     */
    @Test
    public void aRealHerbPatchDecodesToAGrowingCropWithARealDeadline() {
        FarmingTimerReader.Catalog.reset();
        List<FarmingTimerReader.Slot> slots = FarmingTimerReader.Catalog.farmingSlots();
        assertNotNull(slots);

        FarmingTimerReader.Slot herb = slots.stream()
            .filter(s -> "herb-catherby".equals(s.id))
            .findFirst()
            .orElseThrow(() -> new AssertionError("Catherby herb patch missing from the catalog"));

        Map<String, String> store = new HashMap<>();
        // Guam, freshly planted, seen one minute ago.
        store.put(herb.configKey, "4:" + (NOW - 60));

        FarmingTimerReader.Result result = FarmingTimerReader.read(
            Arrays.asList(herb),
            store::get,
            context(),
            CAPTURED_AT
        );

        assertTrue(result.reason, result.isAvailable());
        assertEquals(1, result.rows.size());
        FarmingTimerReader.Row row = result.rows.get(0);
        assertEquals("herb-catherby", row.patch);
        assertEquals("growing", row.state);
        assertNotNull("a growing herb has a deadline", row.readyAt);
        long readyAt = Instant.parse(row.readyAt).getEpochSecond();
        // Herbs are 20-minute ticks over 5 stages: 80 minutes of growth left.
        assertTrue("readyAt must be in the future", readyAt > NOW);
        assertTrue("readyAt must be inside the server's window", readyAt < NOW + (8L * 24 * 3600));
        assertNotNull(row.crop);
    }

    @Test
    public void anOldStoredPatchReadsAsReadyRatherThanStillGrowing() {
        FarmingTimerReader.Catalog.reset();
        FarmingTimerReader.Slot herb = FarmingTimerReader.Catalog.farmingSlots().stream()
            .filter(s -> "herb-catherby".equals(s.id))
            .findFirst()
            .orElseThrow(AssertionError::new);

        Map<String, String> store = new HashMap<>();
        store.put(herb.configKey, "4:" + (NOW - (7L * 24 * 3600)));

        FarmingTimerReader.Result result = FarmingTimerReader.read(
            Arrays.asList(herb),
            store::get,
            context(),
            CAPTURED_AT
        );

        assertTrue(result.isAvailable());
        assertEquals("ready", result.rows.get(0).state);
        assertNull(result.rows.get(0).readyAt);
    }
}
