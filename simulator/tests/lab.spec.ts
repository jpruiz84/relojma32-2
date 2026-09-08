import { test, expect, type Page } from "@playwright/test";
const key = async (page: Page, name: string) =>
  page.getByTestId("key-" + name).click();
async function openLab(page: Page) {
  await page.goto("./");
  await expect(page.getByTestId("viewport")).toHaveAttribute(
    "data-model-loaded",
    "true",
  );
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
}
test("loads real assets, all source images, and no browser or network errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`);
  });
  await openLab(page);
  await expect(page.getByTestId("lcd")).toHaveAttribute(
    "aria-label",
    /PROX.*07:00AM/,
  );
  await page
    .getByRole("button", { name: "Source archive", exact: false })
    .click();
  await expect(page.locator(".photo-grid img")).toHaveCount(15);
  await page.locator(".photo-grid button").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".lightbox-image")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const data = await (await page.request.get("./assets/design.json")).json();
  expect(data.components).toHaveLength(28);
  expect(data.nets).toHaveLength(47);
  expect(errors).toEqual([]);
});
test("operates the original clock menu from both keyboard and keypad", async ({
  page,
}) => {
  await openLab(page);
  await key(page, "m");
  await expect(page.getByTestId("lcd")).toHaveAttribute(
    "aria-label",
    /MENU.*Fijar Reloj/,
  );
  await expect(page.locator(".lcd-glyph")).toHaveCount(6);
  expect(
    await page
      .locator(".lcd-glyph")
      .evaluateAll((glyphs) =>
        glyphs.map((glyph) => glyph.getAttribute("data-cgram")),
      ),
  ).toEqual(["0", "1", "2", "3", "4", "5"]);
  await key(page, "enter");
  for (const n of "083015") await key(page, n);
  await key(page, "down");
  await key(page, "enter");
  await key(page, "down");
  await key(page, "enter");
  await expect(page.getByTestId("lcd")).toHaveAttribute(
    "aria-label",
    /08:30:15PM - MAR/,
  );
  await expect(page.locator(".lcd-glyph")).toHaveCount(0);
  await page.locator("h1").click();
  await page.keyboard.press("m");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("lcd")).toHaveAttribute(
    "aria-label",
    /Fijar Alarmas/,
  );
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("lcd")).toHaveAttribute(
    "aria-label",
    /08:30:15PM/,
  );
});
test("manual bell stops on pointer release, cancellation and power-off", async ({
  page,
}) => {
  await openLab(page);
  const box = await page.getByTestId("key-ring").boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId("contact-state")).toContainText("Closed");
  await page.mouse.move(10, 10);
  await page.mouse.up();
  await expect(page.getByTestId("contact-state")).toContainText("Open");
  await page.locator("h1").click();
  await page.keyboard.down("#");
  await expect(page.getByTestId("contact-state")).toContainText("Closed");
  await page.getByRole("switch", { name: "12 V power", exact: true }).click();
  await expect(page.getByTestId("contact-state")).toContainText("Open");
  await page.keyboard.up("#");
  await expect(page.getByTestId("key-m")).toBeDisabled();
});
test("3D front keys are clickable and operate the same firmware", async ({
  page,
}) => {
  await openLab(page);
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await page.waitForTimeout(1800);
  const rect = await page.getByTestId("viewport").boundingBox();
  const scale =
    rect!.height / (2 * Math.tan((17 * Math.PI) / 180) * (42 - 5.4));
  const x = rect!.x + rect!.width / 2 + 1.93 * scale,
    y = rect!.y + rect!.height / 2 + 4.41 * scale;
  await page.mouse.click(x, y);
  await expect(page.getByTestId("lcd")).toHaveAttribute("aria-label", /MENU/);
  await page.mouse.click(x, y);
  await expect(page.getByTestId("lcd")).not.toHaveAttribute(
    "aria-label",
    /MENU/,
  );
  await page.mouse.move(rect!.x + rect!.width / 2 + 0.64 * scale, y);
  await page.mouse.down();
  await expect(page.getByTestId("contact-state")).toContainText("Closed");
  await page.mouse.up();
  await expect(page.getByTestId("contact-state")).toContainText("Open");
});
test("edits schedules, weekly assignments and durations with byte-exact persistence", async ({
  page,
}) => {
  await openLab(page);
  await page.getByRole("button", { name: "Schedules", exact: true }).click();
  await page.getByRole("button", { name: "H4", exact: false }).click();
  await page
    .getByRole("button", { name: "Edit H4 alarm 30", exact: true })
    .click();
  await page.getByLabel("Alarm time", { exact: true }).fill("22:47");
  await page.getByLabel("Alarm bell pattern").selectOption("3");
  await page
    .getByRole("switch", { name: "Alarm enabled", exact: true })
    .click();
  await page.getByRole("button", { name: "Save to EEPROM" }).click();
  await page.getByRole("button", { name: "Week plan", exact: true }).click();
  await page.getByLabel("Friday schedule").selectOption("4");
  await page.getByLabel("Short bell · TC").selectOption("16");
  await page.reload();
  await expect(page.getByTestId("viewport")).toHaveAttribute(
    "data-model-loaded",
    "true",
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("reloj-ma-lab-v1")!),
  );
  expect(saved.eeprom[240]).toBe(0xe2);
  expect(saved.eeprom[241]).toBe(0xc7);
  expect(saved.eeprom[246]).toBe(4);
  expect(saved.eeprom[251]).toBe(15);
});
test("imports and exports original MPLAB captures and reports malformed files", async ({
  page,
}) => {
  await openLab(page);
  await page.getByRole("button", { name: "Schedules", exact: true }).click();
  await page.getByRole("button", { name: "EEPROM", exact: true }).click();
  await page.getByLabel("Archived configuration").selectOption("timbresinem");
  await page.getByRole("button", { name: "Load capture", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "All 256 bytes replaced",
  );
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export .MCH", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("reloj-ma-config.MCH");
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.MCH",
    mimeType: "text/plain",
    buffer: Buffer.from("NOT EEPROM"),
  });
  await expect(page.getByRole("status")).toContainText(
    "two-digit hexadecimal bytes",
  );
});
test("supports exploded geometry, component inspection, labels and backup/fuse controls", async ({
  page,
}) => {
  await openLab(page);
  await page.getByRole("button", { name: "Electronics", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Replace cover", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Inspect component").selectOption("Q2");
  await expect(page.locator(".component-detail h3")).toContainText(
    "relay driver",
  );
  await page.locator(".net-details summary").click();
  await expect(page.locator(".net-details")).toContainText("J3.1");
  await page.getByRole("button", { name: "Exploded", exact: true }).click();
  await page
    .getByRole("button", { name: "Show component labels", exact: true })
    .click();
  await page
    .getByRole("switch", { name: "CR2032 battery", exact: true })
    .click();
  await expect(page.locator(".telemetry")).toContainText("Backup removed");
  await page.getByRole("switch", { name: "15 A fuse", exact: true }).click();
  await expect(page.locator(".telemetry")).toContainText("Fuse open");
  await page
    .getByRole("button", { name: "Replace cover", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove cover", exact: true }),
  ).toBeVisible();
});
test("plays a scheduled bell at accelerated speed without duplicate retriggers", async ({
  page,
}) => {
  await openLab(page);
  await page.getByRole("button", { name: "Next bell", exact: true }).click();
  await page.getByLabel("Simulation speed").selectOption("10");
  await page
    .getByRole("button", { name: "Resume simulation", exact: true })
    .click();
  await expect(page.getByTestId("event-log")).toContainText("1TL");
  await expect(page.getByTestId("contact-state")).toContainText("Open");
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await expect(page.getByTestId("event-log")).toContainText("RC0 LOW");
  await expect(page.getByTestId("lcd")).toHaveAttribute(
    "aria-label",
    /07:50AM/,
  );
});
test("password protects keypad and recovery resets it while preserving alarm memory", async ({
  page,
}) => {
  await openLab(page);
  await key(page, "m");
  for (let i = 0; i < 3; i++) await key(page, "down");
  await key(page, "enter");
  await key(page, "down");
  await key(page, "enter");
  for (const n of "24682468") await key(page, n);
  await expect(page.getByTestId("lcd")).toHaveAttribute(
    "aria-label",
    /cambiada/,
  );
  await key(page, "enter");
  await key(page, "m");
  await expect(page.getByTestId("lcd")).toHaveAttribute(
    "aria-label",
    /Contraseña/,
  );
  for (const n of "2468") await key(page, n);
  await expect(page.getByTestId("lcd")).toHaveAttribute("aria-label", /MENU/);
  await key(page, "m");
  await page.getByRole("switch", { name: "12 V power", exact: true }).click();
  await page.getByRole("button", { name: "Electronics", exact: true }).click();
  await page
    .getByRole("switch", { name: "CR2032 battery", exact: true })
    .click();
  await page.getByLabel("Simulation speed").selectOption("60");
  await page
    .getByRole("button", { name: "Resume simulation", exact: true })
    .click();
  await page.waitForTimeout(400);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await page
    .getByRole("switch", { name: "CR2032 battery", exact: true })
    .click();
  await page.getByRole("button", { name: "Operate", exact: true }).click();
  await page.getByRole("switch", { name: "12 V power", exact: true }).click();
  await expect(page.getByTestId("lcd")).toHaveAttribute(
    "aria-label",
    /12:00:00AM - LUN/,
  );
  await key(page, "m");
  await expect(page.getByTestId("lcd")).toHaveAttribute("aria-label", /MENU/);
});
test("mobile layout fits the screen, keypad works and guide traps keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLab(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await key(page, "m");
  await expect(page.getByTestId("lcd")).toHaveAttribute("aria-label", /MENU/);
  await page
    .getByRole("button", { name: "Open simulator guide", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() => !!document.activeElement?.closest("dialog")),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
