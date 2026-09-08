/** LCD_DIBLOGORET: six 5 × 8 CGRAM characters, in firmware byte order. */
export const LCD_LOGO_GLYPHS = [
  [0b00000, 0b00000, 0b00000, 0b00001, 0b00111, 0b11100, 0b11100, 0b01111],
  [0b00000, 0b00011, 0b01110, 0b11000, 0b00011, 0b00011, 0b00000, 0b11111],
  [0b11110, 0b11110, 0b00110, 0b00000, 0b11110, 0b11110, 0b00110, 0b11110],
  [0b01111, 0b01111, 0b01100, 0b01100, 0b01100, 0b01100, 0b01100, 0b01111],
  [0b00000, 0b11000, 0b01110, 0b00011, 0b00000, 0b00000, 0b00000, 0b11111],
  [0b00000, 0b00000, 0b00000, 0b10000, 0b11100, 0b00111, 0b00111, 0b11110],
] as const;

// ITECLADO1 writes codes 0–5 at zero-based columns 10–15 of line 1.
export const LCD_LOGO_CHARACTERS = "\x00\x01\x02\x03\x04\x05";

/** Shared by the accessible SVG display and the 3D canvas texture. */
export function lcdGlyphPixels(character: string) {
  const rows = LCD_LOGO_GLYPHS[character.charCodeAt(0)];
  if (!rows) return null;
  return rows.flatMap((bits, y) =>
    Array.from({ length: 5 }, (_, x) => ({ x, y })).filter(
      ({ x }) => bits & (1 << (4 - x)),
    ),
  );
}

export function lcdAccessibleText(lines: readonly string[]) {
  return lines
    .join(" / ")
    .replaceAll(LCD_LOGO_CHARACTERS, "Galeras Digital logo");
}
