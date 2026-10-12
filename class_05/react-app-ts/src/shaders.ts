/**
 * Three Guixu materials, each one small shader:
 *   glaze (琉璃)  Fresnel rim + height gradient + highlight, on a glazed rock
 *   pearl (珠光)  thin-film iridescence + light through the petal, on a strange flower
 *   glow  (荧光)  bioluminescent sea: waves glow at their crests and where you touch
 * Every fragment shader can show its mask instead (the 0..1 value that drives the effect).
 */

const NOISE = /* glsl */ `
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`;

const BASIC_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const GLAZE = {
  vertex: BASIC_VERTEX,
  fragment: /* glsl */ `
uniform float uPower;
uniform float uRim;
uniform float uMask;
uniform vec3 uLight;
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uLight);
  // Glaze pools darker low down and thins to a bright azure on top.
  vec3 deep = vec3(0.07, 0.36, 0.40);
  vec3 azure = vec3(0.30, 0.58, 0.82);
  vec3 base = mix(deep, azure, smoothstep(-1.0, 1.2, vWorld.y));
  float diffuse = 0.45 + 0.55 * max(dot(N, L), 0.0);
  float rim = pow(1.0 - max(dot(N, V), 0.0), uPower);           // the Fresnel mask
  float spec = pow(max(dot(N, normalize(L + V)), 0.0), 60.0);
  vec3 color = base * diffuse + vec3(1.0, 0.86, 0.55) * rim * uRim + spec * 0.8;
  gl_FragColor = vec4(mix(color, vec3(rim), uMask), 1.0);
}
`,
};

export const PEARL = {
  vertex: BASIC_VERTEX,
  fragment: /* glsl */ `
uniform float uFilm;
uniform float uIrid;
uniform float uBack;
uniform float uMask;
uniform vec3 uLight;
varying vec3 vNormal;
varying vec3 vWorld;
${NOISE}
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(N, V) < 0.0) N = -N; // petals are seen from both sides
  vec3 L = normalize(uLight);
  float facing = max(dot(N, V), 0.0);
  // Thin film: the colour depends on how slanted the view is, like oil on water or a pearl.
  float t = uFilm * (1.0 - facing) + 0.15 * noise(vWorld * 3.0);
  vec3 film = 0.5 + 0.5 * cos(6.2831 * (t + vec3(0.0, 0.33, 0.67)));
  vec3 base = vec3(0.96, 0.88, 0.92);
  float light = 0.55 + 0.45 * abs(dot(N, L));
  // Light coming from behind the petal shows through it, warm.
  float back = pow(max(dot(-L, V), 0.0), 3.0) * uBack;
  // Pearl, not oil: the film is softened toward white and shows mostly where the petal turns away.
  vec3 soft = mix(film, vec3(1.0), 0.35);
  vec3 color = mix(base, soft, uIrid * pow(1.0 - facing, 1.5)) * light + vec3(1.0, 0.72, 0.62) * back;
  float mask = 1.0 - facing;
  gl_FragColor = vec4(mix(color, vec3(mask), uMask), 1.0);
}
`,
};

export const GLOW = {
  vertex: /* glsl */ `
uniform float uTime;
uniform float uWaves;
varying vec3 vWorld;
varying float vHeight;
${NOISE}
float waves(vec2 p) {
  return (sin(p.x * 0.35 + uTime * 0.9) * 0.6 + sin(p.y * 0.28 - uTime * 0.7 + p.x * 0.1) * 0.5
        + noise(vec3(p * 0.25, uTime * 0.3)) * 1.2) * uWaves;
}
void main() {
  vec3 p = position;
  float h = waves(p.xy);
  p.z += h;
  vHeight = h / max(uWaves, 0.001);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`,
  fragment: /* glsl */ `
uniform float uTime;
uniform float uGlow;
uniform float uMask;
uniform vec3 uTouch;
uniform float uTouchTime;
varying vec3 vWorld;
varying float vHeight;
${NOISE}
void main() {
  vec3 water = vec3(0.03, 0.07, 0.12);
  // Plankton light up where the water is stirred: on the crests ...
  float crest = smoothstep(1.05, 1.6, vHeight);
  float flicker = 0.55 + 0.45 * noise(vec3(vWorld.xz * 1.5, uTime * 2.0));
  // ... and in a ring spreading from where you touched.
  float age = uTime - uTouchTime;
  float ring = exp(-pow((distance(vWorld.xz, uTouch.xz) - age * 6.0) * 0.7, 2.0)) * exp(-age * 0.8);
  float glow = clamp((crest * flicker + ring) * uGlow, 0.0, 1.5);
  vec3 color = water + vec3(0.15, 0.62, 1.0) * glow + vec3(0.6, 0.95, 1.0) * pow(glow, 3.0) * 0.4;
  gl_FragColor = vec4(mix(color, vec3(min(glow, 1.0)), uMask), 1.0);
}
`,
};

export const SNIPPETS = {
  glaze: 'float rim = pow(1.0 - dot(N, V), power);',
  pearl: 'vec3 film = 0.5 + 0.5 * cos(6.28 * (thickness * (1.0 - dot(N, V)) + vec3(0, .33, .67)));',
  glow: 'float glow = smoothstep(1.05, 1.6, height) * flicker + ring;',
};
