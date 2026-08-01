package app.scapestack.runelite;

import net.runelite.api.vars.AccountType;
import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class GameStateReaderTest {
    @Test
    public void normalizesRuneLiteAccountTypesForScapestack() {
        assertEquals("normal", GameStateReader.normalizeAccountType(AccountType.NORMAL));
        assertEquals("ironman", GameStateReader.normalizeAccountType(AccountType.IRONMAN));
        assertEquals("hardcore_ironman", GameStateReader.normalizeAccountType(AccountType.HARDCORE_IRONMAN));
        assertEquals("ultimate_ironman", GameStateReader.normalizeAccountType(AccountType.ULTIMATE_IRONMAN));
        assertEquals("group_ironman", GameStateReader.normalizeAccountType(AccountType.GROUP_IRONMAN));
        assertEquals("hardcore_group_ironman", GameStateReader.normalizeAccountType(AccountType.HARDCORE_GROUP_IRONMAN));
        assertEquals("normal", GameStateReader.normalizeAccountType(null));
    }

    @Test
    public void allNotStartedQuestVarsAreUnavailableRatherThanAnEmptyReading() {
        assertFalse(GameStateReader.questReadingAvailable(170, 0));
        assertFalse(GameStateReader.questReadingAvailable(0, 0));
        assertTrue(GameStateReader.questReadingAvailable(170, 1));
        assertTrue(GameStateReader.questReadingAvailable(169, 42));
    }
}
