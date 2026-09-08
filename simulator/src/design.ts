export type Component = {
  ref: string;
  device: string;
  value: string;
  package: string;
  x: number;
  y: number;
  rotation: number;
};
export type Design = {
  photos: { source: string; url: string; width: number; height: number }[];
  components: Component[];
  nets: { name: string; connections: { ref: string; pin: string }[] }[];
  traces: { layer: string; width: number; points: number[][] }[];
  presets: {
    name: string;
    source: string;
    bytes: number[];
    complete: boolean;
  }[];
};
export const COMPONENT_INFO: Record<
  string,
  { title: string; description: string; source: string }
> = {
  U2: {
    title: "PIC16F877A",
    description:
      "40-pin controller. Executes the keypad menus and 120-alarm comparison logic at 4 MHz. RC0 drives the bell; RC1 controls the LCD backlight. Its 256-byte EEPROM stores the schedules.",
    source: "relojma.asm · INICIO / TESTEARALARMA",
  },
  U1: {
    title: "DS1307 real-time clock",
    description:
      "Keeps time on the CR2032 backup cell. Software I²C uses RA3 (SCL) and RA4 (SDA). The 1 Hz square wave reaches RB0/INT; firmware alternates edges for 500 ms updates.",
    source: "Librerias/DS1307.INC · schematic U1",
  },
  BAT1: {
    title: "CR2032 · 3 V backup",
    description:
      "Powers only the real-time clock when the 12 V supply is absent. Disconnect both supplies for at least 10 simulated seconds, then restore power to reset the clock and disable the menu password.",
    source: "INICIO · DS1307_CargaInicial · Manual/manual.tex",
  },
  U3: {
    title: "7805 voltage regulator",
    description:
      "Converts the 12 V input to the 5 V logic rail. Mounted with the heatsink represented by the original ARES model.",
    source: "placa real.SDF · U3 / 12V / VCC",
  },
  Q1: {
    title: "2N2222 · backlight driver",
    description:
      "Driven through R1 by RC1, switching the LCD backlight at J1 pin 12. Normal operation turns the backlight off after 20 half-second updates.",
    source: "placa real.SDF · RC1 / #00065 / #00066",
  },
  Q2: {
    title: "2N2222 · relay driver",
    description:
      "RC0 reaches R4 and the base of Q2 through the two-pin J5 switch connection. Q2 switches the external 12 V relay at J3; D3 clamps the coil transient.",
    source: "placa real.SDF · RC0 / #00075 / #00076 / #00077",
  },
  X1: {
    title: "32.768 kHz crystal",
    description:
      "The watch crystal connected to DS1307 pins 1 and 2 sets the real-time clock frequency.",
    source: "placa real.SDF · X1 / #00026 / #00027",
  },
  X2: {
    title: "4 MHz PIC oscillator",
    description:
      "Connected to PIC pins 13 and 14 with C1/C2 (22 pF). Firmware and BOM specify 4 MHz; the schematic X2 FREQ property contains a conflicting 32.768 kHz value.",
    source: "relojma.asm · XT_OSC / BOM / schematic X2",
  },
  J1: {
    title: "12-pin LCD header",
    description:
      "LCD power, contrast and four-bit data interface: RD1 = RS, RD2 = R/W, RD3 = E, RD4–RD7 = data. Ribbon cable routing is inferred from the assembly.",
    source: "placa real.SDF · J1 / PORTD",
  },
  TECLADO: {
    title: "8-pin keypad header",
    description:
      "Matrix rows: RA0, RB1, RB2, RB3. Columns: RB4–RB7. The key table maps the right column to Enter, up, down and M.",
    source: "Librerias/TECLADO.INC · Tecl_ConvierteOrdenEnHex",
  },
  J2: {
    title: "12 V supply input",
    description: "Two-pin input header. J2 pin 2 is +12 V and pin 1 is ground.",
    source: "placa real.SDF · J2",
  },
  J3: {
    title: "External relay connection",
    description:
      "J3 pin 2 connects to +12 V and pin 1 to the collector of Q2. The 12 V / 40 A automotive relay is mounted separately in the enclosure.",
    source: "placa real.SDF · J3 / materials BOM",
  },
  J5: {
    title: "Contact enable switch",
    description:
      "Series connection between RC0 and R4/Q2. An open switch blocks physical relay actuation, including the manual # command, while firmware can still display RING!!.",
    source: "placa real.SDF · J5 / Manual interruptor",
  },
  RELAY: {
    title: "12 V / 40 A relay",
    description:
      "External relay specified by the manufacturing BOM. Its power contact is protected by a 15 A fuse. The separate relay housing and wiring are reconstructed; they are not part of the PCB export.",
    source: "Otros/Materiales Fabricación.ods · Manual/manual.tex",
  },
  FUSE: {
    title: "15 A contact fuse",
    description:
      "Panel-mounted cartridge fuse protects the load contact. Opening it disconnects the simulated bell without stopping the clock or the RC0 signal.",
    source: "Manual/manual.tex · Caja/conectores.dxf",
  },
  LCD: {
    title: "16 × 2 LCD",
    description:
      "Live, 32-character LCD display using the same screen content as the keypad simulation. Blue illumination follows the product photograph; green is available for the installed units.",
    source: "Manual/figuras/principal 1000p.png · installation photos",
  },
};
