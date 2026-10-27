import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useControls } from 'leva';
import type { Mesh } from 'three';
import { getPalette, nearestTimeOfDay } from '../../core/palette';
import { sunElevation } from '../../core/params/scene';
import { createSkyMaterial } from '../../core/shaders/sky';
import { applyPalette, createWorldUniforms, setSunDirection, type WorldUniforms } from '../../core/shaders/uniforms';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import { sunArc } from '../../leva/sunArc';
import { createCloudSeaMaterial } from '../island-v1/cloudSea';

/**
 * Wonderland's world around the island: sky, sea of cloud, the hour's light, and the frame meter.
 * (Moved here from the SDF lab, the only one of Wonderland's studies the terrain still drew on.)
 */
export const SUN_AZIMUTH = 2.4; // radians: light from the south-west, raking across the steps
const FAR = 6000;
/** The pixel ratio's bounds for the canvas. */
export const TERRAIN_DPR: [number, number] = [1, 1.25];
/**
 * The frame budget the resolution is held to (FrameRate): above the high mark (GPU milliseconds a
 * frame) the pixel ratio steps down, below the low mark back up, between the bounds.
 */
const FRAME_BUDGET = { high: 14, low: 9, minDpr: 0.75, maxDpr: TERRAIN_DPR[1] };

/** The hour of the day control. */
export function useHour(): number {
  const { language, t } = useLanguage();
  const light = useControls('Light', {
    hour: sunArc({ hour: 15, describe: (h) => t(`option.${nearestTimeOfDay(h)}` as StringKey), label: t('leva.timeOfDay'), hint: t('hint.timeOfDay') }),
  }, [language]);
  return light.hour;
}

/**
 * Sky, sea of cloud and light for the hour; the island goes inside, given the world's uniforms.
 * `clouds` is the height of the sea of cloud, metres: below the island's lowest point, so the
 * island floats clear of it.
 */
export function World({ hour, clouds: cloudHeight = -70, children }: { hour: number; clouds?: number; children: (uniforms: WorldUniforms) => React.ReactNode }) {
  const uniforms = useMemo(createWorldUniforms, []);
  const sky = useMemo(() => createSkyMaterial(uniforms), [uniforms]);
  const clouds = useMemo(() => createCloudSeaMaterial(uniforms), [uniforms]);
  useEffect(() => {
    applyPalette(uniforms, getPalette('qinglv', hour));
    setSunDirection(uniforms, SUN_AZIMUTH, Math.max(sunElevation(hour), 5));
    clouds.uniforms.uCloudScale.value = 4;
  }, [uniforms, clouds, hour]);
  const skyRef = useRef<Mesh>(null);
  const cloudRef = useRef<Mesh>(null);
  useFrame(({ camera, clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    skyRef.current?.position.copy(camera.position);
    cloudRef.current?.position.set(camera.position.x, cloudHeight, camera.position.z);
  });
  // Skip raycast so OrbitControls zoomToCursor hits terrain, not sky / cloud sea.
  const noHit = () => {};
  return (
    <>
      <mesh ref={skyRef} material={sky} frustumCulled={false} raycast={noHit}>
        <sphereGeometry args={[FAR * 0.8, 32, 16]} />
      </mesh>
      {children(uniforms)}
      <mesh ref={cloudRef} material={clouds} rotation-x={-Math.PI / 2} frustumCulled={false} raycast={noHit}>
        <planeGeometry args={[FAR * 1.6, FAR * 1.6]} />
      </mesh>
    </>
  );
}

type Cell = React.RefObject<HTMLTableCellElement | null>;

// The frame meter runs inside the canvas, the panel outside it: the panel lends its cells here.
const meterCells: { fps: Cell | null; gpu: Cell | null } = { fps: null, gpu: null };

/** The page's panel: its rows (label, value), then the frame rate and the GPU's time a frame. */
export function StatsPanel({ rows = [], title }: { rows?: [string, string][]; title: string }) {
  const { t } = useLanguage();
  const fps = useRef<HTMLTableCellElement>(null);
  const gpu = useRef<HTMLTableCellElement>(null);
  useEffect(() => {
    meterCells.fps = fps;
    meterCells.gpu = gpu;
    return () => { meterCells.fps = null; meterCells.gpu = null; };
  }, []);
  return (
    <div className="stats-panel">
      <div className="scale-head">{title}</div>
      <table>
        <tbody>
          {rows.map(([label, value]) => <tr key={label}><td>{label}</td><td>{value}</td></tr>)}
          <tr><td>{t('lab.fps')}</td><td ref={fps}>–</td></tr>
          <tr><td>{t('lab.gpu')}</td><td ref={gpu}>–</td></tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * Frames per second, and the GPU's time per frame (a timer query around each render, where the
 * browser offers one), written straight into the panel's cells twice a second (no re-render). The
 * GPU time is the honest cost: the frame rate is capped by the screen and slowed in a hidden tab.
 *
 * It also holds the frame to its budget (FRAME_BUDGET): when the GPU's time runs over, the pixel
 * ratio steps down, and back up when there is room.
 */
export function FrameRate() {
  const count = useRef({ frames: 0, since: 0 });
  const gpuMs = useRef(0);
  const gl = useThree((s) => s.gl);
  const setDpr = useThree((s) => s.setDpr);
  const dpr = useRef(Math.min(window.devicePixelRatio, FRAME_BUDGET.maxDpr));
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  // In development only: hand the renderer to the browser console, for profiling (time a render
  // with parts hidden, count draw calls) and for aiming the view at a spot to check.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { guixuProbe?: unknown }).guixuProbe = { gl, scene, camera, controls };
  }, [gl, scene, camera, controls]);
  useEffect(() => {
    const ctx = gl.getContext() as WebGL2RenderingContext;
    const ext = ctx.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext) return;
    const render = gl.render;
    const pending: WebGLQuery[] = [];
    gl.render = (scene, camera) => {
      const query = ctx.createQuery();
      ctx.beginQuery(ext.TIME_ELAPSED_EXT, query);
      render.call(gl, scene, camera);
      ctx.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push(query);
      while (pending.length && ctx.getQueryParameter(pending[0], ctx.QUERY_RESULT_AVAILABLE)) {
        const done = pending.shift()!;
        if (!ctx.getParameter(ext.GPU_DISJOINT_EXT)) gpuMs.current = 0.8 * gpuMs.current + 0.2 * (ctx.getQueryParameter(done, ctx.QUERY_RESULT) / 1e6);
        ctx.deleteQuery(done);
      }
    };
    return () => { gl.render = render; };
  }, [gl]);
  useFrame(({ clock }) => {
    const c = count.current;
    c.frames++;
    const now = clock.elapsedTime;
    if (now - c.since >= 0.5) {
      const fps = meterCells.fps?.current, gpu = meterCells.gpu?.current;
      if (fps) fps.textContent = String(Math.round(c.frames / (now - c.since)));
      if (gpu && gpuMs.current > 0) gpu.textContent = `${gpuMs.current.toFixed(1)} ms · ${dpr.current.toFixed(2)}x`;
      // Hold the budget: step the pixel ratio by a tenth at most twice a second.
      const ms = gpuMs.current;
      if (ms > 0) {
        const next = ms > FRAME_BUDGET.high ? dpr.current * 0.9 : ms < FRAME_BUDGET.low ? dpr.current * 1.05 : dpr.current;
        const clamped = Math.min(Math.max(next, FRAME_BUDGET.minDpr), Math.min(window.devicePixelRatio, FRAME_BUDGET.maxDpr));
        if (Math.abs(clamped - dpr.current) > 0.01) {
          dpr.current = clamped;
          setDpr(clamped);
        }
      }
      c.frames = 0;
      c.since = now;
    }
  });
  return null;
}
