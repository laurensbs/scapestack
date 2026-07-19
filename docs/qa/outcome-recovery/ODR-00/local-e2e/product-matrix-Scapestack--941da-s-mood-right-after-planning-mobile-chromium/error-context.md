# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-matrix.spec.ts >> Scapestack product story matrix >> 2. first-time route picker offers mood right after planning
- Location: tests/e2e/product-matrix.spec.ts:37:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-next-trip-card=true]')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-next-trip-card=true]')

```

```yaml
- banner:
  - link "Scapestack home":
    - /url: /
    - text: scape stack
  - button "Open menu":
    - img
- main:
  - textbox "Type your OSRS name" [disabled]: Lauky
  - button "Reading account… +1 Bank" [disabled]
  - paragraph: Building one clear plan…
  - status "Building your next trip…": Building your next trip… Checking Vorkath Stats Bank RuneLite Trip
  - button "Add bank paste" [disabled]:
    - img
    - text: Add bank
  - button "Choose a session instead" [disabled]
  - button "Try a sample plan" [disabled]
  - paragraph: Free. Your bank stays in this browser.
- navigation "Mobile quick actions":
  - link "Trip":
    - /url: /next?rsn=Lauky
    - img
    - text: Trip
  - link "Bank":
    - /url: /bank?rsn=Lauky&from=mobile
    - img
    - text: Bank
  - link "RuneLite":
    - /url: /plugin?rsn=Lauky&from=mobile#verify-sync
    - img
    - text: RuneLite
  - button "Best now":
    - img
    - text: Best now
- contentinfo: Scapestack · What can I do now in OSRS? · Made for Gielinor
- alert
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   |
  3   | const SAMPLE_BANK = [
  4   |   "Item id\tItem name\tItem quantity",
  5   |   "995\tCoins\t3140000",
  6   |   "385\tShark\t250",
  7   |   "3144\tCooked karambwan\t120",
  8   |   "560\tDeath rune\t3000",
  9   |   "565\tBlood rune\t1800",
  10  |   "6685\tSaradomin brew(4)\t40",
  11  |   "3024\tSuper restore(4)\t55",
  12  |   "12954\tDragon defender\t1",
  13  |   "4151\tAbyssal whip\t1",
  14  |   "13239\tPrimordial boots\t1",
  15  |   "11832\tBandos chestplate\t1",
  16  |   "11834\tBandos tassets\t1",
  17  |   "12926\tToxic blowpipe\t1",
  18  |   "21907\tAva's assembler\t1",
  19  |   "27275\tTumeken's shadow\t1",
  20  |   "3142\tRaw karambwan\t850",
  21  |   "383\tRaw shark\t600"
  22  | ].join("\n");
  23  |
  24  | test.describe("Scapestack product story matrix", () => {
  25  |   test.beforeEach(async ({ page }) => {
  26  |     failOnConsoleErrors(page);
  27  |   });
  28  |
  29  |   test("1. first-time player sees RSN -> one plan promise", async ({ page }) => {
  30  |     await page.goto("/");
  31  |     await expect(page.getByLabel("Stop bankstanding. Pick the next trip.")).toBeVisible();
  32  |     await expect(page.getByPlaceholder(/type your osrs name/i)).toBeVisible();
  33  |     await expect(page.getByRole("button", { name: /plan my next trip with osrs name|plan my next move/i })).toBeVisible();
  34  |     await expectNoHorizontalOverflow(page);
  35  |   });
  36  |
  37  |   test("2. first-time route picker offers mood right after planning", async ({ page }) => {
  38  |     await page.goto("/next");
  39  |     await page.getByPlaceholder(/type your osrs name/i).fill("Lauky");
  40  |     await page.getByRole("button", { name: /plan my next move/i }).click();
> 41  |     await expect(page.locator("[data-next-trip-card=true]")).toBeVisible();
      |                                                              ^ Error: expect(locator).toBeVisible() failed
  42  |     await expect(page.getByRole("region", { name: /choose a different vibe/i })).toBeVisible();
  43  |     await expect(page.getByRole("button", { name: /want chill|choose .*farming|choose/i }).first()).toBeVisible();
  44  |   });
  45  |
  46  |   test("3. sample next plan renders one primary trip and bigger backups", async ({ page }) => {
  47  |     await page.goto("/next?sample=1");
  48  |     await expect(page.locator("[data-next-trip-card=true]")).toBeVisible();
  49  |     await expect(page.locator("[data-next-trip-card=true]").getByText(/do this first/i).first()).toBeVisible();
  50  |     await expect(page.locator("[data-route-card=true]").first()).toBeVisible();
  51  |     await expect.poll(async () => page.locator("[data-route-card=true]").count()).toBeGreaterThanOrEqual(2);
  52  |     await expect(page.getByText("Want a different kind of session?")).toBeVisible();
  53  |     await expectNoHorizontalOverflow(page);
  54  |   });
  55  |
  56  |   test("4. Chill mood randomize keeps the visible mood lane", async ({ page }) => {
  57  |     await page.goto("/next?sample=1&intent=afk&time=60");
  58  |     await expect(page.locator("[data-next-trip-card=true]")).toBeVisible();
  59  |     await expect(page.locator("[data-next-trip-card=true]").getByText(/afk/i).first()).toBeVisible();
  60  |     await page.getByText("Want a different kind of session?").click();
  61  |     await page.getByRole("button", { name: /surprise me/i }).click();
  62  |     await expect(page.locator("[data-next-trip-card=true]").getByText(/afk/i).first()).toBeVisible();
  63  |   });
  64  |
  65  |   test("5. player adds bank once and bank organizer opens", async ({ page }) => {
  66  |     await page.goto("/bank");
  67  |     await page.getByTestId("bank-paste-input").fill(SAMPLE_BANK);
  68  |     await page.getByLabel("Save pasted bank to this device").click();
  69  |     await expect.poll(async () => page.evaluate(() => Boolean(localStorage.getItem("scapestack:saved-bank:v1")))).toBeTruthy();
  70  |     await expect(page.getByText(/bank ready|bank detected|opening organizer|runeLite tabs|plan/i).first()).toBeVisible();
  71  |   });
  72  |
  73  |   test("6. saved bank makes Check Kill a clickable boss grid", async ({ page }) => {
  74  |     await seedSavedBank(page, "lauky");
  75  |     await page.goto("/dps?rsn=lauky&from=e2e");
  76  |     await expect(page.getByPlaceholder(/search bosses/i)).toBeVisible();
  77  |     await page.getByPlaceholder(/search bosses/i).fill("Vorkath");
  78  |     await page.keyboard.press("Enter");
  79  |     await expect(page.getByTestId("boss-trip-verdict")).toBeVisible();
  80  |     await expect(page.getByTestId("boss-inventory-setup")).toBeVisible();
  81  |   });
  82  |
  83  |   test("7. Check Kill empty state asks for bank before trusting setup", async ({ page }) => {
  84  |     await page.goto("/dps?rsn=lauky&from=e2e-empty");
  85  |     await expect(page.getByText(/add bank/i).first()).toBeVisible();
  86  |     await expect(page.getByRole("button", { name: /load sample bank/i })).toBeVisible();
  87  |     await expect(page.getByTestId("bank-paste-input")).toBeVisible();
  88  |   });
  89  |
  90  |   test("8. RuneLite page shows check, status and fix without developer panels", async ({ page }) => {
  91  |     await page.route("**/api/sync/claim**", async (route) => {
  92  |       await route.fulfill({ json: { ok: false, error: "No RuneLite scan is connected to Lauky yet." }, status: 404 });
  93  |     });
  94  |     await page.goto("/plugin?rsn=Lauky&from=e2e");
  95  |     await expect(page.getByLabel("RuneLite connection")).toBeVisible();
  96  |     const checkButton = page.getByRole("button", { name: /check runelite/i });
  97  |     if (await checkButton.count()) {
  98  |       await checkButton.first().click();
  99  |     }
  100 |     await expect(page.getByText(/open runelite|press sync now|ready to check runelite/i).first()).toBeVisible();
  101 |     await expect(page.getByText(/plugin hub|payload|readiness|\bPR\b/i)).toHaveCount(0);
  102 |   });
  103 |
  104 |   test("9. returning player history can show recap and open next trip", async ({ page }) => {
  105 |     await mockConnectedTimeline(page);
  106 |     await page.goto("/u/Lauky");
  107 |     await expect(page.locator("[data-return-recap=true]")).toBeVisible();
  108 |     await expect(page.getByRole("link", { name: /find the next unlock|pick the next kc block|replan/i })).toBeVisible();
  109 |   });
  110 |
  111 |   test("10. account removal is visible from the account menu", async ({ page, isMobile }) => {
  112 |     await seedAccount(page, "Lauky");
  113 |     await page.goto("/");
  114 |     if (isMobile) {
  115 |       await page.getByRole("button", { name: /open menu/i }).click();
  116 |       await page.getByLabel(/current account|add osrs account/i).last().click();
  117 |     } else {
  118 |       await page.getByLabel(/current account|add osrs account/i).click();
  119 |     }
  120 |     await expect(page.getByLabel(/remove lauky/i)).toBeVisible();
  121 |   });
  122 |
  123 |   test("11. mobile keeps primary controls reachable", async ({ page, isMobile }) => {
  124 |     test.skip(!isMobile, "mobile-only navigation story");
  125 |     await page.goto("/next?sample=1");
  126 |     await expect(page.locator("[data-next-trip-card=true]")).toBeVisible();
  127 |     await expect(page.getByLabel("Mobile quick actions")).toBeVisible();
  128 |     await expectNoHorizontalOverflow(page);
  129 |   });
  130 |
  131 |   test("12. social share image renders as a standalone decision", async ({ page, isMobile }) => {
  132 |     await page.goto("/share/trip/opengraph-image?result=My+bank+supports+this+Vorkath+trip&why=Salve+would+improve+the+trip&stop=Stop+at+50+KC&item=21907");
  133 |     await expect(page.locator("body")).toBeVisible();
  134 |     if (!isMobile) {
  135 |       await expectNoHorizontalOverflow(page);
  136 |     }
  137 |   });
  138 | });
  139 |
  140 | function failOnConsoleErrors(page: Page): void {
  141 |   page.on("console", (message) => {
```