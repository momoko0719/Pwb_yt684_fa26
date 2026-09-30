/** GLSL shared by all world materials: uniform declarations, the wind field and rim light. */
export const ATMOSPHERE_GLSL = /* glsl */ `
uniform vec3 uSkyTop;
uniform vec3 uSkyMid;
uniform vec3 uSkyHorizon;
uniform vec3 uFogColor;
uniform vec3 uMeadow;
uniform vec3 uRock;
uniform vec3 uRockFace;
uniform vec3 uMineral;
uniform vec3 uRimColor;
uniform vec3 uAccent;
uniform vec3 uLightWarm;
uniform vec3 uShadowCool;
uniform vec3 uCloudLight;
uniform vec3 uCloudShade;
uniform vec3 uPeakTop;
uniform vec3 uSunDir;
uniform float uTime;
uniform float uWind;

// One wind for the whole world. Gusts are patches of noise rolling across the island along
// WIND_DIR; on top of them a faster flutter. Returns a horizontal push, 0 when uWind is 0.
const vec2 WIND_DIR = vec2(0.8, 0.6);
float windHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float windNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  float a = mix(windHash(cell), windHash(cell + vec2(1.0, 0.0)), w.x);
  float b = mix(windHash(cell + vec2(0.0, 1.0)), windHash(cell + vec2(1.0, 1.0)), w.x);
  return mix(a, b, w.y);
}
vec2 windAt(vec2 p) {
  float gust = windNoise(p * 0.08 - WIND_DIR * uTime * 0.5);
  float flutter = sin(uTime * 2.7 + dot(p, WIND_DIR) * 1.3 + windNoise(p * 0.7) * 6.0);
  vec2 across = vec2(-WIND_DIR.y, WIND_DIR.x);
  return uWind * (WIND_DIR * (0.25 + 0.9 * gust) + across * 0.15 * flutter);
}

// Grazing-angle glow, strongest when the sun sits behind the surface.
vec3 rimLight(vec3 n, vec3 v) {
  float edge = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  float backlit = max(dot(-v, uSunDir), 0.0);
  return uRimColor * edge * (0.2 + 0.8 * backlit);
}
`;

/** Vertex shader that only passes the world position through. */
export const WORLD_POSITION_VERT = /* glsl */ `
varying vec3 vWorldPos;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;
