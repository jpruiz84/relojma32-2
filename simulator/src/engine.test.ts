import { describe, it, expect } from "vitest";
import {
  ClockEngine,
  blankMemory,
  writeAlarm,
  readAlarm,
  findNext,
  parseMCH,
  exportMCH,
  bcd,
  timeParts,
} from "./engine";
import fs from "node:fs";
function fixture(type = 0, seconds = 2) {
  const e = blankMemory();
  e[242] = 1;
  e[251] = seconds - 1;
  e[252] = 5;
  writeAlarm(e, 0, 0, { hour: 7, minute: 0, type, enabled: true });
  const sim = new ClockEngine(e);
  sim.setClock(0, 6, 59, 59);
  return sim;
}
function menu(sim: ClockEngine, n: number) {
  sim.press("M");
  for (let i = 0; i < n; i++) sim.press("↓");
  sim.press("Enter");
}
function keys(sim: ClockEngine, text: string) {
  for (const k of text) sim.press(k);
}
describe("EEPROM is compatible with the original PIC encoding", () => {
  it("uses the first and last physical alarm addresses without touching configuration", () => {
    const e = blankMemory();
    writeAlarm(e, 0, 0, { hour: 13, minute: 42, type: 3, enabled: true });
    writeAlarm(e, 3, 29, { hour: 23, minute: 59, type: 2, enabled: false });
    expect(e[2]).toBe(0xd3);
    expect(e[3]).toBe(0xc2);
    expect(e[240]).toBe(0xa3);
    expect(e[241]).toBe(0x59);
    expect(e[242]).toBe(0);
    expect(readAlarm(e, 3, 29)).toMatchObject({
      hour: 23,
      minute: 59,
      type: 2,
      enabled: false,
      valid: true,
    });
  });
  it("stores durations minus one and preserves all bytes through an MPLAB export", () => {
    const s = fixture();
    s.setDurations(1, 16);
    expect(s.eeprom[251]).toBe(0);
    expect(s.eeprom[252]).toBe(15);
    expect(parseMCH(exportMCH(s.eeprom))).toEqual(s.eeprom);
  });
  it("round-trips every original capture and merges partial captures without erasing its tail", () => {
    const design = JSON.parse(
      fs.readFileSync("public/assets/design.json", "utf8"),
    );
    for (const p of design.presets) {
      expect(parseMCH(exportMCH(p.bytes))).toEqual(p.bytes);
      const s = fixture();
      const tail = s.eeprom.slice(p.bytes.length);
      s.importBytes(p.bytes, p.name);
      expect(s.eeprom.slice(0, p.bytes.length)).toEqual(p.bytes);
      expect(s.eeprom.slice(p.bytes.length)).toEqual(tail);
    }
  });
  it("rejects malformed imported bytes, oversize files, and invalid alarm fields", () => {
    for (const v of [
      "",
      "XYZ",
      "100",
      "0x10",
      "02 0G",
      Array(257).fill("00").join(" "),
    ])
      expect(() => parseMCH(v)).toThrow();
    expect(() =>
      writeAlarm(blankMemory(), 0, 0, {
        hour: 24,
        minute: 0,
        type: 0,
        enabled: true,
      }),
    ).toThrow();
  });
  it("retains invalid raw EEPROM without running undefined BCD alarms", () => {
    const s = fixture();
    s.eeprom[2] = 0xff;
    s.eeprom[3] = 0xff;
    expect(readAlarm(s.eeprom, 0, 0).valid).toBe(false);
    expect(findNext(s.eeprom, s.now)).toBe(null);
  });
});
describe("COMPALARMAS selection and firmware quirks", () => {
  it("finds an unsorted alarm and picks the first slot at duplicate times", () => {
    const e = blankMemory();
    e[242] = 1;
    for (const [index, hour, minute] of [
      [0, 9, 0],
      [1, 7, 0],
      [2, 7, 0],
      [3, 8, 20],
    ])
      writeAlarm(e, 0, index, { hour, minute, type: 0, enabled: true });
    expect(findNext(e, 6 * 3600)?.index).toBe(1);
    expect(findNext(e, 7 * 3600)?.index).toBe(3);
  });
  it("skips OFF days and wraps from Sunday into Monday", () => {
    const s = fixture();
    s.setClock(6, 23, 59, 30);
    expect(s.next).toMatchObject({
      day: 0,
      hour: 7,
      due: 7 * 86400 + 7 * 3600,
    });
  });
  it("returns no next alarm with empty schedules or disabled days", () => {
    expect(findNext(blankMemory(), 0)).toBe(null);
    const s = fixture();
    s.eeprom[3] &= 127;
    expect(findNext(s.eeprom, 0)).toBe(null);
  });
  it("excludes the currently programmed minute after a recomputation", () => {
    const s = fixture();
    s.setClock(0, 7, 0, 0);
    expect(s.next?.due).toBe(7 * 86400 + 7 * 3600);
    s.advance(30);
    expect(s.pin).toBe(false);
  });
  it("retains the future-midnight exclusion in the source", () => {
    const e = blankMemory();
    e[243] = 1;
    writeAlarm(e, 0, 0, { hour: 0, minute: 0, type: 0, enabled: true });
    expect(findNext(e, 23 * 3600)).toBe(null);
  });
  it("retains the BCD difference-sum exclusion (11:31 from 10:32)", () => {
    const e = blankMemory();
    e[242] = 1;
    writeAlarm(e, 0, 0, { hour: 11, minute: 31, type: 0, enabled: true });
    writeAlarm(e, 0, 1, { hour: 11, minute: 40, type: 0, enabled: true });
    expect(findNext(e, 10 * 3600 + 32 * 60)?.index).toBe(1);
  });
});
describe("relay sequences and interrupts", () => {
  it.each([
    [0, 2],
    [1, 6],
  ])(
    "executes pattern %i for exactly %i seconds and a 1 s recovery delay",
    (type, duration) => {
      const s = fixture(type);
      s.advance(1);
      expect(s.pin).toBe(true);
      s.advance(duration - 0.01);
      expect(s.pin).toBe(true);
      s.advance(0.01);
      expect(s.pin).toBe(false);
      expect(s.ringing).toBe(true);
      s.advance(1);
      expect(s.ringing).toBe(false);
    },
  );
  it.each([
    [2, 2],
    [3, 3],
  ])(
    "executes pattern %i with %i short pulses and 1 second gaps",
    (type, pulses) => {
      const s = fixture(type);
      s.advance(1);
      for (let i = 0; i < pulses; i++) {
        expect(s.relay).toBe(true);
        s.advance(2);
        expect(s.relay).toBe(false);
        s.advance(1);
      }
      expect(s.ringing).toBe(false);
      expect(
        s.log.filter((e) => e.message.startsWith("RC0 HIGH")),
      ).toHaveLength(pulses);
    },
  );
  it("does not skip alarm events at accelerated speed", () => {
    const s = fixture(3);
    s.advance(600);
    expect(s.log.filter((e) => e.message.startsWith("RC0 HIGH"))).toHaveLength(
      3,
    );
    expect(s.ringing).toBe(false);
  });
  it("holds # until release and ignores repeated keydown events while ringing", () => {
    const s = fixture();
    s.press("#");
    s.press("#");
    s.advance(12);
    expect(s.relay).toBe(true);
    s.release("#");
    expect(s.relay).toBe(false);
    expect(s.screen).toBe("home");
  });
  it("models the J5 series contact switch and fuse separately from RC0", () => {
    const s = fixture();
    s.setAutomatic(false);
    s.press("#");
    expect(s.pin).toBe(true);
    expect(s.relay).toBe(false);
    s.setAutomatic(true);
    expect(s.relay).toBe(true);
    s.setFuse(false);
    expect(s.relay).toBe(false);
    expect(s.pin).toBe(true);
    s.releaseAll();
    expect(s.pin).toBe(false);
  });
  it("blocks alarm checking inside menus, and does not replay missed alarms on exit", () => {
    const s = fixture();
    s.press("M");
    s.advance(10);
    expect(s.pin).toBe(false);
    expect(s.snapshot().backlight).toBe(true);
    s.press("M");
    s.advance(10);
    expect(s.pin).toBe(false);
    expect(s.next?.due).toBeGreaterThan(86400);
  });
  it("times out the backlight after ten seconds and wakes it on any key", () => {
    const s = new ClockEngine(blankMemory());
    s.advance(10);
    expect(s.snapshot().backlight).toBe(false);
    s.press("*");
    expect(s.snapshot().backlight).toBe(true);
    s.advance(10);
    expect(s.snapshot().backlight).toBe(false);
  });
});
describe("original keypad workflows", () => {
  it("sets clock using HHMMSS, AM/PM and weekday", () => {
    const s = fixture();
    menu(s, 0);
    keys(s, "123456");
    s.press("↓");
    s.press("Enter");
    s.press("↓");
    s.press("Enter");
    expect(timeParts(s.now)).toMatchObject({
      day: 1,
      hour: 12,
      minute: 34,
      second: 56,
    });
    expect(s.screen).toBe("home");
  });
  it("edits slot 30 of H4 and saves type, enabled bit, and midnight conversion", () => {
    const s = fixture();
    menu(s, 1);
    s.press("↑");
    s.press("Enter");
    s.press("↑");
    s.press("Enter");
    keys(s, "1201");
    s.press("Enter");
    s.press("↑");
    s.press("Enter");
    s.press("↓");
    s.press("Enter");
    expect(readAlarm(s.eeprom, 3, 29)).toMatchObject({
      hour: 0,
      minute: 1,
      type: 3,
      enabled: true,
    });
    s.press("M");
    expect(s.screen).toBe("home");
  });
  it("changes daily assignments with correct down-increments direction", () => {
    const s = fixture();
    menu(s, 2);
    s.press("↓");
    s.press("Enter");
    s.press("↓");
    s.press("↓");
    s.press("Enter");
    expect(s.eeprom[243]).toBe(2);
    s.press("M");
    expect(s.screen).toBe("home");
  });
  it("wraps TC/TL settings and writes both only at final confirmation", () => {
    const s = fixture();
    menu(s, 4);
    s.press("↑");
    s.press("↑");
    expect(s.eeprom[251]).toBe(1);
    s.press("Enter");
    s.press("↓");
    s.press("Enter");
    expect(s.eeprom[251]).toBe(15);
    expect(s.eeprom[252]).toBe(6);
  });
  it("enables a four-digit password, rejects a wrong password, times out, then unlocks", () => {
    const s = new ClockEngine(blankMemory());
    menu(s, 3);
    s.press("↓");
    s.press("Enter");
    keys(s, "1234");
    keys(s, "1234");
    expect(s.eeprom[253] & 1).toBe(1);
    expect(s.eeprom[254]).toBe(0x12);
    s.press("Enter");
    s.press("M");
    keys(s, "4321");
    expect(s.screen).toBe("home");
    s.press("M");
    s.advance(5.1);
    expect(s.screen).toBe("home");
    s.press("M");
    keys(s, "1234");
    expect(s.screen).toBe("menu");
  });
  it("does not replace a password when confirmation differs", () => {
    const s = fixture();
    menu(s, 3);
    s.press("↓");
    s.press("Enter");
    keys(s, "1234");
    keys(s, "1235");
    expect(s.eeprom[253] & 1).toBe(0);
    expect(s.snapshot().lines[0].trim()).toBe("Contraseña error");
  });
  it("validates the defined AM/PM input range and keeps both LCD rows at 16 columns", () => {
    const s = fixture();
    menu(s, 0);
    keys(s, "19");
    expect(s.draft.digits).toBe("1");
    for (const l of s.snapshot().lines) expect(l).toHaveLength(16);
  });
});
describe("power and nonvolatile storage", () => {
  it("keeps RTC running on battery while power and display are off", () => {
    const s = fixture();
    const now = s.now;
    s.setPower(false);
    s.advance(120);
    expect(s.now).toBe(now + 120);
    expect(s.snapshot().lines).toEqual([
      "                ",
      "                ",
    ]);
    expect(s.pin).toBe(false);
    s.setPower(true);
    expect(s.now).toBe(now + 120);
  });
  it("requires loss of both supplies for ten seconds; battery removal alone leaves the clock intact", () => {
    const s = fixture();
    s.eeprom[253] = 1;
    s.eeprom[254] = bcd(12);
    s.setBattery(false);
    s.advance(11);
    expect(s.rtcLost).toBe(false);
    s.setPower(false);
    s.advance(9.9);
    expect(s.rtcLost).toBe(false);
    s.advance(0.1);
    expect(s.rtcLost).toBe(true);
    s.setPower(true);
    expect(s.now).toBe(0);
    expect(s.eeprom[253] & 1).toBe(0);
    expect(readAlarm(s.eeprom, 0, 0).enabled).toBe(true);
  });
  it("cuts off an active relay immediately when power is lost", () => {
    const s = fixture();
    s.press("#");
    s.setPower(false);
    expect(s.pin).toBe(false);
    s.setPower(true);
    expect(s.relay).toBe(false);
  });
  it("retains a lost-RTC flag when the backup is reinserted before restoring 12 V", () => {
    const s = fixture();
    s.setPower(false);
    s.setBattery(false);
    s.advance(11);
    s.setBattery(true);
    s.advance(20);
    s.setPower(true);
    expect(s.now).toBe(0);
  });
});
