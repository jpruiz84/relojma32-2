import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Battery,
  Bell,
  BookOpen,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  CircuitBoard,
  Clock3,
  Code2,
  Download,
  Expand,
  Eye,
  FileText,
  Gauge,
  HelpCircle,
  Info,
  Keyboard,
  Layers,
  LockKeyhole,
  Maximize2,
  MousePointer2,
  Pause,
  Play,
  Power,
  RotateCcw,
  Rotate3D,
  Settings2,
  ShieldCheck,
  SkipForward,
  Upload,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import {
  ClockEngine,
  DAY_NAMES,
  DAYS,
  KEYS,
  PATTERNS,
  clockText,
  demoMemory,
  exportMCH,
  pad,
  parseMCH,
  readAlarm,
  type Alarm,
  type Snapshot,
} from "./engine";
import { DeviceScene, type ViewMode } from "./scene";
import { lcdAccessibleText, lcdGlyphPixels } from "./lcd";
import { COMPONENT_INFO, type Design } from "./design";
import "./style.css";
const STORAGE = "reloj-ma-lab-v1";
function createEngine() {
  const engine = new ClockEngine();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
    if (
      saved &&
      Array.isArray(saved.eeprom) &&
      saved.eeprom.length === 256 &&
      saved.eeprom.every(
        (n: unknown) =>
          typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 255,
      ) &&
      Number.isFinite(saved.now) &&
      saved.now >= 0
    ) {
      engine.eeprom = saved.eeprom;
      engine.now = saved.now;
      engine.powered = saved.powered !== false;
      engine.battery = saved.battery !== false;
      engine.automatic = saved.automatic !== false;
      engine.fuse = saved.fuse !== false;
      if (engine.powered || engine.battery)
        engine.now += Math.max(
          0,
          Math.min((Date.now() - saved.savedAt) / 1000, 86400 * 365),
        );
      else if (Date.now() - saved.savedAt >= 10000) engine.rtcLost = true;
      engine.recompute();
      engine.log = [];
      engine.record("Local EEPROM and RTC restored");
    }
  } catch {
    /* A corrupt browser save must not prevent starting the lab. */
  }
  return engine;
}
function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={"switch " + (checked ? "on" : "")}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
    >
      <span />
    </button>
  );
}
function LCD({ state, color }: { state: Snapshot; color: "blue" | "green" }) {
  return (
    <div
      className={`lcd ${color} ${state.backlight ? "lit" : ""} ${state.powered ? "" : "off"}`}
      role="img"
      aria-label={`LCD: ${lcdAccessibleText(state.lines)}`}
      data-testid="lcd"
    >
      <div className="lcd-inner">
        {state.lines.map((line, row) => (
          <div key={row}>
            {[...line].map((c, col) => (
              <span
                key={col}
                className={
                  state.cursor?.[0] === row && state.cursor[1] === col
                    ? "lcd-cursor"
                    : ""
                }
              >
                {lcdGlyphPixels(c) ? (
                  <svg
                    className="lcd-glyph"
                    data-cgram={c.charCodeAt(0)}
                    viewBox="0 0 5 8"
                    aria-hidden="true"
                    shapeRendering="crispEdges"
                  >
                    {lcdGlyphPixels(c)!.map(({ x, y }) => (
                      <rect
                        key={`${x}-${y}`}
                        x={x}
                        y={y}
                        width="0.9"
                        height="0.9"
                        fill="currentColor"
                      />
                    ))}
                  </svg>
                ) : c === " " ? (
                  "\u00a0"
                ) : (
                  c
                )}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
function Keypad({
  engine,
  refresh,
}: {
  engine: ClockEngine;
  refresh: () => void;
}) {
  const [down, setDown] = useState<string | null>(null);
  const lastPointer = useRef(0);
  useEffect(() => {
    const release = () => {
      engine.releaseAll();
      setDown(null);
      refresh();
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("blur", release);
    };
  }, [engine, refresh]);
  const label = (key: string) =>
    key === "Enter"
      ? "Enter"
      : key === "↑"
        ? "Up"
        : key === "↓"
          ? "Down"
          : key === "*"
            ? "Backlight"
            : key === "#"
              ? "Hold to ring"
              : key === "M"
                ? "Menu"
                : key;
  return (
    <div className="keypad">
      {KEYS.map((key, i) => (
        <button
          key={key}
          aria-label={label(key)}
          data-testid={`key-${key === "Enter" ? "enter" : key === "↑" ? "up" : key === "↓" ? "down" : key === "#" ? "ring" : key === "*" ? "light" : key.toLowerCase()}`}
          className={`${i % 4 === 3 ? "function-key" : ""} ${down === key ? "pressed" : ""} ${key === "M" ? "menu-key" : ""}`}
          onPointerDown={(e) => {
            e.preventDefault();
            lastPointer.current = Date.now();
            e.currentTarget.setPointerCapture(e.pointerId);
            setDown(key);
            engine.press(key);
            refresh();
          }}
          onPointerUp={() => {
            engine.release(key);
            setDown(null);
            refresh();
          }}
          onPointerCancel={() => {
            engine.release(key);
            setDown(null);
            refresh();
          }}
          onClick={() => {
            if (Date.now() - lastPointer.current < 500) return;
            engine.press(key);
            refresh();
            if (key === "#")
              setTimeout(() => {
                engine.release(key);
                refresh();
              }, 180);
          }}
          disabled={!engine.powered}
        >
          {key === "↑" ? (
            <ArrowUp size={17} />
          ) : key === "↓" ? (
            <ArrowDown size={17} />
          ) : key === "Enter" ? (
            <span className="enter-symbol">↵</span>
          ) : (
            key
          )}
          <small>
            {key === "M"
              ? "MENU"
              : key === "*"
                ? "LIGHT"
                : key === "#"
                  ? "RING"
                  : key === "Enter"
                    ? "ENTER"
                    : ""}
          </small>
        </button>
      ))}
    </div>
  );
}
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function App() {
  const [engine] = useState(createEngine);
  const [state, setState] = useState(() => engine.snapshot());
  const [design, setDesign] = useState<Design | null>(null);
  const [tab, setTab] = useState<
    "operate" | "schedule" | "electronics" | "references"
  >("operate");
  const [mode, setMode] = useState<ViewMode>("assembled");
  const [labels, setLabels] = useState(false);
  const [autorotate, setAutorotate] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [lcdColor, setLCDColor] = useState<"blue" | "green">("blue");
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [sound, setSound] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showClock, setShowClock] = useState(false);
  const [photo, setPhoto] = useState<number | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const scene = useRef<DeviceScene | null>(null);
  const audio = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  const refresh = useCallback(() => setState(engine.snapshot()), [engine]);
  const act = useCallback(
    (fn: () => void) => {
      fn();
      refresh();
    },
    [refresh],
  );
  const pick = useCallback((ref: string) => {
    setSelected(ref);
    setTab("electronics");
  }, []);
  useEffect(() => {
    fetch("assets/design.json")
      .then((r) => {
        if (!r.ok) throw new Error("Design asset manifest is unavailable.");
        return r.json();
      })
      .then(setDesign)
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    if (!design || !stage.current) return;
    try {
      scene.current = new DeviceScene(stage.current, design, {
        press: (key) => act(() => engine.press(key)),
        release: (key) => act(() => engine.release(key)),
        select: pick,
        toggleSwitch: () => act(() => engine.setAutomatic(!engine.automatic)),
        loaded: () => setLoaded(true),
        error: setError,
      });
    } catch (e) {
      setError(
        "3D rendering requires WebGL 2. The keypad simulator remains available. " +
          String(e),
      );
    }
    return () => {
      scene.current?.dispose();
      scene.current = null;
    };
  }, [design, engine, act, pick]);
  useEffect(() => {
    scene.current?.setOptions({ mode, labels, autorotate, selected, lcdColor });
  }, [mode, labels, autorotate, selected, lcdColor, design]);
  useEffect(() => {
    scene.current?.update(state);
  }, [state]);
  useEffect(() => {
    let last = performance.now();
    const interval = setInterval(() => {
      const now = performance.now(),
        dt = (now - last) / 1000;
      last = now;
      if (running) engine.advance(dt * speed);
      refresh();
    }, 100);
    return () => clearInterval(interval);
  }, [engine, running, speed, refresh]);
  useEffect(() => {
    const save = () => {
      try {
        localStorage.setItem(
          STORAGE,
          JSON.stringify({
            eeprom: engine.eeprom,
            now: engine.now,
            savedAt: Date.now(),
            powered: engine.powered,
            battery: engine.battery,
            automatic: engine.automatic,
            fuse: engine.fuse,
          }),
        );
      } catch {
        setStorageError(true);
      }
    };
    save();
    const id = setInterval(save, 2000);
    window.addEventListener("pagehide", save);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [engine, state.revision]);
  useEffect(() => {
    const keymap: Record<string, string> = {
      ArrowUp: "↑",
      ArrowDown: "↓",
      Enter: "Enter",
      Escape: "M",
      m: "M",
      M: "M",
      "*": "*",
      "#": "#",
    };
    const mapped = (e: KeyboardEvent) =>
      keymap[e.key] || (/^\d$/.test(e.key) ? e.key : null);
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        showHelp ||
        showClock ||
        photo !== null ||
        ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName) ||
        target.isContentEditable
      )
        return;
      const key = mapped(e);
      if (!key) return;
      e.preventDefault();
      if (e.type === "keydown" && !e.repeat) engine.press(key);
      if (e.type === "keyup") engine.release(key);
      refresh();
    };
    const release = () => {
      engine.releaseAll();
      refresh();
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", handler);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", handler);
      window.removeEventListener("blur", release);
    };
  }, [engine, refresh, showHelp, showClock, photo]);
  useEffect(() => {
    if (audio.current)
      audio.current.gain.gain.setTargetAtTime(
        sound && state.relay ? 0.022 : 0,
        audio.current.ctx.currentTime,
        0.018,
      );
  }, [state.relay, sound]);
  useEffect(
    () => () => {
      void audio.current?.ctx.close();
    },
    [],
  );
  const toggleSound = () => {
    if (!audio.current) {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      for (const hz of [740, 1110, 1485]) {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = hz;
        osc.connect(gain);
        osc.start();
      }
      audio.current = { ctx, gain };
    }
    void audio.current.ctx.resume();
    setSound((v) => !v);
  };
  const inspect = () => {
    setMode(mode === "assembled" ? "open" : "assembled");
  };
  const next = state.next,
    active = state.eeprom
      .slice(242, 249)
      .filter((n) => n >= 1 && n <= 4).length;
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="./" aria-label="Galeras Digital lab">
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          <span>
            GALERAS <b>DIGITAL</b>
            <small>ENGINEERING ARCHIVE</small>
          </span>
        </a>
        <div className="top-separator" />
        <span className="lab-title">
          Interactive lab <span>01</span>
        </span>
        <div className="top-right">
          <span className="version">FIRMWARE 06/12</span>
          <a href="assets/firmware.asm.txt" target="_blank" rel="noreferrer">
            <Code2 size={15} /> Assembly source <ArrowUpRight size={13} />
          </a>
          <button
            onClick={() => setShowHelp(true)}
            aria-label="Open simulator guide"
          >
            <HelpCircle size={18} />
          </button>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="small-line" /> THE ORIGINAL, RECONSTRUCTED
            </div>
            <h1>
              Reloj MA <span>32-2</span>
            </h1>
            <p>A programmable school bell. An entire system to explore.</p>
          </div>
          <div className="heading-right">
            <span className="live-badge">
              <i className={running && state.powered ? "pulse" : ""} />
              {running ? "SIMULATION LIVE" : "SIMULATION PAUSED"}
            </span>
            <button className="text-button" onClick={() => setShowHelp(true)}>
              How to use the lab <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
        <nav className="tabs" aria-label="Lab sections">
          {(
            [
              { id: "operate", label: "Operate", icon: MousePointer2 },
              { id: "schedule", label: "Schedules", icon: Clock3 },
              { id: "electronics", label: "Electronics", icon: CircuitBoard },
              { id: "references", label: "Source archive", icon: BookOpen },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              className={tab === id ? "active" : ""}
              key={id}
              onClick={() => {
                setTab(id);
                if (id === "electronics" && mode === "assembled")
                  setMode("open");
              }}
            >
              <Icon size={16} />
              {label}
              {id === "references" && <span className="tab-count">15</span>}
            </button>
          ))}
          <div className="tabs-caption">
            <span className="tiny-dot" /> Local simulation · saved on this
            device
          </div>
        </nav>
        {storageError && (
          <div role="alert" className="notice">
            Browser storage is unavailable. Export your EEPROM before closing
            the lab.
          </div>
        )}
        <div className="workspace">
          <section className="viewer-card">
            <div className="viewer-top">
              <div className="model-caption">
                <span className="model-dot" />
                C57 ENCLOSURE<span className="slash">/</span>
                <span>
                  {mode === "assembled"
                    ? "ASSEMBLED"
                    : mode === "open"
                      ? "COVER REMOVED"
                      : "EXPLODED VIEW"}
                </span>
              </div>
              <div className="viewport-tools">
                <button
                  className={labels ? "active" : ""}
                  onClick={() => setLabels(!labels)}
                  aria-label="Toggle component labels"
                  title="Component labels (cover removed)"
                >
                  <Eye size={16} />
                </button>
                <button
                  className={autorotate ? "active" : ""}
                  onClick={() => setAutorotate(!autorotate)}
                  aria-label="Toggle automatic rotation"
                  title="Auto rotate"
                >
                  <Rotate3D size={17} />
                </button>
                <button
                  onClick={() => scene.current?.resetView()}
                  aria-label="Reset camera"
                  title="Reset view"
                >
                  <Maximize2 size={16} />
                </button>
              </div>
            </div>
            <div
              className="viewport"
              ref={stage}
              data-testid="viewport"
              data-model-loaded={loaded}
            >
              {!loaded && !error && (
                <div className="loading">
                  <div className="loader" />
                  <span>Loading original board geometry…</span>
                </div>
              )}
              {error && (
                <div className="viewer-error" role="alert">
                  <Info />
                  {error}
                </div>
              )}
              <div className="viewport-note">
                <span className="axis-icon">✳</span>
                <span>
                  113.1 × 154.8 mm<small>Measured front panel</small>
                </span>
              </div>
              <div className="orientation">
                <span>Y</span>
                <div className="axis-y" />
                <div className="axis-x" />
                <div className="axis-z" />
                <small>X</small>
                <b>Z</b>
              </div>
            </div>
            <div className="viewer-bottom">
              <div className="view-presets">
                <button
                  onClick={() => scene.current?.resetView("perspective")}
                  title="Perspective view"
                >
                  <Box size={16} />
                </button>
                <button onClick={() => scene.current?.resetView("front")}>
                  Front
                </button>
                <button onClick={() => scene.current?.resetView("back")}>
                  Back
                </button>
                <button onClick={() => scene.current?.resetView("bottom")}>
                  Ports
                </button>
              </div>
              <span className="orbit-hint">
                <MousePointer2 size={13} /> Drag to orbit <span>·</span> Scroll
                to zoom
              </span>
              <button
                className={
                  "cover-button " + (mode !== "assembled" ? "removed" : "")
                }
                onClick={inspect}
              >
                <Layers size={16} />
                {mode === "assembled" ? "Remove cover" : "Replace cover"}
              </button>
            </div>
            <div className="transport">
              <div className="transport-title">
                <Clock3 size={17} />
                <span>VIRTUAL TIME</span>
              </div>
              <button
                className="play-button"
                aria-label={running ? "Pause simulation" : "Resume simulation"}
                onClick={() => setRunning(!running)}
              >
                {running ? (
                  <Pause size={15} fill="currentColor" />
                ) : (
                  <Play size={15} fill="currentColor" />
                )}
              </button>
              <strong className="virtual-clock">
                {pad(state.hour)}:{pad(state.minute)}
                <span>:{pad(state.second)}</span>
              </strong>
              <span className="day-pill">{DAYS[state.day]}</span>
              <button
                className="icon-button"
                onClick={() => setShowClock(true)}
                aria-label="Set virtual time"
                title="Set virtual time"
              >
                <Settings2 size={15} />
              </button>
              <div className="transport-spacer" />
              <label className="speed">
                <Gauge size={15} />
                <select
                  aria-label="Simulation speed"
                  value={speed}
                  onChange={(e) => setSpeed(+e.target.value)}
                >
                  {[1, 10, 60, 600].map((n) => (
                    <option value={n} key={n}>
                      {n}× speed
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} />
              </label>
              <button
                className="step-button"
                onClick={() => act(() => engine.advance(0.5))}
                disabled={running}
                title="Advance half a second while paused"
                aria-label="Step half a second"
              >
                <SkipForward size={15} />
              </button>
              <button
                className="jump-button"
                onClick={() => act(() => engine.jumpToNext())}
                disabled={!next || !state.powered}
                title="Jump to 5 seconds before the next bell"
              >
                Next bell <SkipForward size={14} />
              </button>
            </div>
          </section>
          <aside className="control-panel">
            {tab === "operate" && (
              <>
                <div className="panel-header">
                  <div>
                    <span className="eyebrow">DEVICE CONTROLS</span>
                    <h2>At your fingertips.</h2>
                  </div>
                  <Keyboard size={21} />
                </div>
                <div className="lcd-heading">
                  <span>LCD · 16 × 2</span>
                  <button
                    onClick={() =>
                      setLCDColor(lcdColor === "blue" ? "green" : "blue")
                    }
                    aria-label="Change LCD backlight color"
                  >
                    <i className={"color-dot " + lcdColor} />
                    {lcdColor === "blue" ? "Blue" : "Green"}{" "}
                    <ChevronDown size={11} />
                  </button>
                </div>
                <LCD state={state} color={lcdColor} />
                <div className="screen-hint" aria-live="polite">
                  {state.hint}
                </div>
                <Keypad engine={engine} refresh={refresh} />
                <div className="key-legend">
                  <span>
                    <kbd>M</kbd> Menu
                  </span>
                  <span>
                    <kbd>↵</kbd> Confirm
                  </span>
                  <span>
                    <kbd>#</kbd> Hold to ring
                  </span>
                </div>
                <div className="panel-divider" />
                <div className="toggle-row">
                  <div>
                    <Power size={16} />
                    <span>
                      12 V power
                      <small>
                        {state.powered
                          ? "External supply connected"
                          : "Running on RTC backup only"}
                      </small>
                    </span>
                  </div>
                  <Switch
                    checked={state.powered}
                    onChange={() => act(() => engine.setPower(!state.powered))}
                    label="12 V power"
                  />
                </div>
                <div className="toggle-row">
                  <div>
                    <Bell size={16} />
                    <span>
                      Automatic bell
                      <small>
                        {state.automatic
                          ? "Contact switch enabled"
                          : "Contact switch open"}
                      </small>
                    </span>
                  </div>
                  <Switch
                    checked={state.automatic}
                    onChange={() =>
                      act(() => engine.setAutomatic(!state.automatic))
                    }
                    label="Automatic bell contact switch"
                  />
                </div>
                <div className="panel-footnote">
                  <ShieldCheck size={14} />
                  <span>Configuration persists in local EEPROM.</span>
                </div>
              </>
            )}
            {tab === "schedule" && (
              <SchedulePanel
                state={state}
                engine={engine}
                act={act}
                design={design}
                onError={setError}
              />
            )}
            {tab === "electronics" && (
              <ElectronicsPanel
                design={design}
                state={state}
                engine={engine}
                act={act}
                selected={selected}
                select={setSelected}
                focus={() => scene.current?.focusComponent()}
                mode={mode}
                setMode={setMode}
                labels={labels}
                setLabels={setLabels}
              />
            )}
            {tab === "references" && (
              <ReferencePanel
                design={design}
                openPhoto={setPhoto}
                openGuide={() => setShowHelp(true)}
              />
            )}
          </aside>
        </div>
        <section className="telemetry" aria-label="Live system state">
          <div className="telemetry-item">
            <span className="telemetry-icon">
              <Clock3 size={19} />
            </span>
            <div>
              <span className="eyebrow">NEXT SCHEDULED BELL</span>
              <strong>
                {next
                  ? clockText(next.hour, next.minute)
                  : "No alarm scheduled"}
                {next && (
                  <small>
                    {DAYS[next.day]} · H{next.schedule + 1} /{" "}
                    {pad(next.index + 1)}
                  </small>
                )}
              </strong>
            </div>
            <span className="pattern-pill">
              {next ? PATTERNS[next.type] : "—"}
            </span>
          </div>
          <div className="telemetry-item">
            <span
              className={"telemetry-icon " + (state.relay ? "energized" : "")}
            >
              <Zap size={19} />
            </span>
            <div>
              <span className="eyebrow">POWER CONTACT</span>
              <strong data-testid="contact-state">
                {state.relay ? "Closed · ringing" : "Open · idle"}
                <small>
                  RC0 {state.pin ? "HIGH" : "LOW"} ·{" "}
                  {state.fuse ? "15 A fuse" : "Fuse open"}
                </small>
              </strong>
            </div>
            <i className={"status-dot " + (state.relay ? "green" : "")} />
          </div>
          <div className="telemetry-item">
            <span className="telemetry-icon">
              <Battery size={19} />
            </span>
            <div>
              <span className="eyebrow">REAL-TIME CLOCK</span>
              <strong>
                {state.battery ? "CR2032 backed" : "Backup removed"}
                <small>DS1307 · 32.768 kHz</small>
              </strong>
            </div>
          </div>
          <div className="telemetry-item">
            <span className="telemetry-icon">
              <CircuitBoard size={19} />
            </span>
            <div>
              <span className="eyebrow">PROGRAM MEMORY</span>
              <strong>
                4 schedules × 30
                <small>{active} active weekdays · 256-byte EEPROM</small>
              </strong>
            </div>
          </div>
        </section>
        <section className="lower-grid">
          <div className="activity">
            <div className="section-heading">
              <h3>
                <span className="tiny-dot" /> Activity monitor
              </h3>
              <div>
                <button
                  className={sound ? "sound enabled" : "sound"}
                  onClick={toggleSound}
                >
                  {sound ? <Volume2 size={14} /> : <VolumeX size={14} />} Sound{" "}
                  {sound ? "on" : "off"}
                </button>
                <span className="subtle-label">LIVE OUTPUT</span>
              </div>
            </div>
            <div className="log-rows" data-testid="event-log">
              {state.log.slice(0, 5).map((log) => (
                <div className="log-row" key={log.id}>
                  <time>{log.time}</time>
                  <span className={"log-icon " + log.kind}>
                    {log.kind === "relay" ? (
                      <Zap size={12} />
                    ) : log.kind === "memory" ? (
                      <CircuitBoard size={12} />
                    ) : (
                      <ChevronRight size={12} />
                    )}
                  </span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="archive-card">
            <span className="eyebrow">BUILT FROM THE ORIGINALS</span>
            <h3>
              A little piece of
              <br />
              engineering history.
            </h3>
            <p>
              Original assembly. Production PCB. Real photographs.
              <br />
              Reconstructed from the Galeras Digital archive.
            </p>
            <button
              className="text-button"
              onClick={() => setTab("references")}
            >
              Explore the source material <ArrowUpRight size={15} />
            </button>
            <div className="archive-watermark">
              <CircuitBoard />
            </div>
          </div>
        </section>
        <footer>
          <span>
            GALERAS DIGITAL <span className="footer-dot">/</span> PASTO,
            COLOMBIA <span className="footer-dot">/</span> MA 32-2
          </span>
          <span>
            Behavioral simulation · original PCB geometry{" "}
            <button onClick={() => setShowHelp(true)}>
              About fidelity <Info size={12} />
            </button>
          </span>
        </footer>
      </main>
      {showClock && (
        <ClockDialog
          state={state}
          save={(day, h, m, s) => act(() => engine.setClock(day, h, m, s))}
          close={() => setShowClock(false)}
        />
      )}
      {showHelp && (
        <Dialog
          title="Welcome to the lab."
          close={() => setShowHelp(false)}
          wide
        >
          <div className="guide-intro">
            Explore the MA 32-2 using its real keypad, then lift the cover to
            inspect the original production board.
          </div>
          <div className="guide-grid">
            <div>
              <MousePointer2 />
              <h3>Explore in 3D</h3>
              <p>
                Drag to orbit, scroll or pinch to zoom, and right-drag to pan.
                The front keys and top switch are interactive. Remove the cover,
                then select components in the Electronics tab. Exploded view
                separates the PCB from its mounts.
              </p>
            </div>
            <div>
              <Keyboard />
              <h3>Operate the original menus</h3>
              <p>
                Press M, navigate with ↑ / ↓ and confirm with Enter. Type the
                clock or alarm time as HHMMSS or HHMM, then choose AM/PM. ↓
                increases values; ↑ decreases them, exactly as in the assembly.
              </p>
            </div>
            <div>
              <Clock3 />
              <h3>Test a whole school day</h3>
              <p>
                Start with the clearly labeled demonstration schedule, load an
                archived EEPROM capture, or program your own. Change playback
                speed or jump to five seconds before the next alarm. The pause
                button freezes simulated time.
              </p>
            </div>
            <div>
              <Battery />
              <h3>Try a power interruption</h3>
              <p>
                Disconnect 12 V: the display and relay turn off while the CR2032
                keeps time. Remove the battery too and advance at least 10
                seconds. On power-up the clock returns to Monday midnight and
                password protection is disabled; alarm memory survives.
              </p>
            </div>
          </div>
          <div className="fidelity-note">
            <h3>What is exact, and what is reconstructed?</h3>
            <p>
              The 105-mesh board comes directly from <code>modelo.3DS</code>.
              Its 28 component records and 47 nets come from the ISIS/ARES
              exports. Front dimensions and opening positions come from{" "}
              <code>Caja/medidas.ods</code>. Enclosure depth, assembly offsets,
              relay housing, cable paths and material appearance are inferred
              from the archive; the detached ribbon ends are illustrative. The
              board is the later 2013 revision, while the exterior photographs
              date to 2012.
            </p>
            <p>
              This is a functional TypeScript port, not a cycle-accurate PIC or
              analog circuit emulator. Valid keypad inputs, EEPROM bytes, bell
              pulses and menu blocking follow the assembly. Invalid 12-hour
              inputs are guarded and invalid EEPROM values cannot hang the
              browser. The original BCD alarm-search quirks are retained:
              recomputation skips the current minute and can skip midnight on a
              later day. The LCD colons stay steady because both branches in the
              source print a colon.
            </p>
            <p>
              The top switch is modeled in series with Q2 as shown by J5 in the
              netlist; it blocks physical output even when # or a scheduled
              alarm sets RC0. RING!! can therefore appear without a closed
              contact. Sound is a synthesized indication, not a recording of the
              original bell. Browser-closed time advances the backed-up RTC on
              reopening but cannot ring alarms in the background.
            </p>
            <a href="assets/firmware.asm.txt" target="_blank" rel="noreferrer">
              Read the original assembly <ArrowUpRight size={13} />
            </a>
          </div>
        </Dialog>
      )}
      {photo !== null && design && (
        <Dialog
          title={
            design.photos[photo].source.split("/").pop() || "Archive photograph"
          }
          close={() => setPhoto(null)}
          wide
        >
          <img
            className="lightbox-image"
            src={design.photos[photo].url}
            alt={design.photos[photo].source}
          />
          <p className="photo-source">{design.photos[photo].source}</p>
          <div className="lightbox-nav">
            <button
              onClick={() =>
                setPhoto(
                  (photo + design.photos.length - 1) % design.photos.length,
                )
              }
            >
              ← Previous
            </button>
            <span>
              {photo + 1} / {design.photos.length}
            </span>
            <button
              onClick={() => setPhoto((photo + 1) % design.photos.length)}
            >
              Next →
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function SchedulePanel({
  state,
  engine,
  act,
  design,
  onError,
}: {
  state: Snapshot;
  engine: ClockEngine;
  act: (fn: () => void) => void;
  design: Design | null;
  onError: (s: string) => void;
}) {
  const [schedule, setSchedule] = useState(0),
    [edit, setEdit] = useState<number | null>(null),
    [section, setSection] = useState<"alarms" | "week" | "memory">("alarms");
  const [draft, setDraft] = useState<Alarm>({
    hour: 7,
    minute: 0,
    type: 0,
    enabled: true,
    valid: true,
  });
  const [preset, setPreset] = useState("");
  const [notice, setNotice] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const locked =
    !!(state.eeprom[253] & 1) && ["home", "unlock"].includes(state.screen);
  return (
    <>
      <div className="panel-header">
        <div>
          <span className="eyebrow">PROGRAMMABLE MEMORY</span>
          <h2>Every bell, on time.</h2>
        </div>
        <Clock3 size={21} />
      </div>
      <div className="mini-tabs">
        {(["alarms", "week", "memory"] as const).map((v) => (
          <button
            key={v}
            className={v === section ? "active" : ""}
            onClick={() => {
              setSection(v);
              setEdit(null);
            }}
          >
            {v === "alarms" ? "Alarms" : v === "week" ? "Week plan" : "EEPROM"}
          </button>
        ))}
      </div>
      {section === "alarms" && (
        <>
          <div className="schedule-selector">
            {[0, 1, 2, 3].map((i) => (
              <button
                key={i}
                className={schedule === i ? "active" : ""}
                onClick={() => {
                  setSchedule(i);
                  setEdit(null);
                }}
              >
                H{i + 1}
                <small>
                  {
                    Array.from({ length: 30 }, (_, j) =>
                      readAlarm(state.eeprom, i, j),
                    ).filter((a) => a.enabled && a.valid).length
                  }{" "}
                  active
                </small>
              </button>
            ))}
          </div>
          {locked && (
            <p className="inline-info">
              <LockKeyhole size={15} /> Unlock through M on the Operate keypad
              to edit.
            </p>
          )}
          {edit !== null ? (
            <form
              className="alarm-editor"
              onSubmit={(e) => {
                e.preventDefault();
                if (locked) return;
                act(() => engine.saveAlarm(schedule, edit, draft));
                setEdit(null);
              }}
            >
              <div className="editor-heading">
                <h3>
                  H{schedule + 1} · Alarm {pad(edit + 1)}
                </h3>
                <button
                  type="button"
                  aria-label="Cancel alarm editing"
                  onClick={() => setEdit(null)}
                >
                  <X size={17} />
                </button>
              </div>
              <label>
                Time (24-hour)
                <input
                  required
                  aria-label="Alarm time"
                  type="time"
                  value={`${pad(draft.hour)}:${pad(draft.minute)}`}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const [hour, minute] = e.target.value
                      .split(":")
                      .map(Number);
                    setDraft({ ...draft, hour, minute });
                  }}
                />
              </label>
              <label>
                Bell pattern
                <select
                  aria-label="Alarm bell pattern"
                  value={draft.type}
                  onChange={(e) =>
                    setDraft({ ...draft, type: +e.target.value })
                  }
                >
                  {PATTERNS.map((p, i) => (
                    <option key={p} value={i}>
                      {p} ·{" "}
                      {["One short", "One long", "Two short", "Three short"][i]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="toggle-row">
                <span>Alarm enabled</span>
                <Switch
                  checked={draft.enabled}
                  onChange={() =>
                    setDraft({ ...draft, enabled: !draft.enabled })
                  }
                  label="Alarm enabled"
                />
              </div>
              <button
                className="primary-button"
                disabled={locked}
                type="submit"
              >
                <Check size={16} />
                Save to EEPROM
              </button>
            </form>
          ) : (
            <>
              <div className="alarm-list-head">
                <span>SLOT</span>
                <span>TIME</span>
                <span>PATTERN</span>
                <span>STATE</span>
              </div>
              <div className="alarm-list">
                {Array.from({ length: 30 }, (_, i) => {
                  const a = readAlarm(state.eeprom, schedule, i);
                  return (
                    <button
                      className={
                        "alarm-row " + (a.enabled ? "" : "disabled-alarm")
                      }
                      key={i}
                      onClick={() => {
                        setDraft({
                          ...a,
                          hour: a.valid ? a.hour : 7,
                          minute: a.valid ? a.minute : 0,
                        });
                        setEdit(i);
                      }}
                      disabled={locked}
                      aria-label={`Edit H${schedule + 1} alarm ${i + 1}`}
                    >
                      <span>{pad(i + 1)}</span>
                      <strong>
                        {a.valid ? clockText(a.hour, a.minute) : "Invalid BCD"}
                      </strong>
                      <span>{PATTERNS[a.type]}</span>
                      <span
                        className={"alarm-state " + (a.enabled ? "on" : "")}
                      >
                        {a.enabled ? "ON" : "OFF"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="panel-footnote">
                <Info size={14} /> 30 slots per schedule. Select a row to edit.
              </p>
            </>
          )}
        </>
      )}
      {section === "week" && (
        <>
          <p className="panel-copy">
            Assign one of four schedules to each weekday. OFF skips that day.
          </p>
          {locked && (
            <p className="inline-info">
              <LockKeyhole size={15} /> Unlock through the original keypad to
              edit.
            </p>
          )}
          <div className="week-list">
            {DAY_NAMES.map((name, i) => (
              <label key={name}>
                <span>
                  {name}
                  {i === state.day && <small>TODAY</small>}
                </span>
                <select
                  aria-label={`${name} schedule`}
                  disabled={locked}
                  value={state.eeprom[242 + i]}
                  onChange={(e) =>
                    act(() => engine.assignDay(i, +e.target.value))
                  }
                >
                  <option value={0}>OFF</option>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      Schedule {n}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="duration-card">
            <div className="section-heading">
              <h3>Bell duration</h3>
              <span>1–16 SEC</span>
            </div>
            {[
              ["Short bell · TC", 251],
              ["Long bell · TL", 252],
            ].map(([name, address]) => (
              <label key={name as string}>
                <span>{name}</span>
                <select
                  aria-label={name as string}
                  disabled={locked}
                  value={(state.eeprom[address as number] & 15) + 1}
                  onChange={(e) =>
                    act(() =>
                      engine.setDurations(
                        address === 251
                          ? +e.target.value
                          : (state.eeprom[251] & 15) + 1,
                        address === 252
                          ? +e.target.value
                          : (state.eeprom[252] & 15) + 1,
                      ),
                    )
                  }
                >
                  {Array.from({ length: 16 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1}s
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <p>Multi-pulse patterns pause for 1 second between bells.</p>
          </div>
        </>
      )}
      {section === "memory" && (
        <>
          <p className="panel-copy">
            Load original MPLAB memory captures or export your configuration.
            These lab controls write EEPROM directly.
          </p>
          <label className="form-label">
            Archived configuration
            <select
              aria-label="Archived configuration"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
            >
              <option value="">Choose a capture…</option>
              {design?.presets.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} · {p.bytes.length} bytes
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary-button"
            disabled={!preset}
            onClick={() => {
              const p = design?.presets.find((p) => p.name === preset);
              if (p) {
                act(() => engine.importBytes(p.bytes, p.source));
                setNotice(
                  `${p.source} loaded. ${p.complete ? "All 256 bytes replaced." : `Only the first ${p.bytes.length} bytes replaced; other bytes retained.`}`,
                );
              }
            }}
          >
            <Upload size={15} /> Load capture
          </button>
          <p className="small-note">
            Loading replaces the supplied EEPROM bytes, including any stored
            password. Export first to keep your current configuration.
          </p>
          <div className="memory-actions">
            <button
              onClick={() =>
                download("reloj-ma-config.MCH", exportMCH(state.eeprom))
              }
            >
              <Download size={15} />
              Export .MCH
            </button>
            <button onClick={() => file.current?.click()}>
              <Upload size={15} />
              Import .MCH
            </button>
            <input
              ref={file}
              hidden
              type="file"
              accept=".MCH,.mch,.txt"
              aria-label="Import EEPROM file"
              onChange={async (e) => {
                const p = e.target.files?.[0];
                if (p)
                  try {
                    const bytes = parseMCH(await p.text());
                    act(() => engine.importBytes(bytes, p.name));
                    setNotice(`${bytes.length} bytes loaded from ${p.name}.`);
                  } catch (err) {
                    setNotice(String(err));
                  }
                e.target.value = "";
              }}
            />
          </div>
          <button
            className="demo-button"
            onClick={() => {
              act(() => {
                engine.importBytes(demoMemory(), "Demonstration schedule");
                engine.setClock(0, 6, 59, 50);
              });
              setNotice(
                "Demonstration schedule loaded. Monday 06:59:50, next bell at 07:00.",
              );
              onError("");
            }}
          >
            <RotateCcw size={14} /> Load demonstration
          </button>
          {notice && (
            <p className="inline-info" role="status">
              {notice}
            </p>
          )}
          <details className="memory-dump">
            <summary>
              Inspect 256 EEPROM bytes <ChevronDown size={13} />
            </summary>
            <div>
              {Array.from({ length: 16 }, (_, row) => (
                <div key={row}>
                  <span>
                    {(row * 16).toString(16).padStart(2, "0").toUpperCase()}
                  </span>
                  {state.eeprom.slice(row * 16, row * 16 + 16).map((v, i) => (
                    <b key={i}>
                      {v.toString(16).padStart(2, "0").toUpperCase()}
                    </b>
                  ))}
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </>
  );
}
function ElectronicsPanel({
  design,
  state,
  engine,
  act,
  selected,
  select,
  focus,
  mode,
  setMode,
  labels,
  setLabels,
}: {
  design: Design | null;
  state: Snapshot;
  engine: ClockEngine;
  act: (fn: () => void) => void;
  selected: string | null;
  select: (s: string) => void;
  focus: () => void;
  mode: ViewMode;
  setMode: (s: ViewMode) => void;
  labels: boolean;
  setLabels: (v: boolean) => void;
}) {
  const info = selected ? COMPONENT_INFO[selected] : null,
    part = design?.components.find((p) => p.ref === selected);
  const nets =
    design?.nets.filter((n) => n.connections.some((c) => c.ref === selected)) ||
    [];
  return (
    <>
      <div className="panel-header">
        <div>
          <span className="eyebrow">UNDER THE COVER</span>
          <h2>Explore the circuit.</h2>
        </div>
        <CircuitBoard size={22} />
      </div>
      <div className="exploded-control">
        <button
          className={mode === "open" ? "active" : ""}
          onClick={() => setMode("open")}
        >
          <Layers size={15} /> Open
        </button>
        <button
          className={mode === "exploded" ? "active" : ""}
          onClick={() => setMode("exploded")}
        >
          <Expand size={15} /> Exploded
        </button>
        <button
          className={labels ? "active" : ""}
          onClick={() => setLabels(!labels)}
          aria-label="Show component labels"
        >
          <Eye size={15} />
        </button>
      </div>
      <label className="form-label">
        Inspect a component
        <select
          aria-label="Inspect component"
          value={selected || ""}
          onChange={(e) => select(e.target.value)}
        >
          <option value="">Choose a component…</option>
          {design?.components.map((p) => (
            <option key={p.ref} value={p.ref}>
              {p.ref} · {COMPONENT_INFO[p.ref]?.title || p.value}
            </option>
          ))}
          <option value="RELAY">External relay · 12 V / 40 A</option>
          <option value="FUSE">Panel fuse · 15 A</option>
          <option value="LCD">LCD · 16 × 2</option>
        </select>
      </label>
      {selected ? (
        <div className="component-detail">
          <button className="text-button focus-component" onClick={focus}>
            <Maximize2 size={14} /> Focus component in 3D
          </button>
          <span className="component-ref">
            {selected}
            <span>{part?.package || "ASSEMBLY"}</span>
          </span>
          <h3>{info?.title || part?.value}</h3>
          <p>
            {info?.description ||
              `${part?.device} (${part?.value}), at x = ${part?.x} mm, y = ${part?.y} mm in the original ARES placement file. Its shape and position come directly from the production 3D export.`}
          </p>
          <div className="component-source">
            <FileText size={13} />
            <span>
              {info?.source || "Circuitos/Version 2/placa real.SDF + .EDF"}
            </span>
          </div>
          {nets.length > 0 && (
            <details className="net-details">
              <summary>
                {nets.length} connected nets <ChevronDown size={13} />
              </summary>
              <div>
                {nets.map((n) => (
                  <div key={n.name}>
                    <code>{n.name}</code>
                    <span>
                      {n.connections
                        .map((c) => `${c.ref}.${c.pin}`)
                        .join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      ) : (
        <div className="circuit-intro">
          <div className="circuit-symbol">
            <CircuitBoard size={36} />
          </div>
          <h3>Original production geometry.</h3>
          <p>
            105 meshes, 28 components and the actual copper traces. Select a
            component to follow its role in the system.
          </p>
          <div className="quick-components">
            {["U2", "U1", "BAT1", "Q2"].map((ref) => (
              <button key={ref} onClick={() => select(ref)}>
                {ref}
                <span>
                  {ref === "BAT1"
                    ? "Battery"
                    : ref === "Q2"
                      ? "Relay driver"
                      : COMPONENT_INFO[ref].title.split(" ")[0]}
                </span>
                <ChevronRight size={13} />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="panel-divider" />
      <span className="eyebrow">POWER & BACKUP EXPERIMENTS</span>
      <div className="toggle-row">
        <div>
          <Battery size={16} />
          <span>
            CR2032 battery
            <small>
              {state.battery ? "RTC backup connected" : "Backup disconnected"}
            </small>
          </span>
        </div>
        <Switch
          label="CR2032 battery"
          checked={state.battery}
          onChange={() => act(() => engine.setBattery(!state.battery))}
        />
      </div>
      <div className="toggle-row">
        <div>
          <ShieldCheck size={16} />
          <span>
            15 A fuse
            <small>
              {state.fuse ? "Load circuit intact" : "Load circuit open"}
            </small>
          </span>
        </div>
        <Switch
          label="15 A fuse"
          checked={state.fuse}
          onChange={() => act(() => engine.setFuse(!state.fuse))}
        />
      </div>
      <p className="small-note">
        The PCB is exact source geometry. Cover mounting, relay housing and
        cable routing are reconstructed from the available drawings and photos.
      </p>
    </>
  );
}
function ReferencePanel({
  design,
  openPhoto,
  openGuide,
}: {
  design: Design | null;
  openPhoto: (n: number) => void;
  openGuide: () => void;
}) {
  return (
    <>
      <div className="panel-header">
        <div>
          <span className="eyebrow">THE DESIGN ARCHIVE</span>
          <h2>Grounded in the real.</h2>
        </div>
        <BookOpen size={21} />
      </div>
      <p className="panel-copy">
        All 15 supplied raster images, including product views, installations
        and supporting artwork, are catalogued here. The drawings and original
        PCB supply the hidden geometry.
      </p>
      <div className="document-links">
        {[
          {
            url: "assets/firmware.asm.txt",
            title: "Original assembly",
            sub: "PIC16F877A · firmware 06/12",
            icon: Code2,
          },
          {
            url: "assets/manual.pdf",
            title: "User manual",
            sub: "Original Spanish documentation",
            icon: BookOpen,
          },
          {
            url: "assets/pcb.pdf",
            title: "Production PCB artwork",
            sub: "Copper and silkscreen · version 2",
            icon: CircuitBoard,
          },
          {
            url: "assets/schematic.txt",
            title: "Schematic & netlist",
            sub: "28 parts · 47 electrical nets",
            icon: FileText,
          },
        ].map(({ url, title, sub, icon: Icon }) => (
          <a href={url} key={url} target="_blank" rel="noreferrer">
            <Icon size={18} />
            <span>
              {title}
              <small>{sub}</small>
            </span>
            <ArrowUpRight size={14} />
          </a>
        ))}
      </div>
      <div className="section-heading photo-heading">
        <h3>Photographic references</h3>
        <span>{design?.photos.length || 15} FILES</span>
      </div>
      <div className="photo-grid">
        {design?.photos.map((p, i) => (
          <button
            key={p.source}
            onClick={() => openPhoto(i)}
            aria-label={`View ${p.source}`}
          >
            <img src={p.url} alt={p.source} loading="lazy" />
            <span>
              {pad(i + 1)}
              <Maximize2 size={11} />
            </span>
          </button>
        ))}
      </div>
      <div className="drawing-links">
        {["frente1", "superior1", "inferior1", "teclado1", "conpotencia"].map(
          (name, i) => (
            <a
              key={name}
              href={`assets/${name}.svg`}
              target="_blank"
              rel="noreferrer"
            >
              {
                [
                  "Front drawing",
                  "Top switch drawing",
                  "Bottom connectors",
                  "Keypad layout",
                  "Bell connection",
                ][i]
              }{" "}
              <ArrowUpRight size={11} />
            </a>
          ),
        )}
      </div>
      <button className="text-button fidelity-link" onClick={openGuide}>
        Read reconstruction notes <Info size={14} />
      </button>
    </>
  );
}
function Dialog({
  title,
  close,
  children,
  wide = false,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "dialog wide" : "dialog"}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button onClick={close} aria-label="Close dialog" autoFocus>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function ClockDialog({
  state,
  save,
  close,
}: {
  state: Snapshot;
  save: (d: number, h: number, m: number, s: number) => void;
  close: () => void;
}) {
  const [day, setDay] = useState(state.day),
    [time, setTime] = useState(
      `${pad(state.hour)}:${pad(state.minute)}:${pad(state.second)}`,
    );
  return (
    <Dialog title="Set virtual time" close={close}>
      <p className="panel-copy">
        Position the simulated DS1307 at any weekday and time to test your
        schedule. The clock also accepts changes through the original keypad.
      </p>
      <form
        className="clock-form"
        onSubmit={(e) => {
          e.preventDefault();
          const [h, m, s = 0] = time.split(":").map(Number);
          save(day, h, m, s);
          close();
        }}
      >
        <label>
          Weekday
          <select
            value={day}
            onChange={(e) => setDay(+e.target.value)}
            aria-label="Virtual weekday"
          >
            {DAY_NAMES.map((d, i) => (
              <option value={i} key={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          Time (24-hour)
          <input
            type="time"
            step="1"
            value={time}
            required
            onChange={(e) => setTime(e.target.value)}
            aria-label="Virtual clock time"
          />
        </label>
        <button type="submit" className="primary-button">
          <Check size={16} /> Set clock
        </button>
      </form>
    </Dialog>
  );
}
export default App;
