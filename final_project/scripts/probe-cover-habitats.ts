/**
 * Fixed habitat sample plots for Wonderland cover (seed 684 by default).
 * Records suit area, patch cover, clumps/m² inside suitable patch — not whole-disc counts.
 *
 * Run: npx tsx scripts/probe-cover-habitats.ts [seed]
 * JSON → stdout (redirect to scripts/out/ if needed).
 */
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildCover, COVER_DEFAULTS, coverFieldStats } from '../src/experiments/wonderland-terrain/cover';
import { buildSites, COVER_NEAR } from '../src/experiments/wonderland-terrain/CoverGrass';
import { pickHabitatViews } from '../src/experiments/wonderland-terrain/habitatViews';
import { SEED } from '../src/experiments/wonderland-terrain/layout';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { buildZones, zoneAt, ZONE, ZONE_NAMES } from '../src/experiments/wonderland-terrain/zones';

const seed = Number(process.argv[2] ?? SEED);
const params = { ...GROUND_DEFAULTS, seed };
const { grid } = bakeGround(params);
const rules = groundRules(params);
const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
const zones = buildZones(grid, water, rules.plate(0), seed);
const cover = buildCover(zones, grid, seed, COVER_DEFAULTS.amount);

/** Pick a centroid of cells of a given zone with high cover density (rule-based). */
function pickPlot(want: number, label: string) {
  let best = { i: 0, j: 0, score: -1 };
  for (let j = 2; j < cover.nz - 2; j++) {
    for (let i = 2; i < cover.nx - 2; i++) {
      const t = j * cover.nx + i;
      if (zones.zone[t] !== want) continue;
      const d = cover.density[t];
      if (d < 0.02 && want !== ZONE.open) continue;
      // Prefer interior of zone (neighbours match).
      let nbr = 0;
      for (const o of [-1, 1, -cover.nx, cover.nx]) if (zones.zone[t + o] === want) nbr++;
      const score = d * 2 + nbr * 0.15;
      if (score > best.score) best = { i, j, score };
    }
  }
  const x = cover.x0 + (best.i + 0.5) * cover.cell;
  const z = cover.z0 + (best.j + 0.5) * cover.cell;
  return { label, zone: ZONE_NAMES[want], x, z, dens: cover.density[best.j * cover.nx + best.i] };
}

const PLOT_R = 12; // metres half-side of square sample (±PLOT_R)

function measurePlot(label: string, zoneId: number, zoneName: string, cx: number, cz: number) {
  const cell = cover.cell;
  let cells = 0, suitCells = 0, patchCells = 0, densSum = 0;
  const i0 = Math.floor((cx - PLOT_R - cover.x0) / cell);
  const j0 = Math.floor((cz - PLOT_R - cover.z0) / cell);
  const i1 = Math.ceil((cx + PLOT_R - cover.x0) / cell);
  const j1 = Math.ceil((cz + PLOT_R - cover.z0) / cell);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      if (i < 0 || j < 0 || i >= cover.nx || j >= cover.nz) continue;
      const x = cover.x0 + (i + 0.5) * cell, z = cover.z0 + (j + 0.5) * cell;
      if (Math.abs(x - cx) > PLOT_R || Math.abs(z - cz) > PLOT_R) continue;
      const t = j * cover.nx + i;
      if (zones.zone[t] !== zoneId) continue; // only this habitat class inside the square
      cells++;
      const d = cover.density[t];
      densSum += d;
      if (cover.suit[t] >= 0.05) suitCells++;
      if (cover.patch[t] > 0.4 && cover.suit[t] >= 0.05) patchCells++;
    }
  }
  const area = cells * cell * cell;
  const suitArea = suitCells * cell * cell;
  const patchArea = patchCells * cell * cell;
  const built = buildSites(cover, grid, seed, cx, cz, null, COVER_DEFAULTS.amount);
  // Clumps that fall inside the plot square (not whole disc).
  const pipe = built.stats.pipe;
  const clumpsInPlot = (() => {
    const { offset, count } = built.grass;
    let bladesIn = 0;
    for (let k = 0; k < count; k++) {
      const x = offset[k * 3], z = offset[k * 3 + 2];
      if (Math.abs(x - cx) > PLOT_R || Math.abs(z - cz) > PLOT_R) continue;
      if (zoneAt(zones, x, z) !== zoneId) continue;
      bladesIn++;
    }
    const mean = pipe.meanBladesPerClump || COVER_NEAR.blades[0];
    return { bladesIn, clumpsEst: mean > 0 ? bladesIn / mean : 0 };
  })();
  const flowersIn = cover.flowerAnchors.filter((a) => Math.abs(a.x - cx) <= PLOT_R && Math.abs(a.z - cz) <= PLOT_R);

  return {
    label,
    zone: zoneName,
    centre: { x: +cx.toFixed(1), z: +cz.toFixed(1) },
    plotArea_m2: +area.toFixed(1),
    suitArea_m2: +suitArea.toFixed(1),
    patchArea_m2: +patchArea.toFixed(1),
    patchCoverOfSuit: suitArea > 0 ? +(patchArea / suitArea).toFixed(3) : 0,
    meanDensInPlot: cells ? +(densSum / cells).toFixed(3) : 0,
    clumpsInPlotEst: +clumpsInPlot.clumpsEst.toFixed(1),
    bladesInPlot: clumpsInPlot.bladesIn,
    clumpsPerSuitM2: suitArea > 0 ? +(clumpsInPlot.clumpsEst / suitArea).toFixed(3) : 0,
    clumpsPerPatchM2: patchArea > 0 ? +(clumpsInPlot.clumpsEst / patchArea).toFixed(3) : 0,
    meanBladesPerClump: +pipe.meanBladesPerClump.toFixed(2),
    targetClumpsM2_atDens1: COVER_DEFAULTS.clumpsPerM2,
    flowerSitesInPlot: flowersIn.length,
    pipeReject: {
      densBelow: pipe.densBelow,
      wearOrEdge: pipe.wearOrEdge,
      noPresence: pipe.noPresence,
      wetOrBadY: pipe.wetOrBadY,
      cellsInDisc: pipe.cellsInDisc,
    },
  };
}

const views = pickHabitatViews(cover, zones, grid);
const wet = views.wetShore ?? pickPlot(ZONE.wetShore, 'wetShore');
const wood = views.woodEdge ?? pickPlot(ZONE.woodland, 'woodlandEdge');
const open = views.openIsland;

const zoneAreas = Object.fromEntries(ZONE_NAMES.map((n, i) => [n, zones.area[i]]));

const plots = [
  measurePlot('wetShore', ZONE.wetShore, 'wetShore', wet.x, wet.z),
  measurePlot('woodlandEdge', ZONE.woodland, 'woodland', wood.x, wood.z),
];
if (open) {
  const zk = zoneAt(zones, open.x, open.z);
  plots.push(measurePlot('openIsland', zk, ZONE_NAMES[zk], open.x, open.z));
}

console.log(JSON.stringify({
  seed,
  densMeaning: 'density=suit×(0.12+0.88×patch) for tint; near clumps/m² ≈ clumpsPerM2 × soft(patch)×soft(suit) inside patches',
  defaults: COVER_DEFAULTS,
  near: { clumpCell: COVER_NEAR.clumpCell, suitFloor: COVER_NEAR.suitFloor },
  field: coverFieldStats(cover),
  zoneAreas_m2: zoneAreas,
  cameraFrames: {
    wetShore: views.wetShore && { from: views.wetShore.from, to: views.wetShore.to, at: [views.wetShore.x, views.wetShore.z] },
    woodEdge: views.woodEdge && { from: views.woodEdge.from, to: views.woodEdge.to, at: [views.woodEdge.x, views.woodEdge.z] },
    openIsland: views.openIsland && { from: views.openIsland.from, to: views.openIsland.to, at: [views.openIsland.x, views.openIsland.z] },
  },
  plots,
}, null, 2));
