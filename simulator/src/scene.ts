import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TDSLoader } from "three/addons/loaders/TDSLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { Design } from "./design";
import type { Snapshot } from "./engine";
import { KEYS } from "./engine";
import { lcdGlyphPixels } from "./lcd";
export type ViewMode = "assembled" | "open" | "exploded";
export type SceneOptions = {
  mode: ViewMode;
  labels: boolean;
  autorotate: boolean;
  selected: string | null;
  lcdColor: "blue" | "green";
};
type Callbacks = {
  press: (key: string) => void;
  release: (key: string) => void;
  select: (ref: string) => void;
  toggleSwitch: () => void;
  loaded: () => void;
  error: (error: string) => void;
};
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const paint = new THREE.MeshStandardMaterial({
  color: 0x12181a,
  metalness: 0.38,
  roughness: 0.64,
});
const black = new THREE.MeshStandardMaterial({
  color: 0x101416,
  roughness: 0.5,
});
const metal = new THREE.MeshStandardMaterial({
  color: 0xa9b2b7,
  metalness: 0.88,
  roughness: 0.26,
});
const boardMat = new THREE.MeshStandardMaterial({
  color: 0x194c39,
  roughness: 0.62,
});
function box(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material = paint,
  round = 0,
) {
  const mesh = new THREE.Mesh(
    round
      ? new RoundedBoxGeometry(w, h, d, 2, round)
      : new THREE.BoxGeometry(w, h, d),
    material,
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function cylinder(
  parent: THREE.Object3D,
  r: number,
  length: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material = metal,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, length, 24),
    material,
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function plaque(
  parent: THREE.Object3D,
  text: string,
  w: number,
  h: number,
  x: number,
  y: number,
  z: number,
  options: { bg?: string; fg?: string; font?: number } = {},
) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = Math.max(64, Math.round((512 * h) / w));
  const ctx = c.getContext("2d")!;
  if (options.bg) {
    ctx.fillStyle = options.bg;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  ctx.fillStyle = options.fg || "#dadfdc";
  ctx.font = `${options.font || Math.round(c.height * 0.58)}px "Arial", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  text
    .split("\n")
    .forEach((line, i, all) =>
      ctx.fillText(line, 256, (c.height * (i + 0.5)) / all.length, 490),
    );
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
function keyLabel(parent: THREE.Object3D, glyph: string, legend: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f6f5ee";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (legend) {
    ctx.font = "bold 48px Arial";
    ctx.fillText(legend, 128, 43, 240);
    ctx.font = "bold 142px Arial";
    ctx.fillText(glyph, 128, 173, 230);
  } else {
    ctx.font = "bold 168px Arial";
    ctx.fillText(glyph, 128, 141, 242);
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.77, 0.7),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mesh.position.z = 0.16;
  parent.add(mesh);
  return mesh;
}
function frame(
  parent: THREE.Object3D,
  w: number,
  h: number,
  iw: number,
  ih: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2);
  s.lineTo(-w / 2, h / 2);
  s.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-iw / 2, -ih / 2);
  hole.lineTo(-iw / 2, ih / 2);
  hole.lineTo(iw / 2, ih / 2);
  hole.lineTo(iw / 2, -ih / 2);
  hole.closePath();
  s.holes.push(hole);
  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 2,
    }),
    mat,
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function cable(
  parent: THREE.Object3D,
  points: THREE.Vector3[],
  color: number,
  radius = 0.045,
) {
  const path = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(path, 30, radius, 7, false),
    new THREE.MeshStandardMaterial({ color, roughness: 0.58 }),
  );
  parent.add(mesh);
  return mesh;
}
export class DeviceScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 180);
  controls: OrbitControls;
  root = new THREE.Group();
  cover = new THREE.Group();
  pcb = new THREE.Group();
  base = new THREE.Group();
  wires = new THREE.Group();
  labels = new THREE.Group();
  private lcdCanvas = document.createElement("canvas");
  private lcdTexture: THREE.CanvasTexture;
  private lcdMesh: THREE.Mesh;
  private rocker: THREE.Mesh;
  private relayLight: THREE.Mesh;
  private keyMeshes = new Map<string, THREE.Mesh>();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pressed: string | null = null;
  private pointerDown: THREE.Vector2 | null = null;
  private options: SceneOptions = {
    mode: "assembled",
    labels: false,
    autorotate: false,
    selected: null,
    lcdColor: "blue",
  };
  private lastLCD = "";
  private snapshot: Snapshot | null = null;
  private frameId = 0;
  private disposed = false;
  private observer: ResizeObserver;
  private targetCamera: THREE.Vector3 | null = V(17, 16, 38);
  private targetLook = V(0, 0, 0);
  private highlight = new THREE.Box3Helper(new THREE.Box3(), 0xa1e7b5);
  private selectionObjects = new Map<string, THREE.Object3D>();
  private customLabels: THREE.Sprite[] = [];
  private lastFrame = performance.now();
  constructor(
    private host: HTMLElement,
    design: Design,
    private callbacks: Callbacks,
  ) {
    const grain = document.createElement("canvas");
    grain.width = 128;
    grain.height = 128;
    const grainContext = grain.getContext("2d")!;
    const pixels = grainContext.createImageData(128, 128);
    let seed = 17;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (seed * 16807) % 2147483647;
      const n = 145 + (seed % 100);
      pixels.data[i] = n;
      pixels.data[i + 1] = n;
      pixels.data[i + 2] = n;
      pixels.data[i + 3] = 255;
    }
    grainContext.putImageData(pixels, 0, 0);
    const grainTexture = new THREE.CanvasTexture(grain);
    grainTexture.wrapS = grainTexture.wrapT = THREE.RepeatWrapping;
    grainTexture.repeat.set(18, 18);
    paint.bumpMap = grainTexture;
    paint.bumpScale = 0.004;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D model of the Reloj MA 32-2. Drag to rotate, scroll to zoom.",
    );
    this.renderer.domElement.setAttribute("role", "img");
    this.camera.position.copy(this.targetCamera!);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 15;
    this.controls.maxDistance = 85;
    this.controls.maxPolarAngle = Math.PI * 0.98;
    this.controls.autoRotateSpeed = 0.5;
    this.controls.addEventListener("start", () => (this.targetCamera = null));
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environment = new RoomEnvironment();
    const env = pmrem.fromScene(environment, 0.04);
    this.scene.environment = env.texture;
    environment.dispose();
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xe5edf0, 0x454c42, 2));
    const key = new THREE.DirectionalLight(0xfff2df, 3);
    key.position.set(-15, 25, 25);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, {
      left: -35,
      right: 35,
      top: 30,
      bottom: -30,
      near: 1,
      far: 100,
    });
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.035;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xbdd7ee, 2.5);
    rim.position.set(15, 8, -15);
    this.scene.add(rim);
    this.scene.add(this.root);
    this.root.add(this.base, this.cover, this.pcb, this.wires, this.labels);
    this.scene.add(this.highlight);
    this.highlight.visible = false;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.ShadowMaterial({ opacity: 0.15 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -8.12;
    floor.receiveShadow = true;
    floor.name = "inspection-floor";
    this.scene.add(floor);
    const grid = new THREE.GridHelper(100, 50, 0xd3d8d2, 0xdfe3dd);
    grid.position.y = -8.15;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.17;
    grid.name = "inspection-grid";
    this.scene.add(grid);
    // C57 enclosure. All scene units are centimetres; front measurements are from Caja/medidas.ods.
    box(this.base, 11.07, 15.02, 0.12, 0, 0, -4.92, paint);
    box(this.base, 0.15, 15.02, 9.8, -5.46, 0, 0);
    box(this.base, 0.15, 15.02, 9.8, 5.46, 0, 0);
    box(this.base, 11.07, 0.15, 9.8, 0, -7.46, 0);
    box(this.base, 11.07, 0.15, 9.8, 0, 7.46, 0);
    // Actual slotted side walls on the removable metal shell, not a flat black vent texture.
    this.base.children.slice(1, 3).forEach((m) => (m.visible = false));
    for (const side of [-1, 1]) {
      const sideGroup = new THREE.Group();
      sideGroup.position.x = side * 5.54;
      this.cover.add(sideGroup);
      box(sideGroup, 0.12, 15.3, 2.3, 0, 0, -3.8);
      box(sideGroup, 0.12, 15.3, 4.9, 0, 0, 2.48);
      box(sideGroup, 0.12, 3.3, 2.7, 0, -6, -1.32);
      box(sideGroup, 0.12, 3.3, 2.7, 0, 6, -1.32);
      for (let i = 0; i < 9; i++)
        box(sideGroup, 0.12, 0.65, 2.7, 0, -4.35 + i * 1.09, -1.32);
      for (const yy of [-6.2, 6.2]) {
        const screw = cylinder(this.cover, 0.2, 0.08, side * 5.63, yy, 1.4);
        screw.rotation.y = Math.PI / 2;
      }
    }
    // Front sheet with measured display and keypad cutouts.
    const s = new THREE.Shape();
    s.moveTo(-5.655, -7.74);
    s.lineTo(5.655, -7.74);
    s.lineTo(5.655, 7.74);
    s.lineTo(-5.655, 7.74);
    s.closePath();
    for (const [x, y, w, h] of [
      [0, 4.16, 7.11, 2.69],
      [0, -2.525, 5.96, 5.67],
    ]) {
      const p = new THREE.Path();
      p.moveTo(x - w / 2, y - h / 2);
      p.lineTo(x - w / 2, y + h / 2);
      p.lineTo(x + w / 2, y + h / 2);
      p.lineTo(x + w / 2, y - h / 2);
      p.closePath();
      s.holes.push(p);
    }
    const face = new THREE.Mesh(
      new THREE.ExtrudeGeometry(s, {
        depth: 0.12,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.035,
        bevelSegments: 2,
      }),
      paint,
    );
    face.position.z = 4.92;
    face.castShadow = true;
    face.receiveShadow = true;
    this.cover.add(face);
    frame(this.cover, 7.65, 3.03, 7.0, 2.18, 0.16, 0, 4.16, 5.08, black);
    box(this.cover, 8.05, 3.6, 0.14, 0, 4.16, 4.71, boardMat);
    box(this.cover, 7.2, 2.8, 0.28, 0, 4.16, 4.92, black);
    this.lcdCanvas.width = 1024;
    this.lcdCanvas.height = 260;
    this.lcdTexture = new THREE.CanvasTexture(this.lcdCanvas);
    this.lcdTexture.colorSpace = THREE.SRGBColorSpace;
    this.lcdTexture.minFilter = THREE.LinearFilter;
    this.lcdMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(6.63, 1.78),
      new THREE.MeshBasicMaterial({ map: this.lcdTexture }),
    );
    this.lcdMesh.position.set(0, 4.16, 5.251);
    this.lcdMesh.userData.ref = "LCD";
    this.cover.add(this.lcdMesh);
    this.selectionObjects.set("LCD", this.lcdMesh);
    for (const x of [-3.78, 3.78])
      for (const y of [2.62, 5.7])
        cylinder(this.cover, 0.14, 0.12, x, y, 4.78, metal);
    frame(this.cover, 6.62, 6.24, 5.96, 5.65, 0.12, 0, -2.525, 5.06, black);
    box(this.cover, 5.98, 5.68, 0.18, 0, -2.525, 5.01, black);
    const sub = [
      "",
      "ABC",
      "DEF",
      "",
      "GHI",
      "JKL",
      "MNO",
      "",
      "PRS",
      "TUV",
      "WXY",
      "",
      "",
      "OPER",
      "",
      "",
    ];
    KEYS.forEach((k, i) => {
      const x = -1.94 + (i % 4) * 1.29,
        y = -0.6 - Math.floor(i / 4) * 1.27;
      const button = box(this.cover, 0.93, 0.86, 0.24, x, y, 5.24, black, 0.09);
      button.userData.key = k;
      this.keyMeshes.set(k, button);
      const glyph = k === "Enter" ? "↵" : k;
      const label = keyLabel(button, glyph, sub[i]);
      label.userData.key = k;
    });
    // LCD controller and keypad solder-side visible beneath the lifted front.
    box(this.cover, 4.6, 1.0, 0.16, 0, 4.16, 4.53, black);
    for (let i = 0; i < 12; i++)
      box(this.cover, 0.065, 0.28, 0.07, -1.4 + i * 0.254, 5.69, 4.55, metal);
    const keyBoard = box(this.cover, 6.1, 5.8, 0.12, 0, -2.525, 4.63, boardMat);
    keyBoard.userData.ref = "TECLADO";
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        cylinder(
          this.cover,
          0.25,
          0.08,
          -1.94 + c * 1.29,
          -0.6 - r * 1.27,
          4.52,
          metal,
        );
    // Top contact-enable rocker.
    const switchGroup = new THREE.Group();
    switchGroup.position.set(-2.8, 7.59, -0.8);
    switchGroup.rotation.x = -Math.PI / 2;
    this.base.add(switchGroup);
    box(switchGroup, 1.12, 1.6, 0.22, 0, 0, 0, black, 0.1);
    this.rocker = box(switchGroup, 0.87, 1.3, 0.22, 0, 0, 0.2, black, 0.08);
    this.rocker.userData.switch = true;
    plaque(this.rocker, "●", 0.28, 0.28, 0, 0.4, 0.12);
    this.selectionObjects.set("J5", this.rocker);
    // Underside layout follows Manual/figuras/inferior1.eps: label and fuse
    // above the three-contact input and two-pole screw terminal block.
    const ports = new THREE.Group();
    ports.name = "underside-panel";
    ports.position.set(0, -7.59, 0);
    ports.rotation.x = Math.PI / 2;
    this.base.add(ports);

    const inputX = -3.75,
      inputY = -3.8;
    cylinder(ports, 0.94, 0.14, inputX, inputY, 0.1, metal);
    cylinder(ports, 0.83, 0.18, inputX, inputY, 0.21, black);
    const socketFace = new THREE.MeshStandardMaterial({
      color: 0xdddcd1,
      roughness: 0.65,
    });
    cylinder(ports, 0.73, 0.04, inputX, inputY, 0.32, socketFace);
    for (const [dx, dy] of [
      [-0.2, 0.36],
      [0.35, 0],
      [-0.2, -0.36],
    ]) {
      cylinder(ports, 0.18, 0.025, inputX + dx, inputY + dy, 0.35, metal);
      cylinder(ports, 0.12, 0.028, inputX + dx, inputY + dy, 0.368, black);
    }
    box(ports, 0.14, 0.35, 0.055, inputX - 0.67, inputY, 0.355, black);

    const fuseX = 3.82,
      fuseY = 2.85;
    cylinder(ports, 0.91, 0.12, fuseX, fuseY, 0.12, black);
    const fuse = cylinder(ports, 0.81, 0.45, fuseX, fuseY, 0.35, black);
    fuse.userData.ref = "FUSE";
    this.selectionObjects.set("FUSE", fuse);
    for (let i = 0; i < 28; i++) {
      const a = (i * Math.PI) / 14;
      box(
        ports,
        0.055,
        0.07,
        0.28,
        fuseX + Math.cos(a) * 0.8,
        fuseY + Math.sin(a) * 0.8,
        0.38,
        black,
      );
    }
    const fuseRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.018, 8, 48),
      new THREE.MeshStandardMaterial({ color: 0x767a76, roughness: 0.65 }),
    );
    fuseRim.position.set(fuseX, fuseY, 0.58);
    ports.add(fuseRim);
    plaque(ports, "FUSE\n↻", 1.1, 1.1, fuseX, fuseY, 0.582, {
      fg: "#b9bab4",
      font: 112,
    });

    const terminalX = 1.5;
    const terminalMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf4f1e5,
      roughness: 0.42,
      metalness: 0,
      transmission: 0.08,
      thickness: 0.3,
    });
    box(ports, 0.5, 0.45, 0.62, terminalX, -3.4, 0.39, terminalMaterial, 0.04);
    for (const yy of [-2.82, -3.98]) {
      box(ports, 2.18, 0.83, 0.65, terminalX, yy, 0.4, terminalMaterial, 0.055);
      for (const dx of [-0.43, 0.43]) {
        cylinder(ports, 0.34, 0.04, terminalX + dx, yy, 0.75, black);
        cylinder(ports, 0.28, 0.07, terminalX + dx, yy, 0.78, metal);
        box(ports, 0.04, 0.43, 0.014, terminalX + dx, yy, 0.822, black);
      }
      // The two looped leads shown in the underside drawing.
      cable(
        ports,
        [
          V(2.56, yy + 0.22, 0.35),
          V(3.7, yy + 0.22, 0.35),
          V(4.2, yy + 0.18, 0.35),
          V(4.28, yy, 0.35),
          V(4.2, yy - 0.18, 0.35),
          V(3.7, yy - 0.22, 0.35),
          V(2.56, yy - 0.22, 0.35),
        ],
        0xe8e5db,
        0.08,
      );
    }

    // Rendered directly from the EPS so its embedded fonts, QR and logo survive
    // without substitution. The original printed ratings are preserved verbatim.
    const labelTexture = new THREE.TextureLoader().load(
      "assets/underside-label.png",
      (texture) => {
        if (this.disposed) {
          texture.dispose();
          return;
        }
        this.host.dataset.undersideLabelLoaded = "true";
      },
      undefined,
      () => {
        if (!this.disposed)
          this.callbacks.error(
            "The original underside label could not be loaded. Reload to try again.",
          );
      },
    );
    labelTexture.colorSpace = THREE.SRGBColorSpace;
    labelTexture.anisotropy = Math.min(
      8,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(3, (3 * 115) / 86),
      new THREE.MeshStandardMaterial({
        map: labelTexture,
        roughness: 0.88,
        metalness: 0,
      }),
    );
    label.name = "original-white-label";
    label.position.set(-2.98, 1.85, 0.015);
    ports.add(label);
    // Original ARES geometry is already in centimetres, with component-side +Z.
    this.pcb.position.set(-4.7625, 4.9, -3.7);
    new TDSLoader().load(
      "assets/board.3ds",
      (g) => {
        if (this.disposed) {
          this.disposeObject(g);
          return;
        }
        g.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            const convert = (m: THREE.Material) => {
              const old = m as THREE.MeshPhongMaterial;
              const palette: Record<string, number> = {
                M00007C000: 0x174c35,
                M00007D000: 0x285b38,
                M000004000: 0x174c35,
                M000008000: 0xb7a477,
                M000028000: 0x142b38,
                M000020000: 0xa1a8a3,
                M000024000: 0xb88e55,
                M000054000: 0x232725,
                M000012000: 0x28342d,
                M00000D000: 0x242725,
              };
              const color =
                palette[old.name] !== undefined
                  ? new THREE.Color(palette[old.name])
                  : old.color.clone();
              const metallic =
                old.name === "M000020000" ||
                old.name === "M00000A000" ||
                old.name === "M000051000";
              return new THREE.MeshStandardMaterial({
                color,
                side: THREE.DoubleSide,
                metalness: metallic ? 0.82 : 0.08,
                roughness: metallic ? 0.3 : 0.68,
              });
            };
            o.material = Array.isArray(o.material)
              ? o.material.map(convert)
              : convert(o.material);
          }
        });
        for (const name of ["O00006B000", "O000052000"]) {
          const chip = g.getObjectByName(name) as THREE.Mesh;
          const geometry = chip.geometry;
          geometry.computeBoundingBox();
          const bounds = geometry.boundingBox!;
          const pos = geometry.getAttribute("position"),
            idx = geometry.index;
          geometry.clearGroups();
          let start = 0,
            last = -1;
          const count = idx ? idx.count : pos.count;
          for (let i = 0; i < count; i += 3) {
            let y = 0,
              z = 0;
            for (let j = 0; j < 3; j++) {
              const n = idx ? idx.getX(i + j) : i + j;
              y += pos.getY(n) / 3;
              z += pos.getZ(n) / 3;
            }
            const mat =
              y > bounds.min.y + 0.16 && y < bounds.max.y - 0.16 && z > 0.15
                ? 0
                : 1;
            if (mat !== last) {
              if (i > start) geometry.addGroup(start, i - start, last);
              start = i;
              last = mat;
            }
          }
          geometry.addGroup(start, count - start, last);
          chip.material = [black, metal];
          const center = bounds.getCenter(new THREE.Vector3());
          plaque(
            g,
            name === "O00006B000" ? "MICROCHIP\nPIC16F877A" : "DS1307",
            name === "O00006B000" ? 2.9 : 0.65,
            name === "O00006B000" ? 0.65 : 0.28,
            center.x,
            center.y,
            bounds.max.z + 0.006,
            { fg: "#b0b5a8", font: name === "O00006B000" ? 42 : 85 },
          );
        }
        const cell = g.getObjectByName("O00001F000")!;
        const cellBounds = new THREE.Box3().setFromObject(cell),
          cellCenter = cellBounds.getCenter(new THREE.Vector3());
        plaque(
          g,
          "+\nCR2032",
          1.35,
          0.95,
          cellCenter.x,
          cellCenter.y,
          cellBounds.max.z + 0.008,
          { fg: "#454b46", font: 70 },
        );
        // Original ARES mesh IDs, verified against the .EDF placement and native geometry.
        // Group the entire package (body AND leads), rather than guessing from nearest anchors.
        const nativeParts: Record<string, number[]> = {
          J2: [0x7a, 0x79],
          C3: [0x78, 0x77, 0x76],
          U3: [0x75, 0x74, 0x73, 0x72],
          C5: [0x71, 0x70, 0x6f],
          C6: [0x6e, 0x6d, 0x6c],
          U2: [0x6b],
          TECLADO: [0x6a, 0x69, 0x68, 0x67, 0x66, 0x65, 0x64, 0x63, 0x62],
          J1: [
            0x61, 0x60, 0x5f, 0x5e, 0x5d, 0x5c, 0x5b, 0x5a, 0x59, 0x58, 0x57,
            0x56, 0x55,
          ],
          U1: [0x52],
          X2: [0x50, 0x4f, 0x4e],
          C1: [0x4d, 0x4c, 0x4b],
          C2: [0x4a, 0x49, 0x48],
          R5: [0x47, 0x46, 0x45],
          R6: [0x44, 0x43, 0x42],
          R7: [0x40, 0x3f, 0x3e],
          Q1: [0x3d, 0x3c, 0x3b, 0x3a],
          R1: [0x39, 0x38, 0x37],
          RV1: [0x36, 0x35, 0x34, 0x33],
          J5: [0x32, 0x31, 0x30],
          R4: [0x2b, 0x2a, 0x29],
          C4: [0x27, 0x26, 0x25],
          X1: [0x23, 0x22, 0x21],
          BAT1: [0x1f, 0x1e, 0x1d],
          D1: [0x1c, 0x1b, 0x1a],
          D2: [0x19, 0x18, 0x17],
          Q2: [0x16, 0x15, 0x14, 0x13],
          J3: [0x11, 0x10, 0x0f],
          D3: [0x0c, 0x0b, 0x09],
        };
        for (const [ref, ids] of Object.entries(nativeParts)) {
          const group = new THREE.Group();
          group.name = ref;
          group.userData.ref = ref;
          for (const id of ids) {
            const mesh = g.getObjectByName(
              `O${id.toString(16).toUpperCase().padStart(6, "0")}000`,
            );
            if (!mesh) throw new Error(`Missing native geometry for ${ref}`);
            mesh.userData.ref = ref;
            group.add(mesh);
          }
          g.add(group);
          this.selectionObjects.set(ref, group);
        }
        this.pcb.add(g);
        this.makeLabels(design);
        this.callbacks.loaded();
      },
      undefined,
      (e) =>
        this.callbacks.error(
          "The original PCB model could not be loaded: " + String(e),
        ),
    );
    // Mounting spacers and external relay (not included in the board file).
    for (const x of [-4.12, 4.12])
      for (const y of [4.25, -1.97]) {
        cylinder(this.base, 0.22, 1.1, x, y, -4.23, metal);
        cylinder(this.base, 0.24, 0.11, x, y, -3.4, metal);
      }
    const relay = box(this.base, 2.8, 3.1, 2.8, 3.4, -5.2, -2.75, black, 0.16);
    relay.userData.ref = "RELAY";
    this.selectionObjects.set("RELAY", relay);
    plaque(relay, "12V\n40A", 1.6, 1.35, 0, 0, 1.415, { font: 90 });
    box(this.base, 3.1, 0.45, 3, 3.4, -6.86, -2.75, black);
    for (let i = 0; i < 5; i++)
      box(this.base, 0.3, 0.55, 0.12, 2.35 + i * 0.5, -7.1, -2.65, metal);
    this.relayLight = box(
      this.base,
      0.13,
      0.13,
      0.05,
      4.3,
      -4.2,
      -1.32,
      new THREE.MeshBasicMaterial({ color: 0x333c37 }),
      0.03,
    ); // inspection indicator, not an added physical LED
    this.relayLight.visible = false;
    cable(
      this.wires,
      [V(-2.86, -2.1, -3.2), V(-4.4, -3.5, -2.3), V(-3.75, -7.35, 3.8)],
      0xb14236,
      0.07,
    );
    cable(
      this.wires,
      [V(-2.6, -2.1, -3.2), V(-4, -3.6, -2.4), V(-3.5, -7.35, 3.8)],
      0x24262a,
      0.07,
    );
    cable(
      this.wires,
      [V(2.5, -2.2, -3.2), V(2, -3, -1.1), V(2.8, -5.8, -1.1)],
      0xca3431,
      0.06,
    );
    cable(
      this.wires,
      [V(2.75, -2.2, -3.2), V(1.4, -3.3, -1.4), V(3.3, -5.8, -1.1)],
      0x393939,
      0.06,
    );
    cable(
      this.wires,
      [V(3.7, -6, -1.1), V(4.4, -6.4, 1), V(3.82, -7.35, -2.85)],
      0xe4dec5,
      0.1,
    );
    cable(
      this.wires,
      [V(3.2, -6, -1.1), V(2, -6.4, 2.7), V(1.5, -7.35, 2.82)],
      0xe4dec5,
      0.1,
    );
    // Ribbon paths are flexible and rebuilt as the cover moves.
    this.addRibbons();
    this.renderer.domElement.addEventListener(
      "pointerdown",
      this.onPointerDown,
    );
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.addEventListener("pointercancel", this.onCancel);
    this.renderer.domElement.addEventListener(
      "pointermove",
      this.onPointerMove,
    );
    window.addEventListener("pointerup", this.onGlobalUp);
    window.addEventListener("blur", this.onCancel);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.animate();
    document.fonts.load("32px LCD").then(() => {
      this.lastLCD = "";
    });
  }
  private addRibbons() {
    for (let i = 0; i < 12; i++)
      cable(
        this.cover,
        [
          V(-1.4 + i * 0.16, 5.7, 4.55),
          V(-1.4 + i * 0.16, 6.0, 2.2),
          V(-1.4 + i * 0.16, 5.1, 1.4),
        ],
        i === 0 ? 0xb96659 : 0xb9b6ac,
        0.052,
      );
    for (let i = 0; i < 8; i++)
      cable(
        this.cover,
        [
          V(-2.3 + i * 0.13, -5, 4.5),
          V(-2.3 + i * 0.13, -5.5, 2.3),
          V(-2.3 + i * 0.13, -3.9, 1.0),
        ],
        i === 0 ? 0x8d5960 : 0xa8a9a4,
        0.045,
      );
  }
  private makeLabels(design: Design) {
    for (const ref of ["U2", "U1", "BAT1", "U3", "Q2", "X2", "J1"]) {
      const part = design.components.find((p) => p.ref === ref)!;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 88;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#202b27";
      ctx.beginPath();
      ctx.roundRect(0, 0, 512, 88, 15);
      ctx.fill();
      ctx.font = "36px Arial";
      ctx.fillStyle = "#d8f1df";
      ctx.textAlign = "center";
      ctx.fillText(
        ref + " · " + (ref === "BAT1" ? "CR2032" : part.device),
        256,
        56,
        486,
      );
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, depthTest: false }),
      );
      sprite.scale.set(3.25, 0.56, 1);
      sprite.position.set(part.x / 10 - 4.7625, part.y / 10 + 5.5, -1.6);
      sprite.userData.ref = ref;
      this.labels.add(sprite);
      this.customLabels.push(sprite);
    }
  }
  setOptions(options: SceneOptions) {
    const changed = options.mode !== this.options.mode;
    this.options = options;
    this.controls.autoRotate = options.autorotate;
    this.labels.visible = options.labels && options.mode !== "assembled";
    if (changed) this.resetView();
  }
  resetView(view: "perspective" | "front" | "back" | "bottom" = "perspective") {
    const opened = this.options.mode !== "assembled";
    this.targetLook =
      view === "bottom" ? V(0, -7.5, 0) : opened ? V(-5, 0, 1) : V(0, 0, 0);
    this.targetCamera =
      view === "front"
        ? V(opened ? -5 : 0, 0, opened ? 61 : 42)
        : view === "back"
          ? V(0, 4, -43)
          : view === "bottom"
            ? V(0, -33, 2.2)
            : opened
              ? V(18, 20, 53)
              : V(17, 16, 38);
  }
  focusComponent() {
    const selected =
      this.options.selected && this.selectionObjects.get(this.options.selected);
    if (!selected) return;
    selected.updateWorldMatrix(true, true);
    const center = new THREE.Box3()
      .setFromObject(selected)
      .getCenter(new THREE.Vector3());
    this.targetLook = center;
    this.targetCamera = center.clone().add(V(3, 3, 16));
  }
  update(snapshot: Snapshot) {
    this.snapshot = snapshot;
    this.rocker.rotation.x = snapshot.automatic ? -0.18 : 0.18;
    this.drawLCD(snapshot);
    for (const [key, mesh] of this.keyMeshes)
      mesh.position.z = this.pressed === key ? 5.18 : 5.24;
  }
  private drawLCD(s: Snapshot) {
    const signature = JSON.stringify([
      s.lines,
      s.backlight,
      s.powered,
      s.cursor,
      Math.floor(s.now * 2) % 2,
      this.options.lcdColor,
    ]);
    if (signature === this.lastLCD) return;
    this.lastLCD = signature;
    const ctx = this.lcdCanvas.getContext("2d")!,
      blue = this.options.lcdColor === "blue";
    ctx.fillStyle = s.powered
      ? s.backlight
        ? blue
          ? "#124dd0"
          : "#9bba55"
        : "#36483e"
      : "#242d2b";
    ctx.fillRect(0, 0, 1024, 260);
    if (s.powered) {
      for (let row = 0; row < 2; row++)
        for (let col = 0; col < 16; col++) {
          const x = 29 + col * 61,
            y = 28 + row * 116;
          ctx.fillStyle = s.backlight
            ? blue
              ? "#205bd7"
              : "#92b151"
            : "#34433a";
          ctx.fillRect(x, y, 52, 91);
          ctx.fillStyle = s.backlight
            ? blue
              ? "#c0d8ff"
              : "#243922"
            : "#98a18c";
          ctx.font = "82px LCD, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const char = s.lines[row][col];
          const pixels = lcdGlyphPixels(char);
          if (pixels) {
            for (const dot of pixels)
              ctx.fillRect(x + dot.x * 10.4, y + dot.y * 11.375, 9.36, 10.2375);
          } else {
            ctx.fillText(char === "→" ? "›" : char, x + 26, y + 49, 54);
          }
          if (
            s.cursor?.[0] === row &&
            s.cursor[1] === col &&
            Math.floor(s.now * 2) % 2 === 0
          )
            ctx.fillRect(x, y + 86, 51, 5);
        }
    }
    this.lcdTexture.needsUpdate = true;
  }
  private hit(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObject(this.root, true).find((hit) => {
      let o: THREE.Object3D | null = hit.object;
      while (o) {
        if (!o.visible) return false;
        o = o.parent;
      }
      return true;
    });
  }
  private interactive(object: THREE.Object3D): THREE.Object3D {
    let current = object;
    while (
      current.parent &&
      !current.userData.key &&
      !current.userData.ref &&
      !current.userData.switch
    )
      current = current.parent;
    return current;
  }
  private onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    this.pointerDown = new THREE.Vector2(event.clientX, event.clientY);
    const hit = this.hit(event);
    if (!hit) return;
    const o = this.interactive(hit.object);
    if (o.userData.key) {
      this.pressed = o.userData.key;
      this.controls.enabled = false;
      this.renderer.domElement.setPointerCapture(event.pointerId);
      this.callbacks.press(this.pressed!);
    }
  };
  private onPointerUp = (event: PointerEvent) => {
    if (this.pressed) {
      this.onGlobalUp();
      return;
    }
    if (
      this.pointerDown &&
      this.pointerDown.distanceTo(
        new THREE.Vector2(event.clientX, event.clientY),
      ) < 5
    ) {
      const hit = this.hit(event);
      if (hit) {
        const o = this.interactive(hit.object);
        if (o.userData.switch) this.callbacks.toggleSwitch();
        else if (o.userData.ref) this.callbacks.select(o.userData.ref);
      }
    }
    this.pointerDown = null;
  };
  private onPointerMove = (event: PointerEvent) => {
    const hit = this.hit(event);
    const o = hit ? this.interactive(hit.object) : null;
    this.renderer.domElement.style.cursor =
      o && (o.userData.key || o.userData.ref || o.userData.switch)
        ? "pointer"
        : "grab";
  };
  private onGlobalUp = () => {
    if (this.pressed) {
      this.callbacks.release(this.pressed);
      this.pressed = null;
    }
    this.controls.enabled = true;
  };
  private onCancel = () => {
    this.onGlobalUp();
    this.pointerDown = null;
  };
  private resize() {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  private animate = () => {
    if (this.disposed) return;
    this.frameId = requestAnimationFrame(this.animate);
    const now = performance.now(),
      dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const factor = 1 - Math.exp(-dt * 6);
    const open = this.options.mode !== "assembled";
    this.cover.position.lerp(open ? V(-15.3, 0, 5) : V(0, 0, 0), factor);
    this.cover.rotation.y = THREE.MathUtils.lerp(
      this.cover.rotation.y,
      open ? -0.15 : 0,
      factor,
    );
    this.pcb.position.z = THREE.MathUtils.lerp(
      this.pcb.position.z,
      this.options.mode === "exploded" ? 4 : -3.7,
      factor,
    );
    this.wires.visible = this.options.mode !== "exploded";
    this.labels.position.z = this.options.mode === "exploded" ? 7.7 : 0;
    if (this.targetCamera) {
      this.camera.position.lerp(this.targetCamera, factor);
      this.controls.target.lerp(this.targetLook, factor);
      if (this.camera.position.distanceTo(this.targetCamera) < 0.01)
        this.targetCamera = null;
    }
    this.controls.update();
    // The inspection grid must not obscure the bottom connectors when viewed from below.
    this.scene.getObjectByName("inspection-grid")!.visible =
      this.camera.position.y > -7.7;
    this.scene.getObjectByName("inspection-floor")!.visible =
      this.camera.position.y > -7.7;
    const selected = this.options.selected
      ? this.selectionObjects.get(this.options.selected)
      : null;
    if (selected && this.options.mode !== "assembled") {
      selected.updateWorldMatrix(true, true);
      this.highlight.box.setFromObject(selected);
      this.highlight.visible = true;
    } else this.highlight.visible = false;
    if (this.snapshot) this.drawLCD(this.snapshot);
    this.renderer.render(this.scene, this.camera);
  };
  private disposeObject(root: THREE.Object3D) {
    root.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.forEach((m) => {
          Object.values(m).forEach((v) => {
            if (v instanceof THREE.Texture) v.dispose();
          });
          m.dispose();
        });
      }
    });
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.observer.disconnect();
    this.onCancel();
    window.removeEventListener("pointerup", this.onGlobalUp);
    window.removeEventListener("blur", this.onCancel);
    this.controls.dispose();
    this.disposeObject(this.scene);
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
