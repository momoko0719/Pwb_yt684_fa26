/** Small celadon veins exposed at two generated water-contact sites. */
export const JADE_REVEAL_GLSL = /* glsl */ `
uniform vec2 uJadePool;
uniform vec2 uJadeBend;
uniform float uJadeReveal;

float jadeVein(vec2 world, vec2 site, float radius) {
  vec2 q = world - site;
  float envelope = 1.0 - smoothstep(radius * 0.55, radius, length(q));
  float grain = sin(q.x * 1.18 + q.y * 0.38 + sin(q.y * 0.42) * 0.7);
  float strand = smoothstep(0.45, 0.92, grain);
  float broken = smoothstep(0.0, 0.4, sin(q.y * 0.32 + q.x * 0.18) + 0.25);
  // A compressed visual study of long-term exposure, completed in about half a minute.
  float timeFront = smoothstep(4.0, 30.0, uTime - length(q) * 0.8);
  return envelope * strand * broken * timeFront * uJadeReveal;
}
`;
