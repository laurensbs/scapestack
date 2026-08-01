package app.scapestack.runelite;

import net.runelite.api.gameval.ItemID;
import net.runelite.client.game.ItemManager;

import java.text.NumberFormat;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.function.IntUnaryOperator;

/** One exact, local-only answer from the bank container RuneLite already holds. */
final class LocalBankInsight {
    private static final Piece[] AHRIMS = {
        new Piece(ItemID.BARROWS_AHRIM_HEAD, "Ahrim's hood"),
        new Piece(ItemID.BARROWS_AHRIM_WEAPON, "Ahrim's staff"),
        new Piece(ItemID.BARROWS_AHRIM_BODY, "Ahrim's robetop"),
        new Piece(ItemID.BARROWS_AHRIM_LEGS, "Ahrim's robeskirt")
    };

    private LocalBankInsight() {}

    static String describe(String accountType, List<GameStateReader.BankItem> bank, ItemManager items) {
        return describe(accountType, bank, items::canonicalize, items::getItemPrice);
    }

    static String describe(
        String accountType,
        List<GameStateReader.BankItem> bank,
        IntUnaryOperator canonicalize,
        IntUnaryOperator price
    ) {
        if (!"normal".equals(accountType) || bank == null || bank.isEmpty()) return null;
        long coins = 0;
        Set<Integer> owned = new HashSet<>();
        for (GameStateReader.BankItem item : bank) {
            int id = canonicalize.applyAsInt(item.id);
            if (id == ItemID.COINS) coins += Math.max(0, item.quantity);
            if (item.quantity > 0) owned.add(id);
        }

        Piece missing = null;
        for (Piece piece : AHRIMS) {
            if (owned.contains(piece.id)) continue;
            if (missing != null) return null;
            missing = piece;
        }
        if (missing == null) return null;
        int cost = price.applyAsInt(missing.id);
        if (cost <= 0 || coins < cost) return null;
        return missing.name + " is " + number(cost) + ". You have " + number(coins)
            + ". That finishes Ahrim's set.";
    }

    private static String number(long value) {
        return NumberFormat.getIntegerInstance(Locale.US).format(value);
    }

    private static final class Piece {
        final int id;
        final String name;

        Piece(int id, String name) {
            this.id = id;
            this.name = name;
        }
    }
}
