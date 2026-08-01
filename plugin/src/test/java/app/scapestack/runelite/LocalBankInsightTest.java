package app.scapestack.runelite;

import net.runelite.api.gameval.ItemID;
import org.junit.Test;

import java.util.Arrays;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

public class LocalBankInsightTest {
    private static GameStateReader.BankItem item(int id, String name, int quantity) {
        return new GameStateReader.BankItem(id, name, quantity);
    }

    @Test
    public void saysWhatTheLiveBankCanFinishWithoutCallingScapestack() {
        assertEquals(
            "Ahrim's robeskirt is 1,572,490. You have 14,500,000. That finishes Ahrim's set.",
            LocalBankInsight.describe(
                "normal",
                Arrays.asList(
                    item(ItemID.COINS, "Coins", 14_500_000),
                    item(ItemID.BARROWS_AHRIM_HEAD, "Ahrim's hood", 1),
                    item(ItemID.BARROWS_AHRIM_WEAPON, "Ahrim's staff", 1),
                    item(ItemID.BARROWS_AHRIM_BODY, "Ahrim's robetop", 1)
                ),
                id -> id,
                id -> id == ItemID.BARROWS_AHRIM_LEGS ? 1_572_490 : 0
            )
        );

        assertNull(LocalBankInsight.describe(
            "ironman",
            Arrays.asList(item(ItemID.COINS, "Coins", 14_500_000)),
            id -> id,
            id -> 1
        ));
        assertNull(LocalBankInsight.describe(
            "normal",
            Arrays.asList(
                item(ItemID.COINS, "Coins", 14_500_000),
                item(ItemID.BARROWS_AHRIM_HEAD, "Ahrim's hood", 1)
            ),
            id -> id,
            id -> 1
        ));
    }
}
