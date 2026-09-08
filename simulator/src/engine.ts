/** Functional port of relojma.asm, revision 06/12. Source mappings: docs/FIDELITY.md. */
import { LCD_LOGO_CHARACTERS } from "./lcd";
export const DAYS = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"];
export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export const PATTERNS = ["1TC", "1TL", "2TC", "3TC"] as const;
export const MENU = [
  "Fijar Reloj",
  "Fijar Alarmas",
  "Tipo de horario",
  "Contraseña",
  "Dura. Timbres",
];
export const KEYS = [
  "1",
  "2",
  "3",
  "Enter",
  "4",
  "5",
  "6",
  "↑",
  "7",
  "8",
  "9",
  "↓",
  "*",
  "0",
  "#",
  "M",
];
export type Alarm = {
  hour: number;
  minute: number;
  type: number;
  enabled: boolean;
  valid: boolean;
};
export type NextAlarm = Alarm & {
  day: number;
  schedule: number;
  index: number;
  due: number;
};
export type LogEntry = {
  id: number;
  time: string;
  message: string;
  kind: "relay" | "system" | "memory";
};
export type Screen =
  | "home"
  | "menu"
  | "unlock"
  | "clockDigits"
  | "clockPeriod"
  | "clockDay"
  | "schedule"
  | "alarms"
  | "alarmDigits"
  | "alarmPeriod"
  | "alarmType"
  | "alarmState"
  | "days"
  | "daySchedule"
  | "passwordState"
  | "passwordNew"
  | "passwordRepeat"
  | "message"
  | "short"
  | "long";
export type Snapshot = {
  now: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  powered: boolean;
  battery: boolean;
  automatic: boolean;
  fuse: boolean;
  relay: boolean;
  pin: boolean;
  ringing: boolean;
  backlight: boolean;
  lines: [string, string];
  cursor: [number, number] | null;
  screen: Screen;
  hint: string;
  next: NextAlarm | null;
  eeprom: number[];
  log: LogEntry[];
  revision: number;
};
export const bcd = (n: number) => (Math.floor(n / 10) << 4) | (n % 10);
export const unbcd = (n: number) => (n >> 4) * 10 + (n & 15);
export const pad = (n: number) => String(n).padStart(2, "0");
const wrap = (n: number, count: number) => ((n % count) + count) % count;
const goodBCD = (n: number) => (n & 15) < 10 && n >> 4 < 10;
export function readAlarm(
  eeprom: number[],
  schedule: number,
  index: number,
): Alarm {
  const address = 2 * (index + 1 + 30 * schedule);
  const h = eeprom[address] & 63,
    m = eeprom[address + 1] & 127;
  return {
    hour: unbcd(h),
    minute: unbcd(m),
    type: eeprom[address] >> 6,
    enabled: !!(eeprom[address + 1] & 128),
    valid: goodBCD(h) && goodBCD(m) && unbcd(h) < 24 && unbcd(m) < 60,
  };
}
export function writeAlarm(
  eeprom: number[],
  schedule: number,
  index: number,
  alarm: Omit<Alarm, "valid">,
) {
  if (
    !Number.isInteger(schedule) ||
    schedule < 0 ||
    schedule > 3 ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 29 ||
    !Number.isInteger(alarm.hour) ||
    alarm.hour < 0 ||
    alarm.hour > 23 ||
    !Number.isInteger(alarm.minute) ||
    alarm.minute < 0 ||
    alarm.minute > 59 ||
    !Number.isInteger(alarm.type) ||
    alarm.type < 0 ||
    alarm.type > 3
  )
    throw new Error("Invalid alarm");
  const address = 2 * (index + 1 + 30 * schedule);
  eeprom[address] = bcd(alarm.hour) | (alarm.type << 6);
  eeprom[address + 1] = bcd(alarm.minute) | (alarm.enabled ? 128 : 0);
}
export function blankMemory() {
  const e = Array<number>(256).fill(0);
  e[251] = 2;
  e[252] = 5;
  return e;
}
export function demoMemory() {
  const e = blankMemory();
  [1, 1, 1, 1, 1, 0, 0].forEach((v, i) => (e[242 + i] = v));
  [
    [7, 0, 1],
    [7, 50, 0],
    [8, 40, 2],
    [9, 0, 0],
    [9, 50, 0],
    [10, 40, 3],
    [11, 0, 0],
    [11, 50, 1],
    [12, 40, 1],
    [14, 0, 0],
    [14, 50, 2],
    [15, 40, 1],
  ].forEach(([hour, minute, type], index) =>
    writeAlarm(e, 0, index, { hour, minute, type, enabled: true }),
  );
  return e;
}
export function parseMCH(text: string): number[] {
  const tokens = text.trim().split(/\s+/);
  if (
    !tokens.length ||
    tokens.length > 256 ||
    tokens.some((v) => !/^[0-9a-f]{2}$/i.test(v))
  )
    throw new Error(
      "Use an MPLAB .MCH file: 1–256 two-digit hexadecimal bytes, separated by whitespace.",
    );
  return tokens.map((v) => parseInt(v, 16));
}
export function exportMCH(e: number[]) {
  return (
    e.map((v) => v.toString(16).toUpperCase().padStart(2, "0")).join("\r\n") +
    "\r\n"
  );
}
export function timeParts(now: number) {
  const day = wrap(Math.floor(now / 86400), 7),
    seconds = wrap(Math.floor(now), 86400);
  return {
    day,
    hour: Math.floor(seconds / 3600),
    minute: Math.floor(seconds / 60) % 60,
    second: seconds % 60,
  };
}
export function clockText(hour: number, minute: number, second?: number) {
  return `${pad(hour % 12 || 12)}:${pad(minute)}${second === undefined ? "" : ":" + pad(second)}${hour < 12 ? "AM" : "PM"}`;
}
/** COMPALARMAS: unsigned BCD subtraction, current-minute exclusion, first-slot tie,
 * one hour retry and day search. Preserve its midnight and BCD-sum exclusion quirks.
 * Bound the search on corrupt/unprogrammed EEPROM instead of emulating a watchdog loop. */
export function findNext(e: number[], now: number): NextAlarm | null {
  if (!e.slice(242, 249).some((v) => v >= 1 && v <= 4)) return null;
  const t = timeParts(now);
  let dayOffset = 0,
    hour = bcd(t.hour),
    minute = bcd(t.minute),
    retried = false;
  for (let guard = 0; guard < 40 && dayOffset <= 8; guard++) {
    const day = (t.day + dayOffset) % 7,
      schedule = e[242 + day] - 1;
    if (schedule < 0 || schedule > 3) {
      dayOffset++;
      hour = 0;
      minute = 0;
      continue;
    }
    let selected = -1,
      bestH = 255,
      bestM = 255,
      minMinute = 255;
    for (let i = 0; i < 30; i++) {
      const a = readAlarm(e, schedule, i);
      if (!a.enabled || !a.valid) continue;
      const ah = bcd(a.hour),
        am = bcd(a.minute),
        dh = (ah - hour) & 255,
        dm = (am - minute) & 255;
      if (((dh + dm) & 255) === 0) continue;
      if (dh === 0) {
        if (am < minute || dm >= bestM) continue;
        bestM = dm;
      } else {
        if (dh !== bestH) {
          if (dh >= bestH) continue;
          minMinute = 255;
        }
        if (am >= minMinute) continue;
        minMinute = am;
      }
      selected = i;
      bestH = dh;
    }
    if (selected < 0 && !retried) {
      retried = true;
      hour = (hour + 1) & 255;
      continue;
    }
    if (selected < 0) {
      dayOffset++;
      hour = 0;
      minute = 0;
      continue;
    }
    const a = readAlarm(e, schedule, selected),
      dh = (bcd(a.hour) - hour) & 255,
      dm = (bcd(a.minute) - minute) & 255;
    if ((dh !== 0 && dh > 0xd0) || (dh === 0 && dm > 0xa0)) {
      dayOffset++;
      hour = 0;
      minute = 0;
      continue;
    }
    const due =
      Math.floor(now / 86400) * 86400 +
      dayOffset * 86400 +
      a.hour * 3600 +
      a.minute * 60;
    // Malformed selector results must never make the browser loop or time travel.
    if (due <= now) {
      dayOffset++;
      hour = 0;
      minute = 0;
      continue;
    }
    return { ...a, day, schedule, index: selected, due };
  }
  return null;
}

type Draft = {
  digits: string;
  hour: number;
  minute: number;
  second: number;
  period: number;
  day: number;
  schedule: number;
  index: number;
  type: number;
  enabled: boolean;
  short: number;
  long: number;
  password: string;
  passwordEnabled: boolean;
};
export class ClockEngine {
  eeprom: number[];
  now = 6 * 3600 + 59 * 60 + 50;
  powered = true;
  battery = true;
  automatic = true;
  fuse = true;
  screen: Screen = "home";
  menu = 0;
  pin = false;
  manual = false;
  next: NextAlarm | null = null;
  log: LogEntry[] = [];
  revision = 0;
  backlightRemaining = 10;
  unlockRemaining = 0;
  batteryAbsent = 0;
  rtcLost = false;
  private sequence: { pin: boolean; remaining: number }[] = [];
  private frozenTime = "";
  private message = "";
  private logId = 0;
  draft: Draft = this.newDraft();
  constructor(eeprom = demoMemory()) {
    this.eeprom = [...eeprom];
    this.recompute();
    this.record("Simulator ready · demonstration schedule", "system");
  }
  private newDraft(): Draft {
    return {
      digits: "",
      hour: 12,
      minute: 0,
      second: 0,
      period: 0,
      day: 0,
      schedule: 0,
      index: 0,
      type: 0,
      enabled: false,
      short: 3,
      long: 6,
      password: "",
      passwordEnabled: false,
    };
  }
  get relay() {
    return this.powered && this.pin && this.automatic && this.fuse;
  }
  get ringing() {
    return this.manual || this.sequence.length > 0;
  }
  record(message: string, kind: LogEntry["kind"] = "system") {
    const t = timeParts(this.now);
    this.log.unshift({
      id: ++this.logId,
      time: `${DAYS[t.day]} ${pad(t.hour)}:${pad(t.minute)}:${pad(t.second)}`,
      message,
      kind,
    });
    this.log = this.log.slice(0, 80);
  }
  recompute() {
    this.next = findNext(this.eeprom, this.now);
  }
  changed(label = "EEPROM saved") {
    this.revision++;
    this.recompute();
    this.record(label, "memory");
  }
  saveAlarm(schedule: number, index: number, alarm: Omit<Alarm, "valid">) {
    writeAlarm(this.eeprom, schedule, index, alarm);
    this.changed(`H${schedule + 1} · alarm ${pad(index + 1)} saved`);
  }
  assignDay(day: number, schedule: number) {
    if (
      day < 0 ||
      day > 6 ||
      schedule < 0 ||
      schedule > 4 ||
      !Number.isInteger(schedule)
    )
      return;
    this.eeprom[242 + day] = schedule;
    this.changed(`${DAY_NAMES[day]} → ${schedule ? "H" + schedule : "OFF"}`);
  }
  setDurations(short: number, long: number) {
    if (![short, long].every((n) => Number.isInteger(n) && n >= 1 && n <= 16))
      return;
    this.eeprom[251] = short - 1;
    this.eeprom[252] = long - 1;
    this.changed("Bell durations saved");
  }
  importBytes(bytes: number[], name: string) {
    if (
      !bytes.length ||
      bytes.length > 256 ||
      bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 255)
    )
      throw new Error("Invalid EEPROM bytes");
    this.stopRing();
    this.home();
    bytes.forEach((v, i) => (this.eeprom[i] = v));
    this.changed(
      `${name}: ${bytes.length} bytes loaded${bytes.length < 256 ? " (remaining bytes retained)" : ""}`,
    );
  }
  setClock(day: number, hour: number, minute: number, second: number) {
    if (
      ![day, hour, minute, second].every(Number.isInteger) ||
      day < 0 ||
      day > 6 ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59 ||
      second < 0 ||
      second > 59
    )
      return;
    this.stopRing();
    this.now = day * 86400 + hour * 3600 + minute * 60 + second;
    this.recompute();
    this.record("RTC time set");
  }
  setPower(value: boolean) {
    if (this.powered === value) return;
    this.powered = value;
    this.stopRing();
    this.screen = "home";
    if (value) {
      if (this.rtcLost) {
        this.now = 0;
        this.eeprom[253] &= 254;
        this.revision++;
        this.rtcLost = false;
        this.record("DS1307 CH reset · Monday 00:00 · password disabled");
      }
      this.backlightRemaining = 10;
      this.recompute();
    }
    this.record(
      value
        ? "12 V supply restored"
        : "12 V supply disconnected · RTC battery backup",
    );
  }
  setBattery(value: boolean) {
    this.battery = value;
    if (value) this.batteryAbsent = 0;
    this.record(value ? "CR2032 inserted" : "CR2032 removed");
  }
  setAutomatic(value: boolean) {
    this.automatic = value;
    this.record(
      value
        ? "Contact switch enabled"
        : "Contact switch open · output inhibited",
    );
  }
  setFuse(value: boolean) {
    this.fuse = value;
    this.record(
      value ? "15 A fuse intact" : "15 A fuse open · load disconnected",
    );
  }
  private setPin(value: boolean) {
    if (this.pin !== value) {
      this.pin = value;
      this.record(
        value
          ? `RC0 HIGH · ${this.relay ? "contact closed" : "contact inhibited"}`
          : "RC0 LOW · contact open",
        "relay",
      );
    }
  }
  private stopRing() {
    this.manual = false;
    this.sequence = [];
    this.setPin(false);
  }
  private startRing(type: number) {
    const seconds = (this.eeprom[type === 1 ? 252 : 251] & 15) + 1,
      pulses = type === 2 ? 2 : type === 3 ? 3 : 1;
    this.frozenTime = this.homeLines()[0];
    for (let i = 0; i < pulses; i++) {
      this.sequence.push({ pin: true, remaining: seconds });
      if (i < pulses - 1) this.sequence.push({ pin: false, remaining: 1 });
    }
    this.sequence.push({ pin: false, remaining: 1 }); // TESTEARALARMAFIN recovery delay
    this.backlightRemaining = 10;
    this.setPin(true);
    this.record(
      `${PATTERNS[type]} · ${pulses} pulse${pulses > 1 ? "s" : ""} × ${seconds}s`,
      "relay",
    );
  }
  /** Advance every half-second boundary so high playback speeds never skip alarms. */
  advance(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    let remaining = seconds;
    while (remaining > 1e-7) {
      const half = 0.5 - (this.now % 0.5);
      const dt = Math.min(remaining, half < 1e-7 ? 0.5 : half);
      remaining -= dt;
      if (!this.powered && !this.battery) {
        this.batteryAbsent += dt;
        if (this.batteryAbsent >= 10) this.rtcLost = true;
      } else {
        this.now += dt;
        this.batteryAbsent = 0;
      }
      if (!this.powered) continue;
      if (this.screen === "unlock") {
        this.unlockRemaining -= dt;
        if (this.unlockRemaining <= 0) {
          this.record("Password entry timed out");
          this.home();
        }
      }
      if (this.manual) continue;
      if (this.sequence.length) {
        this.sequence[0].remaining -= dt;
        if (this.sequence[0].remaining <= 1e-7) {
          this.sequence.shift();
          if (this.sequence.length) this.setPin(this.sequence[0].pin);
          else {
            this.setPin(false);
            this.backlightRemaining = 10;
            this.recompute();
          }
        }
        continue;
      }
      if (this.screen !== "home") continue;
      this.backlightRemaining = Math.max(0, this.backlightRemaining - dt);
      const t = timeParts(this.now);
      if (
        this.next &&
        this.now >= this.next.due &&
        t.day === this.next.day &&
        t.hour === this.next.hour &&
        t.minute === this.next.minute
      )
        this.startRing(this.next.type);
    }
  }
  jumpToNext() {
    if (!this.next) return;
    const due = this.next.due;
    this.stopRing();
    this.screen = "home";
    this.now = due - 5;
    this.backlightRemaining = 10;
    this.record("Jumped to five seconds before next alarm");
  }
  release(key: string) {
    if (key === "#" && this.manual) {
      this.manual = false;
      this.setPin(false);
      this.home();
    }
  }
  releaseAll() {
    this.release("#");
  }
  private home() {
    this.screen = "home";
    this.draft.digits = "";
    this.backlightRemaining = 10;
    this.recompute();
  }
  private loadAlarm() {
    const a = readAlarm(this.eeprom, this.draft.schedule, this.draft.index);
    Object.assign(this.draft, a, {
      hour: a.hour % 12 || 12,
      period: a.hour >= 12 ? 1 : 0,
      digits: "",
    });
  }
  private digit(key: string, count: number, next: Screen) {
    if (!/^\d$/.test(key)) return;
    const i = this.draft.digits.length,
      n = +key;
    if ((i === 0 && n > 1) || ((i === 2 || i === 4) && n > 5)) return;
    // Browser input guard: reject undefined 00/13–19 AM/PM hours (firmware accepts 00–19).
    if (
      i === 1 &&
      (Number(this.draft.digits + key) < 1 ||
        Number(this.draft.digits + key) > 12)
    )
      return;
    this.draft.digits += key;
    if (this.draft.digits.length === count) {
      this.draft.hour = +this.draft.digits.slice(0, 2);
      this.draft.minute = +this.draft.digits.slice(2, 4);
      if (count === 6) this.draft.second = +this.draft.digits.slice(4, 6);
      this.screen = next;
    }
  }
  press(key: string) {
    if (!this.powered || this.ringing) return;
    this.backlightRemaining = 10;
    const d = this.draft,
      direction = key === "↓" ? 1 : key === "↑" ? -1 : 0,
      enter = key === "Enter";
    if (this.screen === "home") {
      if (key === "#") {
        this.manual = true;
        this.frozenTime = "";
        this.setPin(true);
      }
      if (key === "M") {
        this.draft = this.newDraft();
        this.menu = 0;
        this.screen = this.eeprom[253] & 1 ? "unlock" : "menu";
        this.unlockRemaining = 5.1;
      }
      return;
    }
    switch (this.screen) {
      case "unlock":
        if (/^\d$/.test(key)) d.digits += key;
        if (d.digits.length === 4) {
          const pass =
            pad(unbcd(this.eeprom[254])) + pad(unbcd(this.eeprom[255]));
          if (d.digits === pass) {
            this.screen = "menu";
            this.record("Menu unlocked");
          } else {
            this.record("Incorrect password");
            this.home();
          }
          d.digits = "";
        }
        break;
      case "menu":
        if (key === "M") {
          this.home();
          break;
        }
        this.menu = wrap(this.menu + direction, 5);
        if (enter) {
          const t = timeParts(this.now);
          Object.assign(d, {
            ...t,
            hour: t.hour % 12 || 12,
            period: t.hour >= 12 ? 1 : 0,
            digits: "",
            short: (this.eeprom[251] & 15) + 1,
            long: (this.eeprom[252] & 15) + 1,
            passwordEnabled: !!(this.eeprom[253] & 1),
          });
          this.screen = (
            [
              "clockDigits",
              "schedule",
              "days",
              "passwordState",
              "short",
            ] as Screen[]
          )[this.menu];
          if (this.screen === "days") d.day = 0;
        }
        break;
      case "clockDigits":
        this.digit(key, 6, "clockPeriod");
        break;
      case "clockPeriod":
        if (direction) d.period = 1 - d.period;
        if (enter) this.screen = "clockDay";
        break;
      case "clockDay":
        d.day = wrap(d.day + direction, 7);
        if (enter) {
          this.setClock(
            d.day,
            (d.hour % 12) + d.period * 12,
            d.minute,
            d.second,
          );
          this.home();
        }
        break;
      case "schedule":
        d.schedule = wrap(d.schedule + direction, 4);
        if (enter) {
          d.index = 0;
          this.loadAlarm();
          this.screen = "alarms";
        }
        break;
      case "alarms":
        if (key === "M") {
          this.home();
          break;
        }
        if (direction) {
          d.index = wrap(d.index + direction, 30);
          this.loadAlarm();
        }
        if (enter) {
          d.digits = "";
          this.screen = "alarmDigits";
        }
        break;
      case "alarmDigits":
        this.digit(key, 4, "alarmPeriod");
        break;
      case "alarmPeriod":
        if (direction) d.period = 1 - d.period;
        if (enter) this.screen = "alarmType";
        break;
      case "alarmType":
        d.type = wrap(d.type + direction, 4);
        if (enter) this.screen = "alarmState";
        break;
      case "alarmState":
        if (direction) d.enabled = !d.enabled;
        if (enter) {
          this.saveAlarm(d.schedule, d.index, {
            hour: (d.hour % 12) + d.period * 12,
            minute: d.minute,
            type: d.type,
            enabled: d.enabled,
          });
          this.screen = "alarms";
        }
        break;
      case "days":
        if (key === "M") {
          this.home();
          break;
        }
        d.day = wrap(d.day + direction, 7);
        if (enter) {
          d.schedule = this.eeprom[242 + d.day];
          this.screen = "daySchedule";
        }
        break;
      case "daySchedule":
        d.schedule = wrap(d.schedule + direction, 5);
        if (enter) {
          this.assignDay(d.day, d.schedule);
          this.screen = "days";
        }
        break;
      case "passwordState":
        if (key === "M") {
          this.home();
          break;
        }
        if (direction) d.passwordEnabled = !d.passwordEnabled;
        if (enter) {
          if (d.passwordEnabled) {
            d.digits = "";
            this.screen = "passwordNew";
          } else {
            this.eeprom[253] &= 254;
            this.changed("Password disabled");
            this.home();
          }
        }
        break;
      case "passwordNew":
        if (/^\d$/.test(key)) d.digits += key;
        if (d.digits.length === 4) {
          d.password = d.digits;
          d.digits = "";
          this.screen = "passwordRepeat";
        }
        break;
      case "passwordRepeat":
        if (/^\d$/.test(key)) d.digits += key;
        if (d.digits.length === 4) {
          if (d.password === d.digits) {
            this.eeprom[253] |= 1;
            this.eeprom[254] = bcd(+d.password.slice(0, 2));
            this.eeprom[255] = bcd(+d.password.slice(2));
            this.changed("Password enabled");
            this.message = "Contraseña|cambiada";
          } else this.message = "Contraseña error|";
          this.screen = "message";
        }
        break;
      case "message":
        this.home();
        break;
      case "short":
        d.short = wrap(d.short - 1 + direction, 16) + 1;
        if (enter) this.screen = "long";
        break;
      case "long":
        d.long = wrap(d.long - 1 + direction, 16) + 1;
        if (enter) {
          this.setDurations(d.short, d.long);
          this.home();
        }
        break;
    }
  }
  private homeLines(): [string, string] {
    const t = timeParts(this.now);
    return [
      `${clockText(t.hour, t.minute, t.second)} - ${DAYS[t.day]}`,
      `PROX→${this.next ? clockText(this.next.hour, this.next.minute) + "-" + DAYS[this.next.day] : ""}`,
    ];
  }
  snapshot(): Snapshot {
    const t = timeParts(this.now),
      d = this.draft;
    let lines = this.homeLines(),
      cursor: [number, number] | null = null,
      hint = "M opens the menu. Hold # to ring. * wakes the backlight.";
    const alarmTitle = `Alarma No:${pad(d.index + 1)}-H${d.schedule + 1}`;
    const alarmLine = () =>
      `${pad(d.hour)}:${pad(d.minute)}${d.period ? "PM" : "AM"} ${PATTERNS[d.type]} ${d.enabled ? "ON" : "OFF"}`;
    switch (this.screen) {
      case "menu":
        lines = [`MENU      ${LCD_LOGO_CHARACTERS}`, MENU[this.menu]];
        hint = "↑ / ↓ selects a menu. Enter opens it. M exits.";
        break;
      case "unlock":
        lines = ["Contraseña", "*".repeat(d.digits.length)];
        cursor = [1, d.digits.length];
        hint = `Enter the four-digit password · ${Math.max(0, this.unlockRemaining).toFixed(1)}s remaining`;
        break;
      case "clockDigits":
      case "clockPeriod":
      case "clockDay": {
        const raw = d.digits.padEnd(6, "_");
        const entry =
          this.screen === "clockDigits"
            ? `${raw.slice(0, 2)}:${raw.slice(2, 4)}:${raw.slice(4, 6)}`
            : `${pad(d.hour)}:${pad(d.minute)}:${pad(d.second)}`;
        lines = [`${entry}${d.period ? "PM" : "AM"} - ${DAYS[d.day]}`, ""];
        cursor = [
          0,
          this.screen === "clockDigits"
            ? d.digits.length + Math.floor(d.digits.length / 2)
            : this.screen === "clockPeriod"
              ? 8
              : 13,
        ];
        hint =
          this.screen === "clockDigits"
            ? "Type six digits: HH MM SS (12-hour time)."
            : this.screen === "clockPeriod"
              ? "↑ / ↓ changes AM/PM. Enter continues."
              : "↑ / ↓ changes the weekday. Enter saves the clock.";
        break;
      }
      case "schedule":
        lines = [`Horario:${d.schedule + 1}`, ""];
        cursor = [0, 8];
        hint = "↑ / ↓ chooses H1–H4. Enter opens its 30 alarm slots.";
        break;
      case "alarms":
        lines = [alarmTitle, alarmLine()];
        hint = "↑ / ↓ selects alarm 01–30. Enter edits it. M saves and exits.";
        break;
      case "alarmDigits":
      case "alarmPeriod":
      case "alarmType":
      case "alarmState": {
        let line = alarmLine();
        if (this.screen === "alarmDigits") {
          const raw = d.digits.padEnd(4, "_");
          line = `${raw.slice(0, 2)}:${raw.slice(2, 4)}` + line.slice(5);
        }
        lines = [alarmTitle, line];
        cursor = [
          1,
          this.screen === "alarmDigits"
            ? d.digits.length + Math.floor(d.digits.length / 2)
            : this.screen === "alarmPeriod"
              ? 5
              : this.screen === "alarmType"
                ? 8
                : 12,
        ];
        hint =
          this.screen === "alarmDigits"
            ? "Type four digits: HH MM (12-hour time)."
            : `↑ / ↓ changes ${this.screen === "alarmPeriod" ? "AM/PM" : this.screen === "alarmType" ? "bell pattern" : "ON/OFF"}. Enter ${this.screen === "alarmState" ? "saves" : "continues"}.`;
        break;
      }
      case "days":
      case "daySchedule": {
        const value =
          this.screen === "days" ? this.eeprom[242 + d.day] : d.schedule;
        lines = [`${DAYS[d.day]}:${value || "OFF"}`, ""];
        cursor = this.screen === "daySchedule" ? [0, 4] : null;
        hint =
          this.screen === "days"
            ? "↑ / ↓ selects a weekday. Enter changes its schedule. M exits."
            : "↑ / ↓ selects OFF or H1–H4. Enter saves.";
        break;
      }
      case "passwordState":
        lines = ["Pedir Contraseña", d.passwordEnabled ? "SI" : "NO"];
        cursor = [1, 0];
        hint =
          "↑ / ↓ enables or disables the password. Enter continues. M exits.";
        break;
      case "passwordNew":
      case "passwordRepeat":
        lines = [
          `${this.screen === "passwordNew" ? "N" : "RN"} Contraseña`,
          "*".repeat(d.digits.length),
        ];
        cursor = [1, d.digits.length];
        hint =
          this.screen === "passwordNew"
            ? "Type a new four-digit password."
            : "Repeat the four digits to save.";
        break;
      case "message":
        lines = this.message.split("|") as [string, string];
        hint = "Press any key to return to the clock.";
        break;
      case "short":
      case "long":
        lines = [
          `${this.screen === "short" ? "TC" : "TL"}:${pad(this.screen === "short" ? d.short : d.long)}s`,
          this.screen === "short" ? "        V:06/12" : "",
        ];
        cursor = [0, 3];
        hint = `↑ / ↓ selects 1–16 seconds. Enter ${this.screen === "short" ? "continues to the long bell" : "saves both durations"}.`;
        break;
    }
    if (this.ringing) {
      lines = [this.frozenTime, this.pin ? "      RING!!" : ""];
      cursor = null;
      hint = this.manual
        ? "Release # to open the contact."
        : "Firmware is busy executing the bell sequence.";
    }
    if (!this.powered) {
      lines = ["", ""];
      cursor = null;
      hint = "Restore the 12 V supply to operate the keypad.";
    }
    return {
      ...t,
      now: this.now,
      powered: this.powered,
      battery: this.battery,
      automatic: this.automatic,
      fuse: this.fuse,
      relay: this.relay,
      pin: this.pin,
      ringing: this.ringing,
      backlight:
        this.powered &&
        (this.backlightRemaining > 0 || this.screen !== "home" || this.ringing),
      lines: lines.map((l) => l.padEnd(16).slice(0, 16)) as [string, string],
      cursor,
      screen: this.screen,
      hint,
      next: this.next,
      eeprom: [...this.eeprom],
      log: [...this.log],
      revision: this.revision,
    };
  }
}
