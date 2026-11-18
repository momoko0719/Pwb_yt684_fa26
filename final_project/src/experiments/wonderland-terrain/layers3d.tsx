import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { LAYER } from '../../core/palette';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { useLanguage } from '../../i18n/LanguageContext';
import type { Dwelling } from './dwelling';
import type { PoolNode, OutletNode } from './terrace';
import type { Water } from './water';
import type { StreamFishData } from './streamFish';

/**
 * The island's overlay layers (LayersPanel.tsx): lines, rings and small tags drawn over the world
 * from the same data the rules use. They read the world, never change it. Each is drawn through
 * everything (no depth test), so it stays visible behind trees and rock.
 */

const ON_TOP = { depthTest: false, transparent: true } as const;
const Y = (grid: HeightGrid, x: number, z: number) => sampleGrid(grid, x, z);
const ring = (x: number, y: number, z: number, r: number, n = 40): [number, number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => { const a = (i / n) * Math.PI * 2; return [x + Math.cos(a) * r, y, z + Math.sin(a) * r]; });

function Tag({ at, children, tone = 'ink' }: { at: [number, number, number]; children: React.ReactNode; tone?: 'ink' | 'water' | 'warm' }) {
  return <Html position={at} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}><span className={`layer-tag layer-tag-${tone}`}>{children}</span></Html>;
}

/**
 * The water as a graph (terrace.ts, water.ts): each pool a node at its level, each outlet an edge
 * to the pool below (or off the terrace), the streams below as lines as thick as their flow, the
 * falls' landings as rings. "Water is a graph before it is a surface."
 */
export function WaterGraphLayer({ pools, outlets, water }: { pools: PoolNode[]; outlets: OutletNode[]; water: Water }) {
  const { t } = useLanguage();
  const most = Math.max(1e-3, ...water.ways.map((w) => w.flow), ...outlets.map((o) => o.flow));
  const width = (f: number) => 1.5 + 5 * Math.sqrt(f / most);
  return <group renderOrder={40}>
    {pools.map((p, k) => <group key={`p${p.id}`}>
      <Line points={ring(p.centre[0], p.level + 0.3, p.centre[1], 6)} color={LAYER.waterMain} lineWidth={2} {...ON_TOP} />
      <Tag at={[p.centre[0], p.level + 3, p.centre[1]]} tone="water">{t('layer.pool').replace('{n}', String(k + 1))} · {t('layer.flow')} {p.inflow.toFixed(1)}</Tag>
    </group>)}
    {outlets.map((o, k) => {
      const from = pools.find((p) => p.id === o.pool);
      const to = o.landing ?? (o.to >= 0 ? (() => { const q = pools.find((p) => p.id === o.to); return q ? [q.centre[0], q.level, q.centre[1]] as [number, number, number] : null; })() : null);
      if (!from) return null;
      const pts: [number, number, number][] = [[from.centre[0], from.level + 0.3, from.centre[1]], [o.at[0], o.at[1] + 0.3, o.at[2]]];
      if (to) pts.push([to[0], to[1] + 0.3, to[2]]);
      return <group key={`o${k}`}>
        <Line points={pts} color={o.main ? LAYER.waterMain : LAYER.water} lineWidth={width(o.flow)} {...ON_TOP} />
        {o.landing && <Line points={ring(o.landing[0], o.landing[1] + 0.3, o.landing[2], 2.2, 24)} color={LAYER.water} lineWidth={1.5} {...ON_TOP} />}
      </group>;
    })}
    {water.ways.map((w, k) => <Line key={`w${k}`} points={w.points.map(([x, y, z]) => [x, y + 0.4, z] as [number, number, number])} color={w.main ? LAYER.waterMain : LAYER.water} lineWidth={width(w.flow)} {...ON_TOP} />)}
    {water.ways.filter((w) => w.main).slice(0, 1).map((w, k) => {
      const mid = w.points[Math.floor(w.points.length / 2)];
      return <Tag key={`m${k}`} at={[mid[0], mid[1] + 2.5, mid[2]]} tone="water">{t('layer.mainStream')} · {t('layer.flow')} {w.flow.toFixed(1)}</Tag>;
    })}
    <Line points={ring(water.plunge.x, water.plunge.level + 0.3, water.plunge.z, water.plunge.radius)} color={LAYER.waterMain} lineWidth={2} {...ON_TOP} />
    <Tag at={[water.plunge.x, water.plunge.level + 3, water.plunge.z]} tone="water">{t('layer.plunge')}</Tag>
  </group>;
}

/**
 * Where each creature lives (dwelling.ts): its one home, the den (where it lies), the drinking
 * stands the two share in turn, and the grass each grazes, its fill showing how much grass is
 * left (eaten down, it grows back).
 */
export function SitesLayer({ grid, dwellings, names }: { grid: HeightGrid; dwellings: Dwelling[]; names: string[] }) {
  const { t } = useLanguage();
  const first = dwellings[0];
  const grassRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const fillRefs = useRef<({ scale: { setScalar: (v: number) => void } } | null)[]>([]);
  const last = useRef(0);
  useFrame((state) => {
    if (state.clock.elapsedTime - last.current < 0.4) return;
    last.current = state.clock.elapsedTime;
    dwellings.forEach((d, i) => {
      const g = d.grazing;
      if (!g) return;
      const left = Math.max(0, Math.min(1, g.biomass));
      fillRefs.current[i]?.scale.setScalar(Math.max(0.02, left));
      const el = grassRefs.current[i];
      if (el) el.textContent = `${t('layer.grass')} ${Math.round(left * 100)}%`;
    });
  });
  if (!first) return null;
  const s = first.sites;
  return <group renderOrder={40}>
    {dwellings.map((d, i) => d.restPlace && (() => {
      const b = d.restPlace!.bed, y = Y(grid, b.x, b.z);
      return <group key={`den${i}`}>
        <Line points={ring(b.x, y + 0.12, b.z, 0.9, 24)} color={LAYER.den} lineWidth={2.5} {...ON_TOP} />
        <Tag at={[b.x, y + 2.6, b.z]} tone="warm">{t('den.of').replace('{n}', names[i] ?? '')}</Tag>
      </group>;
    })())}
    {s.stands.map((st, k) => {
      const y = Y(grid, st.x, st.z);
      return <group key={`s${k}`}>
        <Line points={ring(st.x, y + 0.12, st.z, 0.45, 16)} color={LAYER.stand} lineWidth={2} {...ON_TOP} />
        <Line points={[[st.x, y + 0.12, st.z], [st.water[0], st.water[1] + 0.05, st.water[2]]]} color={LAYER.stand} lineWidth={1} {...ON_TOP} />
      </group>;
    })}
    {s.stands.length > 0 && (() => { const st = s.stands[0]; return <Tag at={[st.x, Y(grid, st.x, st.z) + 2.2, st.z]} tone="water">{t('layer.stands').replace('{n}', String(s.stands.length))}</Tag>; })()}
    {dwellings.map((d, i) => d.grazing && (() => {
      const g = d.grazing!, y = Y(grid, g.x, g.z) + 0.1;
      return <group key={`g${i}`}>
        <Line points={ring(g.x, y, g.z, g.radius, 32)} color={LAYER.graze} lineWidth={2} {...ON_TOP} />
        <mesh ref={(m) => { fillRefs.current[i] = m as never; }} position={[g.x, y, g.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={39}>
          <circleGeometry args={[g.radius, 32]} />
          <meshBasicMaterial color={LAYER.graze} opacity={0.35} {...ON_TOP} />
        </mesh>
        <Tag at={[g.x, y + 2.2, g.z]}><span ref={(el) => { grassRefs.current[i] = el; }}>{t('layer.grass')}</span></Tag>
      </group>;
    })())}
  </group>;
}

/**
 * The two together (dwelling.ts): a line between them while one has joined the other's trip
 * (following to water or grass), a mark over the one standing aside to let the other pass.
 */
export function RelationLayer({ dwellings }: { dwellings: Dwelling[] }) {
  const { t } = useLanguage();
  const line = useRef<{ geometry: { setPositions: (p: number[]) => void }; visible: boolean } | null>(null);
  const tag = useRef<HTMLSpanElement | null>(null);
  const tagGroup = useRef<{ position: { set: (x: number, y: number, z: number) => void }; visible: boolean } | null>(null);
  const yieldMarks = useRef<({ position: { set: (x: number, y: number, z: number) => void }; visible: boolean } | null)[]>([]);
  useFrame(() => {
    const [a, b] = dwellings;
    if (!a || !b) return;
    const joiner = [a, b].find((d) => d.joined && d.pose.activity !== 'rest') ?? null;
    if (line.current) {
      line.current.visible = true;
      line.current.geometry.setPositions([a.pose.x, a.pose.y + 1.6, a.pose.z, b.pose.x, b.pose.y + 1.6, b.pose.z]);
    }
    const mx = (a.pose.x + b.pose.x) / 2, mz = (a.pose.z + b.pose.z) / 2, my = Math.max(a.pose.y, b.pose.y) + 2.6;
    tagGroup.current?.position.set(mx, my, mz);
    if (tag.current) {
      const d = Math.hypot(a.pose.x - b.pose.x, a.pose.z - b.pose.z);
      const what = joiner ? t(joiner.joined === 'drink' ? 'layer.joinDrink' : 'layer.joinEat') : t('layer.apart');
      tag.current.textContent = `${what} · ${d.toFixed(1)} m`;
      tag.current.dataset.on = joiner ? '1' : '0';
    }
    [a, b].forEach((d, i) => {
      const m = yieldMarks.current[i];
      if (!m) return;
      m.visible = d.yielding && d.pose.activity === 'walk';
      m.position.set(d.pose.x, d.pose.y + 2.4, d.pose.z);
    });
  });
  if (dwellings.length < 2) return null;
  return <group renderOrder={41}>
    <Line ref={line as never} points={[[0, 0, 0], [0, 0.01, 0]]} color={LAYER.follow} lineWidth={2} dashed dashSize={0.5} gapSize={0.35} {...ON_TOP} />
    <group ref={tagGroup as never}><Html center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}><span ref={tag} className="layer-tag layer-tag-relation" /></Html></group>
    {[0, 1].map((i) => <group key={i} ref={(g) => { yieldMarks.current[i] = g as never; }} visible={false}>
      <Html center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}><span className="layer-tag layer-tag-warm">{t('layer.yield')}</span></Html>
    </group>)}
  </group>;
}

/**
 * Each school on the island (streamFish.ts, schoolRules.ts): the fish that leads, its three rings
 * (keep apart, swim alongside, draw together: body lengths from the rule's knobs), where the school
 * is heading, and what it is doing now (roaming, or resting against the current).
 */
export function SchoolLayer({ fish }: { fish: StreamFishData[] }) {
  const { t } = useLanguage();
  const schools = useMemo(() => {
    const by = new Map<StreamFishData['pool'], StreamFishData[]>();
    for (const f of fish) by.set(f.pool, [...(by.get(f.pool) ?? []), f]);
    return [...by.values()];
  }, [fish]);
  const refs = useRef<{ rings: ({ geometry: { setPositions: (p: number[]) => void } } | null)[]; goal: { geometry: { setPositions: (p: number[]) => void } } | null; tag: { position: { set: (x: number, y: number, z: number) => void } } | null; text: HTMLSpanElement | null }[]>([]);
  useFrame(() => {
    schools.forEach((school, k) => {
      const r = refs.current[k];
      const lead = school[0];
      if (!r || !lead) return;
      const p = lead.pool.school.params, L = lead.length, y = lead.y + 0.05;
      [p.repel, p.align, p.attract].forEach((n, i) => r.rings[i]?.geometry.setPositions(ring(lead.now.x, y, lead.now.z, n * L, 36).flat()));
      const goal = lead.pool.school.goal;
      r.goal?.geometry.setPositions(goal ? [lead.now.x, y, lead.now.z, goal[0], y, goal[1]] : [lead.now.x, y, lead.now.z, lead.now.x, y + 0.001, lead.now.z]);
      r.tag?.position.set(lead.now.x, y + 1.6, lead.now.z);
      if (r.text) r.text.textContent = `${t('layer.school').replace('{n}', String(school.length))} · ${t(lead.state === 'hold' ? 'layer.fishHold' : 'layer.fishRoam')}`;
    });
  });
  const blank: [number, number, number][] = [[0, 0, 0], [0, 0.01, 0]];
  return <group renderOrder={41}>
    {schools.map((_, k) => {
      refs.current[k] ??= { rings: [], goal: null, tag: null, text: null };
      const r = refs.current[k];
      return <group key={k}>
        {[LAYER.fishRepel, LAYER.fishAlign, LAYER.fishAttract].map((c, i) => <Line key={i} ref={(l) => { r.rings[i] = l as never; }} points={blank} color={c} lineWidth={1.5} dashed dashSize={0.12} gapSize={0.08} {...ON_TOP} />)}
        <Line ref={(l) => { r.goal = l as never; }} points={blank} color={LAYER.fishGoal} lineWidth={1.5} {...ON_TOP} />
        <group ref={(g) => { r.tag = g as never; }}><Html center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}><span ref={(el) => { r.text = el; }} className="layer-tag layer-tag-water" /></Html></group>
      </group>;
    })}
  </group>;
}
