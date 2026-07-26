package app.scapestack.runelite;

import net.runelite.api.gameval.VarPlayerID;
import net.runelite.client.config.ConfigManager;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Farming-patch and bird-house timers, read out of RuneLite's own Time
 * Tracking store.
 *
 * <h2>Where the numbers come from</h2>
 *
 * Nothing here is recalled. RuneLite ships a complete farming model in
 * {@code net.runelite.client.plugins.timetracking.farming}: {@code FarmingWorld}
 * holds every patch in the game (107 of them in client 1.12.33) keyed by region
 * and varbit, {@code PatchImplementation.forVarbitValue} decodes a raw patch
 * varbit into {@code (produce, cropState, stage)}, and {@code Produce} carries
 * the growth tick rate and stage count per crop. Every duration this class
 * reports comes from those tables, so it stays correct when Jagex changes a
 * growth time and RuneLite follows.
 *
 * <h2>Cross-session persistence already exists</h2>
 *
 * The stock Time Tracking plugin writes what it sees to the RS-profile config
 * group {@code timetracking}:
 *
 * <ul>
 *   <li>patches under key {@code <regionId>.<varbit>}, value {@code <varbitValue>:<unixSeconds>}</li>
 *   <li>bird houses under key {@code birdhouse.<varp>}, value {@code <varp>:<unixSeconds>}</li>
 * </ul>
 *
 * That store survives logout and client restarts, which is the whole reason a
 * farm timer is worth sending at all. We read it; we never write to it. A
 * player who has turned Time Tracking off, or who has never walked past a
 * patch, has no entries — and that reads as unknown here, not as empty.
 *
 * <h2>Why reflection</h2>
 *
 * {@code FarmingWorld}, {@code FarmingPatch}, {@code PatchState} and
 * {@code PatchImplementation.forVarbitValue} are package-private. The
 * alternative is transcribing 107 patch definitions and 23 varbit decode
 * tables into this repo, where they would rot silently the first time a new
 * farming patch ships. Reflection keeps RuneLite the single source of truth,
 * and every lookup is resolved once behind {@link Catalog}: if any of it moves,
 * the whole domain reports unavailable rather than guessing.
 */
final class FarmingTimerReader {

    /** The server accepts at most 64 rows per snapshot. */
    static final int MAX_ROWS = 64;
    static final String CONFIG_GROUP = "timetracking";
    private static final String FARM_TICK_OFFSET = "farmTickOffset";
    private static final String FARM_TICK_OFFSET_PRECISION = "farmTickOffsetPrecision";
    private static final String BIRD_HOUSE_KEY_PREFIX = "birdhouse.";

    /**
     * RuneLite's BirdHouseTracker.BIRD_HOUSE_DURATION — "average time taken to
     * harvest 10 birds", 50 minutes. Bird houses are a separate mechanism from
     * farming: four VarPlayers on Fossil Island, one fixed duration, no growth
     * stages and no disease. They share only the config group.
     */
    private static final long BIRD_HOUSE_SECONDS = 50L * 60L;

    /** BirdHouse enum order, from RuneLite's BirdHouse.java. Index = (varp - 1) / 3. */
    private static final String[] BIRD_HOUSE_NAMES = {
        "Bird House",
        "Oak Bird House",
        "Willow Bird House",
        "Teak Bird House",
        "Maple Bird House",
        "Mahogany Bird House",
        "Yew Bird House",
        "Magic Bird House",
        "Redwood Bird House"
    };

    /** The four bird-house spaces, from RuneLite's BirdHouseSpace.java. */
    private static final int[] BIRD_HOUSE_VARPS = {
        VarPlayerID.BIRDHOUSE_TRANSMIT_A,
        VarPlayerID.BIRDHOUSE_TRANSMIT_B,
        VarPlayerID.BIRDHOUSE_TRANSMIT_C,
        VarPlayerID.BIRDHOUSE_TRANSMIT_D
    };
    private static final String[] BIRD_HOUSE_SPACE_NAMES = {
        "Mushroom Meadow North",
        "Mushroom Meadow South",
        "Verdant Valley Northeast",
        "Verdant Valley Southwest"
    };

    /** The five states the server's contract allows. */
    static final String READY = "ready";
    static final String GROWING = "growing";
    static final String DISEASED = "diseased";
    static final String DEAD = "dead";
    static final String EMPTY = "empty";

    /**
     * The server bounds readyAt to [now - 30d, now + 8d]. Nothing in the game
     * grows past 4.5 days (redwood: 640-minute ticks, 11 stages), so a value
     * outside the window means the stored entry is junk. We drop the timestamp
     * rather than the row, and never risk the whole payload being rejected.
     */
    private static final long MAX_FUTURE_SECONDS = 7L * 24L * 60L * 60L;

    @FunctionalInterface
    interface ConfigLookup {
        String get(String key) throws Exception;
    }

    @FunctionalInterface
    interface Decoder {
        /** Returns null when the stored value decodes to nothing we can name. */
        Row decode(String id, int value, long observedAtSeconds, Context context);
    }

    /** One thing with a growth clock: a farming patch, or a bird house. */
    static final class Slot {
        final String id;
        final String configKey;
        final Decoder decoder;

        Slot(String id, String configKey, Decoder decoder) {
            this.id = id;
            this.configKey = configKey;
            this.decoder = decoder;
        }
    }

    static final class Row {
        final String patch;
        final String crop;
        final String state;
        final String readyAt;

        Row(String patch, String crop, String state, String readyAt) {
            this.patch = bound(patch);
            // The server rejects the whole payload for a crop name over 64
            // characters, so one long produce name must not be able to lose a
            // player their entire sync.
            this.crop = crop == null || crop.trim().isEmpty() ? null : bound(crop.trim());
            this.state = state;
            this.readyAt = readyAt;
        }

        private static String bound(String value) {
            return value != null && value.length() > 64 ? value.substring(0, 64) : value;
        }
    }

    /** Everything the decoders need that is not the stored value itself. */
    static final class Context {
        final long nowSeconds;
        final Integer tickOffsetMinutes;
        final Integer tickOffsetPrecisionMinutes;
        /** Leagues worlds tick farming at 1 minute instead of 5. */
        final boolean seasonalWorld;

        Context(long nowSeconds, Integer tickOffsetMinutes, Integer tickOffsetPrecisionMinutes, boolean seasonalWorld) {
            this.nowSeconds = nowSeconds;
            this.tickOffsetMinutes = tickOffsetMinutes;
            this.tickOffsetPrecisionMinutes = tickOffsetPrecisionMinutes;
            this.seasonalWorld = seasonalWorld;
        }
    }

    static final class Result {
        final String state;
        final List<Row> rows;
        /** Slots RuneLite has actually stored something for. */
        final int observedSlots;
        /** Slots this reader knows how to look up at all. */
        final int trackedSlots;
        final String capturedAt;
        final String reason;

        private Result(
            String state,
            List<Row> rows,
            int observedSlots,
            int trackedSlots,
            String capturedAt,
            String reason
        ) {
            this.state = state;
            this.rows = rows == null
                ? Collections.emptyList()
                : Collections.unmodifiableList(new ArrayList<>(rows));
            this.observedSlots = observedSlots;
            this.trackedSlots = trackedSlots;
            this.capturedAt = capturedAt;
            this.reason = reason;
        }

        static Result available(List<Row> rows, int observedSlots, int trackedSlots, String capturedAt, boolean truncated) {
            return new Result(
                "available",
                rows,
                observedSlots,
                trackedSlots,
                capturedAt,
                truncated
                    ? "runelite-timetracking-observed-patches-truncated"
                    : "runelite-timetracking-observed-patches"
            );
        }

        static Result notLoaded(int trackedSlots, String reason) {
            return new Result("not-loaded", null, 0, trackedSlots, null, reason);
        }

        static Result unavailable(String reason) {
            return new Result("unavailable", null, 0, 0, null, reason);
        }

        boolean isAvailable() {
            return "available".equals(state);
        }
    }

    private FarmingTimerReader() {}

    /** Live path. Reads the current RS profile's Time Tracking store. */
    static Result read(ConfigManager configManager, boolean seasonalWorld, String capturedAt) {
        if (configManager == null) {
            return Result.unavailable("farming-config-unavailable");
        }
        List<Slot> slots = new ArrayList<>(birdHouseSlots());
        List<Slot> patches = Catalog.farmingSlots();
        if (patches == null) {
            // The Time Tracking model moved. Saying so beats shipping four
            // bird houses and calling the domain covered.
            return Result.unavailable("runelite-timetracking-model-unavailable");
        }
        slots.addAll(patches);

        Context context = new Context(
            Instant.now().getEpochSecond(),
            readInt(configManager, FARM_TICK_OFFSET),
            readInt(configManager, FARM_TICK_OFFSET_PRECISION),
            seasonalWorld
        );
        return read(
            slots,
            key -> configManager.getRSProfileConfiguration(CONFIG_GROUP, key),
            context,
            capturedAt
        );
    }

    /** Pure path — the one the tests drive. */
    static Result read(List<Slot> slots, ConfigLookup lookup, Context context, String capturedAt) {
        if (slots == null || slots.isEmpty()) {
            return Result.unavailable("farming-patch-catalog-unavailable");
        }
        if (lookup == null || context == null) {
            return Result.unavailable("farming-config-unavailable");
        }

        int observed = 0;
        int lookupFailures = 0;
        List<Row> rows = new ArrayList<>();
        for (Slot slot : slots) {
            String stored;
            try {
                stored = lookup.get(slot.configKey);
            } catch (Exception ignored) {
                lookupFailures++;
                continue;
            }
            if (stored == null || stored.isEmpty()) continue;

            long[] parsed = parseStoredValue(stored);
            if (parsed == null) continue;
            observed++;

            Row row = slot.decoder.decode(slot.id, (int) parsed[0], parsed[1], context);
            if (row != null) rows.add(row);
        }

        if (lookupFailures >= slots.size()) {
            return Result.unavailable("farming-config-unavailable");
        }
        if (observed == 0) {
            // Zero stored entries is not "no crops planted". It is a player who
            // has never walked past a patch with Time Tracking on, and calling
            // that an empty farm would be a lie the website would then act on.
            return Result.notLoaded(slots.size(), "farming-patches-not-observed");
        }
        if (rows.isEmpty()) {
            return Result.notLoaded(slots.size(), "farming-patch-states-unrecognised");
        }

        rows.sort((left, right) -> {
            int byState = Integer.compare(stateRank(left.state), stateRank(right.state));
            if (byState != 0) return byState;
            if (left.readyAt != null && right.readyAt != null) {
                int byTime = left.readyAt.compareTo(right.readyAt);
                if (byTime != 0) return byTime;
            } else if (left.readyAt != null) {
                return -1;
            } else if (right.readyAt != null) {
                return 1;
            }
            return left.patch.compareTo(right.patch);
        });

        boolean truncated = rows.size() > MAX_ROWS;
        if (truncated) rows = new ArrayList<>(rows.subList(0, MAX_ROWS));
        return Result.available(rows, observed, slots.size(), capturedAt, truncated);
    }

    /** Ready first, then what is on a clock, then what needs a decision, then nothing. */
    private static int stateRank(String state) {
        switch (state) {
            case READY: return 0;
            case GROWING: return 1;
            case DISEASED: return 2;
            case DEAD: return 3;
            default: return 4;
        }
    }

    /** {@code <value>:<unixSeconds>}, RuneLite's own encoding. */
    static long[] parseStoredValue(String stored) {
        String[] parts = stored.split(":");
        if (parts.length != 2) return null;
        try {
            int value = Integer.parseInt(parts[0].trim());
            long observedAt = Long.parseLong(parts[1].trim());
            if (observedAt <= 0) return null;
            return new long[] { value, observedAt };
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    // ---------------------------------------------------------------- bird houses

    static List<Slot> birdHouseSlots() {
        List<Slot> slots = new ArrayList<>(BIRD_HOUSE_VARPS.length);
        for (int i = 0; i < BIRD_HOUSE_VARPS.length; i++) {
            slots.add(new Slot(
                slug("birdhouse", BIRD_HOUSE_SPACE_NAMES[i]),
                BIRD_HOUSE_KEY_PREFIX + BIRD_HOUSE_VARPS[i],
                FarmingTimerReader::decodeBirdHouse
            ));
        }
        return slots;
    }

    /**
     * Bird-house varp encoding, from RuneLite's BirdHouse/BirdHouseState:
     * 0 is an empty space, otherwise {@code (varp - 1) / 3} picks the wood and
     * {@code varp % 3 == 0} means it is seeded and filling.
     */
    static Row decodeBirdHouse(String id, int varp, long observedAtSeconds, Context context) {
        if (varp < 0 || varp > BIRD_HOUSE_NAMES.length * 3) return null;
        if (varp == 0) return new Row(id, null, EMPTY, null);

        String wood = BIRD_HOUSE_NAMES[(varp - 1) / 3];
        if (varp % 3 != 0) {
            // Built but not seeded — a house sitting there doing nothing.
            return new Row(id, wood, EMPTY, null);
        }
        long doneAt = observedAtSeconds + BIRD_HOUSE_SECONDS;
        if (doneAt <= context.nowSeconds) {
            return new Row(id, wood, READY, null);
        }
        return new Row(id, wood, GROWING, isoOrNull(doneAt, context.nowSeconds));
    }

    // ---------------------------------------------------------------- farming patches

    /**
     * RuneLite's FarmingTracker#predictPatch, minus the parts that only feed
     * its own panel. Patch state is stored as it looked when the player last
     * stood there; the growth ticks that have passed since are pure arithmetic.
     */
    static Row decodeFarmingPatch(
        String id,
        Object patchImplementation,
        int varbitValue,
        long observedAtSeconds,
        Context context
    ) {
        Object patchState = Catalog.forVarbitValue(patchImplementation, varbitValue);
        if (patchState == null) return null;

        String produceName = Catalog.produceName(patchState);
        String produceConstant = Catalog.produceConstant(patchState);
        String cropState = Catalog.cropStateConstant(patchState);
        if (produceConstant == null || cropState == null) return null;

        // Weeds and a scarecrow are what an unused patch looks like. Reporting
        // them as a growing crop would put "Weeds, ready in 10 minutes" on a
        // plan page.
        if ("WEEDS".equals(produceConstant) || "SCARECROW".equals(produceConstant)) {
            return new Row(id, null, EMPTY, null);
        }

        switch (cropState) {
            case "EMPTY":
                return new Row(id, null, EMPTY, null);
            case "HARVESTABLE":
                return new Row(id, produceName, READY, null);
            case "DISEASED":
                return new Row(id, produceName, DISEASED, null);
            case "DEAD":
                return new Row(id, produceName, DEAD, null);
            case "GROWING":
            case "FILLING":
                break;
            default:
                return null;
        }

        Integer stage = Catalog.stage(patchState);
        Integer stages = Catalog.stages(patchState);
        Integer tickRate = Catalog.tickRate(patchState);
        if (stage == null || stages == null || tickRate == null) return null;
        if (context.seasonalWorld) tickRate = tickRate / 5;
        if (tickRate <= 0 || stages <= 0) {
            // No clock on this one — a compost bin filling, or a state the
            // game does not advance on its own.
            return new Row(id, produceName, GROWING, null);
        }

        long plantedTick = tickTime(tickRate, 0, observedAtSeconds, context);
        long doneAt = tickTime(tickRate, stages - 1 - stage, plantedTick, context);
        if (doneAt <= context.nowSeconds) {
            return new Row(id, produceName, READY, null);
        }
        return new Row(id, produceName, GROWING, isoOrNull(doneAt, context.nowSeconds));
    }

    /**
     * RuneLite's FarmingTracker#getTickTime. Farm ticks land on a fixed grid;
     * the offset is the player's own calibration of where that grid sits.
     */
    static long tickTime(int tickRate, int ticks, long requestedTime, Context context) {
        long offsetSeconds = 0L;
        Integer precision = context.tickOffsetPrecisionMinutes;
        Integer offset = context.tickOffsetMinutes;
        if (precision != null && offset != null && (precision >= tickRate || precision >= 40)) {
            offsetSeconds = (offset % tickRate) * 60L;
        }
        long shifted = requestedTime + offsetSeconds;
        long currentTick = shifted - Math.floorMod(shifted, tickRate * 60L);
        return currentTick + ((long) ticks * tickRate * 60L) - offsetSeconds;
    }

    private static String isoOrNull(long epochSeconds, long nowSeconds) {
        if (epochSeconds > nowSeconds + MAX_FUTURE_SECONDS) return null;
        return Instant.ofEpochSecond(epochSeconds).toString();
    }

    // ---------------------------------------------------------------- ids

    /** Lowercase, hyphenated, ASCII: "Fruit Tree" + "Anglers' Retreat" -> fruit-tree-anglers-retreat. */
    static String slug(String... parts) {
        StringBuilder out = new StringBuilder();
        for (String part : parts) {
            if (part == null) continue;
            String lower = part.trim().toLowerCase(Locale.ROOT);
            for (int i = 0; i < lower.length(); i++) {
                char c = lower.charAt(i);
                if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
                    out.append(c);
                } else if (out.length() > 0 && out.charAt(out.length() - 1) != '-') {
                    out.append('-');
                }
            }
            if (out.length() > 0 && out.charAt(out.length() - 1) != '-') out.append('-');
        }
        while (out.length() > 0 && out.charAt(out.length() - 1) == '-') out.setLength(out.length() - 1);
        String slug = out.toString();
        return slug.length() > 64 ? slug.substring(0, 64) : slug;
    }

    private static Integer readInt(ConfigManager configManager, String key) {
        try {
            return configManager.getRSProfileConfiguration(CONFIG_GROUP, key, int.class);
        } catch (Exception ignored) {
            return null;
        }
    }

    // ---------------------------------------------------------------- reflective catalog

    /**
     * The one place that touches RuneLite's package-private farming model.
     * Everything is resolved once; a single failure anywhere makes
     * {@link #farmingSlots()} return null and the whole domain unavailable.
     */
    static final class Catalog {
        private static final String PKG = "net.runelite.client.plugins.timetracking.farming.";
        private static volatile boolean resolved;
        private static List<Slot> slots;
        private static Method forVarbitValue;
        private static Method patchStateProduce;
        private static Method patchStateCropState;
        private static Method patchStateStage;
        private static Method patchStateStages;
        private static Method patchStateTickRate;
        private static Method produceGetName;

        private Catalog() {}

        static synchronized List<Slot> farmingSlots() {
            if (!resolved) {
                resolved = true;
                try {
                    slots = build();
                } catch (Throwable ex) {
                    slots = null;
                }
            }
            return slots;
        }

        /** Test hook: drop the cache so a test can prove the resolution runs. */
        static synchronized void reset() {
            resolved = false;
            slots = null;
        }

        @SuppressWarnings("unchecked")
        private static List<Slot> build() throws Exception {
            Class<?> implementationClass = Class.forName(PKG + "PatchImplementation");
            forVarbitValue = implementationClass.getDeclaredMethod("forVarbitValue", int.class);
            forVarbitValue.setAccessible(true);

            Class<?> patchStateClass = Class.forName(PKG + "PatchState");
            patchStateProduce = accessible(patchStateClass, "getProduce");
            patchStateCropState = accessible(patchStateClass, "getCropState");
            patchStateStage = accessible(patchStateClass, "getStage");
            patchStateStages = accessible(patchStateClass, "getStages");
            patchStateTickRate = accessible(patchStateClass, "getTickRate");

            Class<?> produceClass = Class.forName(PKG + "Produce");
            produceGetName = accessible(produceClass, "getName");

            Class<?> worldClass = Class.forName(PKG + "FarmingWorld");
            Constructor<?> constructor = worldClass.getDeclaredConstructor();
            constructor.setAccessible(true);
            Object world = constructor.newInstance();
            Method getTabs = accessible(worldClass, "getTabs");
            Map<Object, Set<Object>> tabs = (Map<Object, Set<Object>>) getTabs.invoke(world);
            if (tabs == null || tabs.isEmpty()) return null;

            Class<?> patchClass = Class.forName(PKG + "FarmingPatch");
            Method patchName = accessible(patchClass, "getName");
            Method patchRegion = accessible(patchClass, "getRegion");
            Method patchImplementation = accessible(patchClass, "getImplementation");
            Method patchVarbit = accessible(patchClass, "getVarbit");

            Class<?> regionClass = Class.forName(PKG + "FarmingRegion");
            Method regionName = accessible(regionClass, "getName");
            Method regionId = accessible(regionClass, "getRegionID");

            List<Slot> built = new ArrayList<>();
            Set<String> usedIds = new HashSet<>();
            for (Collection<Object> patches : tabs.values()) {
                if (patches == null) continue;
                for (Object patch : patches) {
                    Object implementation = patchImplementation.invoke(patch);
                    if (implementation == null) continue;
                    String implementationConstant = ((Enum<?>) implementation).name();
                    // A compost bin has no harvest and no clock the player
                    // plans around; leaving it out keeps the 64-row budget for
                    // things that actually finish.
                    if ("COMPOST".equals(implementationConstant) || "BIG_COMPOST".equals(implementationConstant)) {
                        continue;
                    }
                    Object region = patchRegion.invoke(patch);
                    if (region == null) continue;
                    int id = (Integer) regionId.invoke(region);
                    String base = slug(
                        implementationConstant,
                        String.valueOf(regionName.invoke(region)),
                        String.valueOf(patchName.invoke(patch))
                    );
                    String slotId = base;
                    // Two regions can share a name; the region id disambiguates
                    // without making every id ugly.
                    if (!usedIds.add(slotId)) {
                        slotId = slug(base, String.valueOf(id));
                        if (!usedIds.add(slotId)) continue;
                    }
                    String configKey = id + "." + patchVarbit.invoke(patch);
                    final Object boundImplementation = implementation;
                    built.add(new Slot(
                        slotId,
                        configKey,
                        (rowId, value, observedAt, context) ->
                            decodeFarmingPatch(rowId, boundImplementation, value, observedAt, context)
                    ));
                }
            }
            return built.isEmpty() ? null : built;
        }

        private static Method accessible(Class<?> owner, String name) throws NoSuchMethodException {
            Method method = owner.getDeclaredMethod(name);
            method.setAccessible(true);
            return method;
        }

        static Object forVarbitValue(Object implementation, int value) {
            try {
                return forVarbitValue.invoke(implementation, value);
            } catch (Exception ignored) {
                return null;
            }
        }

        static String produceConstant(Object patchState) {
            try {
                Object produce = patchStateProduce.invoke(patchState);
                return produce == null ? null : ((Enum<?>) produce).name();
            } catch (Exception ignored) {
                return null;
            }
        }

        static String produceName(Object patchState) {
            try {
                Object produce = patchStateProduce.invoke(patchState);
                if (produce == null) return null;
                Object name = produceGetName.invoke(produce);
                return name == null ? null : String.valueOf(name);
            } catch (Exception ignored) {
                return null;
            }
        }

        static String cropStateConstant(Object patchState) {
            try {
                Object cropState = patchStateCropState.invoke(patchState);
                return cropState == null ? null : ((Enum<?>) cropState).name();
            } catch (Exception ignored) {
                return null;
            }
        }

        static Integer stage(Object patchState) {
            return intOrNull(patchStateStage, patchState);
        }

        static Integer stages(Object patchState) {
            return intOrNull(patchStateStages, patchState);
        }

        static Integer tickRate(Object patchState) {
            return intOrNull(patchStateTickRate, patchState);
        }

        private static Integer intOrNull(Method method, Object target) {
            try {
                Object value = method.invoke(target);
                return value instanceof Integer ? (Integer) value : null;
            } catch (Exception ignored) {
                return null;
            }
        }
    }
}
