# ADVOZ Calibration

Node-only statistical calibration contour for ADVOZ v2.

## Dependency rule

Calibration may import production modules from `../src/`. Production code under `src/`, `app.js`, and `index.html` must never import anything from `calibration/`.

The simulator models observable Ozon-like histories with known synthetic truth. It does not model undocumented auction internals and never changes production defaults automatically.

Run profiles will be added through `calibration/cli.js`:

- `smoke` — deterministic CI regression only; not a statistical calibration claim.
- `baseline` — first formal calibration report.
- `deep` — higher-precision selected-scenario comparison.
