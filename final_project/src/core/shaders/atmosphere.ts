/** GLSL shared by all world materials: uniform declarations, the wind field and rim light. */
/** Wind speeds are stored in the field texture as -WIND_RANGE..WIND_RANGE (see windTexture). */
export const WIND_RANGE = 2.5;

export const ATMOSPHERE_GLSL = /* glsl */ `
#define WIND_RANGE ${WIND_RANGE.toFixed(2)}
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
uniform sampler2D uWindField; // the island's wind field (generators/wind.ts), RG = velocity
uniform float uWindHalf;      // world half-size the field covers; 0 = no field yet

// One wind for the whole world, read from the island's wind field (Class 06): the prevailing wind
// bent around the peaks, with a wake behind them and small eddies. Gusts are patches of noise
// rolling along the local wind; on top of them a faster flutter. Returns a horizontal push, 0 when
// uWind is 0.
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
vec2 windField(vec2 p) {
  vec2 uv = p / (2.0 * max(uWindHalf, 0.001)) + 0.5;
  if (uWindHalf <= 0.0 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return WIND_DIR;
  return (texture2D(uWindField, uv).rg * 2.0 - 1.0) * WIND_RANGE;
}
vec2 windAt(vec2 p) {
  vec2 f = windField(p);
  float speed = length(f);
  vec2 dir = speed > 0.001 ? f / speed : WIND_DIR;
  float gust = windNoise(p * 0.08 - dir * uTime * 0.5);
  float flutter = sin(uTime * 2.7 + dot(p, dir) * 1.3 + windNoise(p * 0.7) * 6.0);
  vec2 across = vec2(-dir.y, dir.x);
  return uWind * (f * (0.25 + 0.9 * gust) + across * 0.15 * flutter * speed);
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
