# Browse fix B — report (2026-10-26)

Plan: `browse-fix-b-plan-2026-10-26.md`. Seed **684**.

## 1. Root causes

| Item | Status | Notes |
|---|---|---|
| Near ground goes white | **Confirmed** | `bladeHandoff` ×0.78 on shared carpet; `dist` is **per-fragment** (`length(camera−vWorld)`), not one shared focus — still wiped soil+tint together |
| Pivot stuck | **Confirmed** (owner diag) | `cam↔target≈3`, `minDist HIT`, hit 80–200 m: pivot glued to camera |
| Grass flash on look-up | **Confirmed earlier** | 3D range + frame miss sticky + ray↔hold rebuild |
| Walk pauses dwelling | **Confirmed** | `run: dwell.run && !view.walk` |
| Mid volume still thin | **Hypothesis** | After carpet restore, re-judge; impostors deferred |

## 2. Changes (files)

| File | Change |
|---|---|
| `core/terrain/cdlod.ts` | Split soil (keep) vs canopy-proxy tint (~30% near ease); per-point `nearPt` |
| `OrbitPivotRescue.tsx` | **New** — soft target reanchor when zoom-in at minDist + far ground hit |
| `Scene.tsx` | Wire rescue; soften floor when glued; **Walk keeps `dwell.run`** |
| `coverFocus.ts` | Sole param table; `missHoldSec: 0.4`; no frame-count sticky |
| `CoverGrass.tsx` | `lastHitAt`; no rebuild on ray↔hold alone |
| Docs | plan + this report; handoff / world-plan / presentation-notes |

## 3. Live parameters

### Cover handoff (terrain shader)

- Soil/moss: **no** heavy handoff (groundKeep ≥ ~0.92).
- Canopy-proxy tint: `canopyKeep = 1 − 0.30×nearPt`, `nearPt = 1−smoothstep(22,55,dist)` per fragment.
- Wet stone / litter / jade: unchanged mixes.

### Grass stream

| Role | Params |
|---|---|
| Prefetch/load | `loadOn 72` / `loadOff 105` (orbit-range, height×0.4) |
| Global fade | `fadeOn 48` / `fadeOff 98` |
| Per-blade dither | `fadeNear 42` / `fadeFar 78` |
| Miss hold | **`missHoldSec 0.4`** (seconds) |
| Cache | chunk 24, ring 2, cacheMax 48, assemble radius 48 |
| Refocus | 16 m focus move or load band flip — not source flicker |

### Pivot rescue

- Trigger: zoom-in wheel while `cam↔target ≤ minDistance+0.12` and cursor ground hit ≥ 18 m.
- Action: hold camera; lerp target toward hit (~4.5/s); cancel on drag / zoom-out.
- Does **not** lower minDistance or dig.

## 4. Visual / interaction acceptance

| Check | Result |
|---|---|
| Wet shore far→near→far colour | **Partial** — code path fixed; owner eye still needed for beauty |
| Grove edge handoff | **未验证** (full continuous) |
| Look up / turn / look back — grass stable | **未验证** continuous; logic uses 0.4 s hold |
| Chunk boundary pan | **未验证** |
| minDist stuck → continue zoom | **未验证** in browser (rescue wired; owner should re-run prior stuck) |
| Wheel flat / slope / water dir | **未验证** |
| Walk + active creature | **实际验证通过** — Walk on, stats still `resting · ×30` (not paused) |
| Near emptier than far (carpet wipe) | **Code fixed**; eye **未验证** |
| Reanchor jump | **未验证** |
| Pine colour pop | **未验证** this pass |

Browser limits: Cursor IDE browser ~297 px wide canvas; FPS reported 0 while backgrounded; **no continuous screen recording** captured. Hot-reload confirmed no oxc overlay after comment fix; near blades ~19k at look-at.

## 5. Performance

- Probe / live: near disc ~19k blades (not raised globally).
- Dwelling ×30 left as user setting; no silent change. CPU of dwell+contact **not** separately timed this pass.
- **No trustworthy GPU ms** from automated browser (1–3 ms readings while FPS 0 — ignore).

## 6. Next single best step

**Owner continuous eye pass** on wet shore far↔near (carpet under blades) and one deliberate minDist-stuck unstick with Nav diagnostics on. If mid still feels volumeless after carpet stays, then a **cheap mid impostor** (costed) — not before.
