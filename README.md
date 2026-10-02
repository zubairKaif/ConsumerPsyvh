# QuikKart stimulus app

Research stimulus for SOM 749 (IIT Bombay): a fictitious quick-commerce checkout used to test drip pricing.
Arm A shows fees late (only on the bill); arm B shows them upfront. **The bill is pixel-identical in both arms.**
It runs on a Tobii Pro desktop (static images) or on a laptop with webcam tracking (WebGazer 3.5.3).

The output is one offline HTML file, `dist/QuikKart_Stimulus_App.html`, plus a pack with the Tobii images,
AOI coordinates, trial orders, start scripts and a researcher README (`scripts/pack/README.template.txt`).

## Commands

```bash
npm install          # WebGazer 3.5.3, @fontsource/roboto, Playwright 1.56 (uses the installed Chromium)
npm run build        # src/ -> dist/QuikKart_Stimulus_App.html (+ dist/webcam/, licences)
npm run render       # build, then stimuli_png/, aoi_preview/, CSVs, start scripts, README.txt, QuikKart_Stimulus_Pack.zip
npm run serve        # dist/ at http://localhost:8000 (webcam mode needs http or localhost)
npm test             # unit tests, render, then all Playwright tests (webcam tests run last)
```

## Layout

| Path | What it holds |
|---|---|
| `src/js/core.js` | Data, fee maths, seeded trial order, CSV and gaze-classification helpers. Pure; `require()`d by the Node scripts too, so the CSV generator and the app share one implementation. |
| `src/js/screens.js` | HTML builders for listing, cart, bill, edit. `billScreen(cart, suggest)` never receives the arm. |
| `src/js/phone.js` | Stage, scaled device frame, overlays, `getAOIs()`, AOI overlay, URL hash. |
| `src/js/flow.js` | One trial: listing → cart → bill → (edit → bill)*. Shared by view and run mode. |
| `src/js/runner.js` | Run mode: welcome, fixation, trials, blank, probes, CSV, autosave. |
| `src/js/tracker.js` | Gaze recording and hit-testing; mouse source; WebGazer set-up, calibration, validation. |
| `src/js/console.js` | Researcher console (the default page). |
| `scripts/build.js`, `render.js`, `zip.js`, `serve.js` | Build, render and pack, ZIP writer (keeps the Mac script executable), static server. |
| `tests/unit/` | `node:test` unit tests for `core.js`. |
| `tests/e2e/` | Playwright tests at 1920 × 1080, DPR 1. |

## Acceptance tests (brief section 11)

| # | Criterion | Test |
|---|---|---|
| 1 | Bill PNGs pixel-identical between arms, 9 trials | `screens.spec.js` (live) and `pack.spec.js` (rendered files) |
| 2 | Fee AOIs ≥ 60 px tall at 1920 × 1080 (they are 62.3 px) | `screens.spec.js`, `pack.spec.js` |
| 3 | B, F, T on every screen match the fee rules | `screens.spec.js`, plus `tests/unit/core.test.js` |
| 4 | Listing grid above the cart bar, both arms | `screens.spec.js` |
| 5 | `et=mouse` run: 9 trials, exact CSV columns, FEES samples | `mouse.spec.js` |
| 6 | S1 + cookies: B 208, F 16, added_value 90, fee_change −50 | `edit.spec.js` |
| 7 | Fake camera on localhost: WebGazer from `./webcam`, calibration, no console errors | `webcam.spec.js` |
| 8 | `trialOrder` matches between the CSV generator and run mode | `pack.spec.js` (all 80 participants) |

## Decisions worth knowing

- **Start scripts bind to 127.0.0.1** (`python -m http.server 8000 --bind 127.0.0.1`). This avoids the Windows
  firewall prompt and keeps the folder off the network; `localhost` still works.
- **Gaze is not autosaved to localStorage**, only behaviour data is (as the brief asks). Gaze CSVs are 1–2 MB, and
  all `file://` pages share one ~5 MB quota, so they would soon block the behaviour autosave. Instead the end page
  downloads both CSVs automatically, with buttons as a fallback.
- **Timing:** `*_ms` columns run from render to leaving the screen. `dec_rt_ms` runs from the bill's first painted
  frame to the click. Gaze `t_ms` is relative to the screen's onset.
- **Face found/lost** comes from wrapping WebGazer's `getEyePatches`. `getPositions()` keeps returning stale
  landmarks after the face is lost.
- WebGazer's `begin()` raises an `alert` outside https/localhost even where the camera works (`file://`, `127.0.0.1`).
  In secure contexts the app logs it instead.
- The GPL-3.0 and Apache-2.0 texts in `vendor/` are shipped next to WebGazer and MediaPipe in `dist/webcam/`.
- Without a GPU (e.g. CI), MediaPipe runs at about 12 fps on software WebGL, which is why the webcam tests are slow.
