import { Color, Vector3 } from 'three';
import type { WorldPalette } from '../palette';

/**
 * One uniform set shared by every world material. Materials spread these in,
 * so updating a value here updates the sky, terrain, and fog together.
 */
export function createWorldUniforms() {
  return {
    uSkyTop: { value: new Color() },
    uSkyMid: { value: new Color() },
    uSkyHorizon: { value: new Color() },
    uFogColor: { value: new Color() },
    uMeadow: { value: new Color() },
    uRock: { value: new Color() },
    uRockFace: { value: new Color() },
    uMineral: { value: new Color() },
    uRimColor: { value: new Color() },
    uAccent: { value: new Color() },
    uLightWarm: { value: new Color() },
    uShadowCool: { value: new Color() },
    uCloudLight: { value: new Color() },
    uCloudShade: { value: new Color() },
    uPeakTop: { value: new Color() },
    uSunDir: { value: new Vector3(0, 0.1, -1).normalize() },
    uTime: { value: 0 },
    uWind: { value: 0.5 },
  };
}

export type WorldUniforms = ReturnType<typeof createWorldUniforms>;

export function applyPalette(u: WorldUniforms, p: WorldPalette) {
  u.uSkyTop.value.set(p.skyTop);
  u.uSkyMid.value.set(p.skyMid);
  u.uSkyHorizon.value.set(p.skyHorizon);
  u.uFogColor.value.set(p.fog);
  u.uMeadow.value.set(p.meadow);
  u.uRock.value.set(p.rock);
  u.uRockFace.value.set(p.rockFace);
  u.uMineral.value.set(p.mineral);
  u.uRimColor.value.set(p.rim);
  u.uAccent.value.set(p.accent);
  u.uLightWarm.value.set(p.lightWarm);
  u.uShadowCool.value.set(p.shadowCool);
  u.uCloudLight.value.set(p.cloudLight);
  u.uCloudShade.value.set(p.cloudShade);
  u.uPeakTop.value.set(p.peakTop);
}

/** Points the sun at a world-space azimuth (radians, from +x toward +z) and elevation (degrees). */
export function setSunDirection(u: WorldUniforms, azimuth: number, elevationDeg: number) {
  const el = (elevationDeg * Math.PI) / 180;
  u.uSunDir.value.set(Math.cos(azimuth) * Math.cos(el), Math.sin(el), Math.sin(azimuth) * Math.cos(el));
}

/** Puts the sun on the far side of `target` as seen from the camera, so the view is backlit. */
export function placeSunBehind(u: WorldUniforms, camera: Vector3, target: Vector3, elevationDeg: number) {
  setSunDirection(u, Math.atan2(target.z - camera.z, target.x - camera.x), elevationDeg);
}
