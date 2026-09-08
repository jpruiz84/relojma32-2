# Reloj MA 32-2 · Interactive lab

A local, static web application that reconstructs the Galeras Digital school-bell controller from the firmware and manufacturing archive in this repository. React renders the lab controls, Three.js renders the physical device, and a deterministic TypeScript state machine reproduces the firmware's defined user-facing behavior.

## Run

Requires Node.js 22.12+ and npm.

```sh
cd simulator
npm ci
npm run dev
```

Open the printed localhost address (normally http://localhost:5173). There is no backend, account, cloud service, or runtime CDN. A browser with WebGL 2 is required for 3D rendering. If WebGL is unavailable, the accessible keypad and schedule controls remain usable.

```sh
npm run build    # TypeScript checks and deployable static files in dist/
npm run preview  # Serve the production build locally
npm test         # Deterministic firmware/EEPROM tests
npm run test:e2e # Chrome/Playwright browser tests
```

The browser tests use `/usr/bin/google-chrome` when present. Alternatively set `CHROME_PATH` to your browser executable or run `npx playwright install chromium`. The tests enable software WebGL, allowing CI to verify the actual native PCB loader without a GPU.

## Use the lab

For the hosted service, private-link access, updates and link rotation, see
[deployment instructions](deploy/README.md). The deployment secret is stored only
on the server.

- **Operate:** use the 3D front-panel keys or the accessible keypad. `M` opens the original Spanish menus; `↑`/`↓` selects; Enter confirms. The physical keyboard also accepts digits, arrows, Enter, M/Escape, `*` and `#` when a form control is not focused. Hold `#` for manual output; release to stop.
- **Schedules:** edit any of the 30 slots in each of four schedules, assign schedules or OFF to each weekday, and set TC/TL to 1–16 seconds. Password-protected configuration can be unlocked through the original keypad. EEPROM import/export is an explicit lab programming tool and can overwrite password bytes.
- **Electronics:** remove the cover, explode the PCB from its mounts, toggle labels, inspect components and their real net connections, or disconnect the CR2032/fuse.
- **Source archive:** inspect all 15 supplied raster images, original manual, source assembly, PCB artwork, exported schematic and five vector drawings.
- **Virtual time:** pause, step 500 ms, set weekday/time, run at 1×/10×/60×/600×, or jump to five seconds before the next alarm. Sound is optional and synthesized from the contact state.

The first launch loads a **demonstration** school schedule at Monday 06:59:50 with a 07:00 bell. It is not presented as a factory EEPROM image. Archived captures are available by their original filenames. Partial `.MCH` captures overwrite only their supplied bytes; the remainder stays intact. Export before replacing a configuration you want to keep.

EEPROM and RTC state persist in this browser's `localStorage`. Reopening advances the backed-up RTC by real elapsed time; it does not replay alarms while the browser was closed. The simulation affects only the virtual device.

## Reconstruction and fidelity

The circuit uses the **original 105-mesh `Circuitos/Version 2/modelo.3DS`**, including copper artwork and components. The 28 component values/placements and 47 nets are extracted from `.SDF` and `.EDF`. The 113.1 × 154.8 mm front plate and display/keypad apertures use `Caja/medidas.ods`; product and installation photos guide the black enclosure, vents, keypad, display colors and connectors.

The later 2013 PCB and 2012 exterior photos represent different archive revisions. Enclosure depth, assembly offsets, external relay geometry, materials and cable routing are reconstructed. The original PCB's placeholder colors are replaced with component-appropriate materials while preserving the source mesh vertices. Ribbon ends on the lifted cover are illustrative, not a manufacturing harness reconstruction.

This is a **functional firmware port, not instruction-cycle or analog electrical emulation**. It covers menus, packed EEPROM, scheduling, bell pulses, manual actuation, menu blocking, password protection and power/backup behavior. It deliberately preserves relevant alarm-search quirks and guards undefined inputs. [Fidelity notes](docs/FIDELITY.md) explain source mappings, conflicts and limits in detail; the same material is summarized in the app's guide.

Three.js integrations follow the official [TDSLoader](https://threejs.org/docs/pages/TDSLoader.html) and [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html) documentation.

## Rebuild source assets

Generated browser assets are committed so running the app does not require Python. To regenerate after changing archive files:

```sh
# Python 3 with Pillow installed
npm run assets
```

`prepare_assets.py` copies the native board, LCD font and original documents, makes web-sized photo copies, and generates `public/assets/design.json`. This manifest preserves original relative filenames and the board's SHA-256. It also includes the 98 routed paths from the ARES session file. The original archive files are left untouched.

## Files

| File                        | Responsibility                                                   |
| --------------------------- | ---------------------------------------------------------------- |
| `src/engine.ts`             | Time, firmware menu state, alarm selection, relay pulses, EEPROM |
| `src/scene.ts`              | Native PCB loading, measured enclosure, picking and camera       |
| `src/App.tsx`               | Operate, schedules, circuit inspector, sources and persistence   |
| `src/design.ts`             | Source-backed component explanations                             |
| `src/engine.test.ts`        | Firmware, memory and power regression tests                      |
| `tests/lab.spec.ts`         | Actual browser, 3D, keyboard and mobile workflows                |
| `scripts/prepare_assets.py` | Reproducible asset extraction and provenance                     |

The application follows the repository's MIT license; original reference files retain their existing notices.
