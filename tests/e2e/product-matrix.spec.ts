import { expect, test, type Page } from "@playwright/test";

const SAMPLE_BANK = [
  "Item id\tItem name\tItem quantity",
  "995\tCoins\t3140000",
  "385\tShark\t250",
  "3144\tCooked karambwan\t120",
  "560\tDeath rune\t3000",
  "565\tBlood rune\t1800",
  "6685\tSaradomin brew(4)\t40",
  "3024\tSuper restore(4)\t55",
  "12954\tDragon defender\t1",
  "4151\tAbyssal whip\t1",
  "13239\tPrimordial boots\t1",
  "11832\tBandos chestplate\t1",
  "11834\tBandos tassets\t1",
  "12926\tToxic blowpipe\t1",
  "21907\tAva's assembler\t1",
  "27275\tTumeken's shadow\t1",
  "3142\tRaw karambwan\t850",
  "383\tRaw shark\t600"
].join("\n");

test.describe("Scapestack product story matrix", () => {
  test.beforeEach(async ({ page }) => {
    failOnConsoleErrors(page);
  });

  test("1. first-time player sees RSN -> one plan promise", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Stop bankstanding. Pick the next trip.")).toBeVisible();
    await expect(page.getByPlaceholder(/type your osrs name/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /plan my next trip with osrs name|plan my next move/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("2. first-time route picker offers mood right after planning", async ({ page }) => {
    await page.goto("/next");
    await page.getByPlaceholder(/type your osrs name/i).fill("Lauky");
    await page.getByRole("button", { name: /plan my next move/i }).click();
    await expect(page.locator("[data-next-trip-card=true]")).toBeVisible();
    await expect(page.getByRole("region", { name: /choose a different vibe/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /want chill|choose .*farming|choose/i }).first()).toBeVisible();
  });

  test("3. sample next plan renders one primary trip and bigger backups", async ({ page }) => {
    await page.goto("/next?sample=1");
    await expect(page.locator("[data-next-trip-card=true]")).toBeVisible();
    await expect(page.locator("[data-next-trip-card=true]").getByText(/do this first/i).first()).toBeVisible();
    await expect(page.locator("[data-route-card=true]").first()).toBeVisible();
    await expect.poll(async () => page.locator("[data-route-card=true]").count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByText("Want a different kind of session?")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("4. Chill mood randomize keeps the visible mood lane", async ({ page }) => {
    await page.goto("/next?sample=1&intent=afk&time=60");
    await expect(page.locator("[data-next-trip-card=true]")).toBeVisible();
    await expect(page.locator("[data-next-trip-card=true]").getByText(/afk/i).first()).toBeVisible();
    await page.getByText("Want a different kind of session?").click();
    await page.getByRole("button", { name: /surprise me/i }).click();
    await expect(page.locator("[data-next-trip-card=true]").getByText(/afk/i).first()).toBeVisible();
  });

  test("5. player adds bank once and bank organizer opens", async ({ page }) => {
    await page.goto("/bank");
    await page.getByTestId("bank-paste-input").fill(SAMPLE_BANK);
    await page.getByLabel("Save pasted bank to this device").click();
    await expect.poll(async () => page.evaluate(() => Boolean(localStorage.getItem("scapestack:saved-bank:v1")))).toBeTruthy();
    await expect(page.getByText(/bank ready|bank detected|opening organizer|runeLite tabs|plan/i).first()).toBeVisible();
  });

  test("6. saved bank makes Check Kill a clickable boss grid", async ({ page }) => {
    await seedSavedBank(page, "lauky");
    await page.goto("/dps?rsn=lauky&from=e2e");
    await expect(page.getByPlaceholder(/search bosses/i)).toBeVisible();
    await page.getByPlaceholder(/search bosses/i).fill("Vorkath");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("boss-trip-verdict")).toBeVisible();
    await expect(page.getByTestId("boss-inventory-setup")).toBeVisible();
  });

  test("7. Check Kill empty state asks for bank before trusting setup", async ({ page }) => {
    await page.goto("/dps?rsn=lauky&from=e2e-empty");
    await expect(page.getByText(/add bank/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /load sample bank/i })).toBeVisible();
    await expect(page.getByTestId("bank-paste-input")).toBeVisible();
  });

  test("8. RuneLite page shows check, status and fix without developer panels", async ({ page }) => {
    await page.route("**/api/sync/claim**", async (route) => {
      await route.fulfill({ json: { ok: false, error: "No RuneLite scan is connected to Lauky yet." }, status: 404 });
    });
    await page.goto("/plugin?rsn=Lauky&from=e2e");
    await expect(page.getByLabel("RuneLite connection")).toBeVisible();
    const checkButton = page.getByRole("button", { name: /check runelite/i });
    if (await checkButton.count()) {
      await checkButton.first().click();
    }
    await expect(page.getByText(/open runelite|press sync now|ready to check runelite/i).first()).toBeVisible();
    await expect(page.getByText(/plugin hub|payload|readiness|\bPR\b/i)).toHaveCount(0);
  });

  test("9. returning player history can show recap and open next trip", async ({ page }) => {
    await mockConnectedTimeline(page);
    await page.goto("/u/Lauky");
    await expect(page.locator("[data-return-recap=true]")).toBeVisible();
    await expect(page.getByRole("link", { name: /find the next unlock|pick the next kc block|replan/i })).toBeVisible();
  });

  test("10. account removal is visible from the account menu", async ({ page, isMobile }) => {
    await seedAccount(page, "Lauky");
    await page.goto("/");
    if (isMobile) {
      await page.getByRole("button", { name: /open menu/i }).click();
      await page.getByLabel(/current account|add osrs account/i).last().click();
    } else {
      await page.getByLabel(/current account|add osrs account/i).click();
    }
    await expect(page.getByLabel(/remove lauky/i)).toBeVisible();
  });

  test("11. mobile keeps primary controls reachable", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-only navigation story");
    await page.goto("/next?sample=1");
    await expect(page.locator("[data-next-trip-card=true]")).toBeVisible();
    await expect(page.getByLabel("Mobile quick actions")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("12. social share image renders as a standalone decision", async ({ page, isMobile }) => {
    await page.goto("/share/trip/opengraph-image?result=My+bank+supports+this+Vorkath+trip&why=Salve+would+improve+the+trip&stop=Stop+at+50+KC&item=21907");
    await expect(page.locator("body")).toBeVisible();
    if (!isMobile) {
      await expectNoHorizontalOverflow(page);
    }
  });
});

function failOnConsoleErrors(page: Page): void {
  page.on("console", (message) => {
    if (message.type() === "error" && !/favicon|Failed to load resource/i.test(message.text())) {
      throw new Error(`Console error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    throw error;
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(0, root.scrollWidth - root.clientWidth);
  });
  expect(overflow).toBeLessThanOrEqual(2);
}

async function seedAccount(page: Page, rsn: string): Promise<void> {
  await page.addInitScript((name) => {
    const id = name.toLowerCase();
    localStorage.setItem("scapestack:saved-rsn:v1", name);
    localStorage.setItem("scapestack:accounts:v1", JSON.stringify({
      version: 1,
      activeId: id,
      accounts: [{ id, rsn: name, createdAt: Date.now(), lastUsedAt: Date.now() }]
    }));
  }, rsn);
}

async function seedSavedBank(page: Page, rsn: string): Promise<void> {
  await seedAccount(page, rsn);
  await page.addInitScript(({ name, bank }) => {
    const payload = JSON.stringify({ version: 1, banktags: bank, savedAt: Date.now() });
    const id = name.toLowerCase();
    localStorage.setItem("scapestack:saved-bank:v1", payload);
    localStorage.setItem(`scapestack:saved-bank:${id}:v1`, payload);
  }, { name: rsn, bank: SAMPLE_BANK });
}

async function mockConnectedTimeline(page: Page): Promise<void> {
  await page.route("**/api/account/me", async (route) => {
    await route.fulfill({ json: { connected: true, rsn: "Lauky" } });
  });
  await page.route("**/api/account/timeline?**", async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        account: { rsn: "Lauky", displayName: "Lauky" },
        moments: [
          { id: "quest", kind: "quest", occurredAt: "2026-07-16T11:00:00.000Z", title: "Finished Monkey Madness II" },
          { id: "boss", kind: "boss", occurredAt: "2026-07-16T10:00:00.000Z", title: "Vorkath: 50 KC", detail: "+2 since the previous RuneLite check" }
        ],
        recap: {
          title: "Finished unlocks are out of the way",
          lead: "The next plan can skip those requirements instead of sending you back through them.",
          moments: [
            { id: "quest", kind: "quest", title: "Finished Monkey Madness II", detail: null },
            { id: "boss", kind: "boss", title: "Vorkath: 50 KC", detail: "+2 since the previous RuneLite check" }
          ],
          nextAction: "Find the next unlock",
          nextHref: "/next?rsn=Lauky&from=recap",
          visualItemId: 9813,
          latestMomentId: "quest"
        },
        nextCursor: null
      }
    });
  });
}
