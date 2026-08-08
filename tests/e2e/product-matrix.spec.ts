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
    await expect(page.getByRole("heading", { name: "Your OSRS companion." })).toBeVisible();
    await expect(page.getByPlaceholder(/your osrs name/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /open my page/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("2. first-time player gets an answer before any refinement", async ({ page }) => {
    await page.goto("/next");
    await page.getByPlaceholder(/type your osrs name/i).fill("Lauky");
    await page.getByRole("button", { name: /plan my next move/i }).click();
    await expect(page.locator("[data-next-trip-card=true]")).toBeVisible();
    await expect(page.getByRole("region", { name: /not this/i })).toBeVisible();
    await expect(page.getByText("Want a different kind of trip?")).toHaveCount(0);
    await expect(page.getByText("What are you in the mood for?")).toHaveCount(0);
  });

  test("3. sample next plan renders one primary trip and concrete alternatives", async ({ page }) => {
    await page.goto("/next?sample=1");
    await expect(page.locator("[data-next-trip-card=true]")).toBeVisible();
    await expect(page.locator("[data-next-trip-card=true]").getByText(/do this first/i).first()).toBeVisible();
    const alternatives = page.getByRole("table", { name: "Alternative routes" });
    await expect(alternatives).toBeVisible();
    await expect.poll(async () => alternatives.getByRole("row").count()).toBeGreaterThanOrEqual(2);
    await expect.poll(async () => alternatives.getByRole("button", { name: /^Hide / }).count()).toBeGreaterThanOrEqual(1);
    await expectNoHorizontalOverflow(page);
  });

  test("4. hiding an alternative survives a reload", async ({ page }) => {
    await page.goto("/next?sample=1");
    await expect(page.locator("[data-next-trip-card=true]")).toBeVisible();
    const alternatives = page.getByRole("table", { name: "Alternative routes" });
    const firstHide = alternatives.getByRole("button", { name: /^Hide / }).first();
    const hiddenTitle = (await firstHide.getAttribute("aria-label"))!.replace(/^Hide /, "");
    await firstHide.click();
    await expect(alternatives.getByText(hiddenTitle, { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.locator("[data-next-trip-card=true]")).toBeVisible();
    await expect(page.getByRole("table", { name: "Alternative routes" }).getByText(hiddenTitle, { exact: true })).toHaveCount(0);
  });

  test("5. player adds bank once and bank organizer opens", async ({ page }) => {
    await page.goto("/bank");
    await page.getByTestId("bank-paste-input").fill(SAMPLE_BANK);
    await page.getByLabel("Save pasted bank to this device").click();
    await expect.poll(async () => page.evaluate(() => Boolean(localStorage.getItem("scapestack:saved-bank:v1")))).toBeTruthy();
    await expect(page.getByText(/bank ready|bank detected|opening organizer|runeLite tabs|plan/i).first()).toBeVisible();
  });

  test("6. saved bank makes the four bank answers usable on /u", async ({ page }) => {
    await seedSavedBank(page, "lauky");
    // Follow the real entry: /dps hands off to the tool sections, which live
    // on /u since 2026-08-08. The first rewrite of this test asserted only
    // that four (possibly empty) sections exist — true without any bank at
    // all, which the adversarial pass called out. The proof is bank-FED
    // content: per-boss answers only render when the saved bank parsed.
    await page.goto("/dps?rsn=lauky&from=e2e");
    await expect(page).toHaveURL(/\/u\/lauky#bosses/);
    await expect(page.locator("[data-player-tool-section]")).toHaveCount(4);
    await expect(page.locator("[data-player-tools-loading=true]")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator("[data-boss-answer]").first()).toBeVisible({ timeout: 15_000 });
  });

  test("7. without a bank, /u explains what RuneLite adds instead of pretending", async ({ page }) => {
    await page.goto("/u/lauky");
    await expect(page.locator("[data-player-tool-section]")).toHaveCount(4);
    await expect(page.getByText(/RuneLite/).first()).toBeVisible();
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
    // The recap lives on /u since 2026-08-08 — account history is the detail
    // page's job; /p holds only the answer, the goals and the routes.
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
    const shareId = process.env.SCAPESTACK_E2E_PUBLIC_BANK_SHARE_ID;
    test.skip(!shareId, "requires a real owner-published bank affordability image");
    await page.goto(`/share/bank/${shareId}/opengraph-image`);
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
