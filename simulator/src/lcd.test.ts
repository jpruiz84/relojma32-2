import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ClockEngine, blankMemory } from "./engine";
import { LCD_LOGO_CHARACTERS, LCD_LOGO_GLYPHS, lcdGlyphPixels } from "./lcd";

it("matches all 48 LCD_DIBLOGORET bytes in the original assembly", () => {
  const assembly = readFileSync("../relojma.asm", "latin1");
  const table = assembly.split("LCD_DIBLOGORET")[1].split(/\bEND\b/)[0];
  const bytes = [...table.matchAll(/RETLW\s+b'([01]{8})'/g)].map((m) =>
    parseInt(m[1], 2),
  );
  expect(bytes).toHaveLength(48);
  expect(LCD_LOGO_GLYPHS.flat()).toEqual(bytes);
  // Decode the rendered pixels back to bytes, including left-to-right bit order.
  const rendered = [...LCD_LOGO_CHARACTERS].flatMap((character) => {
    const rows = Array<number>(8).fill(0);
    for (const { x, y } of lcdGlyphPixels(character)!) rows[y] |= 1 << (4 - x);
    return rows;
  });
  expect(rendered).toEqual(bytes);
});

it("places the logo at line 1 columns 10–15 only while the menu is displayed", () => {
  const engine = new ClockEngine(blankMemory());
  engine.press("M");
  expect(engine.snapshot().lines[0]).toBe(`MENU      ${LCD_LOGO_CHARACTERS}`);
  engine.press("↓");
  expect(engine.snapshot().lines[0].slice(10)).toBe(LCD_LOGO_CHARACTERS);
  engine.press("M");
  expect(engine.snapshot().lines.join("")).not.toContain(LCD_LOGO_CHARACTERS);
  expect(lcdGlyphPixels("M")).toBeNull();
});
