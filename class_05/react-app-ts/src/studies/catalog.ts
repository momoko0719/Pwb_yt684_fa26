import type { StudyMeta, ParamValues } from './types';

export const STUDIES: StudyMeta[] = [
  {
    id: 'vertex',
    category: 'basics',
    name: 'Vertex Shader',
    short: 'Runs once per vertex. Moves points in space before triangles are drawn.',
    params: [
      { key: 'amp', label: 'Wave amplitude', kind: 'float', min: 0, max: 0.4, step: 0.01, default: 0.15 },
      { key: 'freq', label: 'Wave frequency', kind: 'float', min: 0.5, max: 8, step: 0.1, default: 3 },
      { key: 'speed', label: 'Speed', kind: 'float', min: 0, max: 4, step: 0.05, default: 1.2 },
    ],
    snippet: 'gl_Position = projectionMatrix * modelViewMatrix * vec4(position + offset, 1.0);',
  },
  {
    id: 'fragment',
    category: 'basics',
    name: 'Fragment Shader',
    short: 'Runs once per pixel. Paints color after the shape is projected.',
    params: [
      { key: 'scale', label: 'Pattern scale', kind: 'float', min: 1, max: 20, step: 0.5, default: 8 },
      { key: 'mixA', label: 'Color A mix', kind: 'float', min: 0, max: 1, step: 0.01, default: 0.35 },
    ],
    snippet: 'gl_FragColor = vec4(pattern, 1.0);',
  },
  {
    id: 'flat',
    category: 'basics',
    name: 'Flat Shader / Uniform',
    short: 'One solid color from a uniform — the simplest material control.',
    params: [
      { key: 'r', label: 'Red', kind: 'float', min: 0, max: 1, step: 0.01, default: 0.75 },
      { key: 'g', label: 'Green', kind: 'float', min: 0, max: 1, step: 0.01, default: 0.55 },
      { key: 'b', label: 'Blue', kind: 'float', min: 0, max: 1, step: 0.01, default: 0.4 },
      { key: 'intensity', label: 'Intensity', kind: 'float', min: 0.2, max: 2, step: 0.05, default: 1 },
    ],
    snippet: 'uniform vec3 uColor;  gl_FragColor = vec4(uColor * uIntensity, 1.0);',
  },
  {
    id: 'posGrad',
    category: 'gradients',
    name: 'Position-Based Gradient',
    short: 'Color comes from position in space — height, width, or depth becomes paint.',
    hasMask: true,
    params: [
      { key: 'axis', label: 'Axis', kind: 'select', default: 'y', options: [
        { value: 'x', label: 'X' }, { value: 'y', label: 'Y' }, { value: 'z', label: 'Z' },
      ]},
      { key: 'soft', label: 'Softness', kind: 'float', min: 0.1, max: 2, step: 0.05, default: 1 },
    ],
    snippet: 'float t = clamp(vPos.y * 0.5 + 0.5, 0.0, 1.0);',
  },
  {
    id: 'interp',
    category: 'gradients',
    name: 'Linear / Smooth Interpolation',
    short: 'Same endpoints, different curves: linear vs smoothstep changes the feel.',
    hasMask: true,
    params: [
      { key: 'mode', label: 'Mode', kind: 'select', default: 'smooth', options: [
        { value: 'linear', label: 'Linear' },
        { value: 'smooth', label: 'Smoothstep' },
      ]},
      { key: 'edge0', label: 'Edge 0', kind: 'float', min: 0, max: 0.8, step: 0.01, default: 0.2 },
      { key: 'edge1', label: 'Edge 1', kind: 'float', min: 0.2, max: 1, step: 0.01, default: 0.8 },
    ],
    snippet: 'float t = mix(a, b, smoothstep(e0, e1, x));',
  },
  {
    id: 'bezier',
    category: 'gradients',
    name: 'Bezier Interpolation',
    short: 'A cubic Bezier curve reshapes a 0→1 ramp into custom ease-in / ease-out.',
    hasMask: true,
    params: [
      { key: 'c1', label: 'Control 1', kind: 'float', min: 0, max: 1, step: 0.01, default: 0.2 },
      { key: 'c2', label: 'Control 2', kind: 'float', min: 0, max: 1, step: 0.01, default: 0.85 },
    ],
    snippet: 'float b = mix(mix(p0,p1,t), mix(p1,p2,t), t); // cubic',
  },
  {
    id: 'equation',
    category: 'gradients',
    name: 'Equation-Based Gradients',
    short: 'Color from a math equation: rings, waves, or radial falloff.',
    hasMask: true,
    params: [
      { key: 'eq', label: 'Equation', kind: 'select', default: 'rings', options: [
        { value: 'rings', label: 'Rings' },
        { value: 'waves', label: 'Waves' },
        { value: 'radial', label: 'Radial' },
      ]},
      { key: 'freq', label: 'Frequency', kind: 'float', min: 1, max: 12, step: 0.2, default: 5 },
      { key: 'phase', label: 'Phase', kind: 'float', min: 0, max: 6.28, step: 0.05, default: 0 },
    ],
    snippet: 'float m = sin(length(xz) * freq + phase);',
  },
  {
    id: 'fresnel',
    category: 'spatial',
    name: 'Fresnel',
    short: 'Edges light up when the surface turns away from the camera — glass / rim light.',
    hasMask: true,
    params: [
      { key: 'power', label: 'Power', kind: 'float', min: 0.5, max: 8, step: 0.1, default: 2.5 },
      { key: 'bias', label: 'Bias', kind: 'float', min: 0, max: 0.5, step: 0.01, default: 0.05 },
      { key: 'scale', label: 'Scale', kind: 'float', min: 0.2, max: 2, step: 0.05, default: 1 },
    ],
    snippet: 'float f = bias + scale * pow(1.0 - dot(N, V), power);',
  },
  {
    id: 'slope',
    category: 'spatial',
    name: 'Slope Shader',
    short: 'Steep faces vs flat ground get different colors — useful for terrain materials.',
    hasMask: true,
    params: [
      { key: 'threshold', label: 'Slope threshold', kind: 'float', min: 0.1, max: 0.95, step: 0.01, default: 0.55 },
      { key: 'soft', label: 'Blend soft', kind: 'float', min: 0.01, max: 0.4, step: 0.01, default: 0.12 },
      { key: 'hills', label: 'Hill height', kind: 'float', min: 0.1, max: 0.8, step: 0.02, default: 0.35 },
    ],
    snippet: 'float slope = 1.0 - abs(normal.y);',
  },
  {
    id: 'distance',
    category: 'spatial',
    name: 'Distance-Driven Shader',
    short: 'Color depends on distance to a point. Drag the influence with the slider.',
    hasMask: true,
    params: [
      { key: 'radius', label: 'Radius', kind: 'float', min: 0.3, max: 3, step: 0.05, default: 1.2 },
      { key: 'px', label: 'Point X', kind: 'float', min: -1.5, max: 1.5, step: 0.05, default: 0.4 },
      { key: 'py', label: 'Point Y', kind: 'float', min: -1, max: 1.5, step: 0.05, default: 0.6 },
      { key: 'pz', label: 'Point Z', kind: 'float', min: -1.5, max: 1.5, step: 0.05, default: 0.2 },
    ],
    snippet: 'float d = distance(vWorldPos, uPoint);',
  },
  {
    id: 'ao',
    category: 'spatial',
    name: 'Ambient Occlusion',
    short: 'Soft darkening in creases and near contact — fake AO from normals & height.',
    hasMask: true,
    params: [
      { key: 'strength', label: 'Strength', kind: 'float', min: 0, max: 1.5, step: 0.05, default: 0.85 },
      { key: 'radius', label: 'Occlusion radius', kind: 'float', min: 0.1, max: 1.5, step: 0.05, default: 0.55 },
    ],
    snippet: '// crease darkening from normal variation + floor proximity',
  },
  {
    id: 'contact',
    category: 'materials',
    name: 'Contact Shader',
    short: 'Soft shadow / glow where an object nearly touches a surface.',
    hasMask: true,
    params: [
      { key: 'height', label: 'Object height', kind: 'float', min: 0.05, max: 1.2, step: 0.02, default: 0.35 },
      { key: 'soft', label: 'Contact soft', kind: 'float', min: 0.05, max: 0.8, step: 0.02, default: 0.25 },
      { key: 'intensity', label: 'Intensity', kind: 'float', min: 0, max: 2, step: 0.05, default: 1.1 },
    ],
    snippet: 'float contact = 1.0 - smoothstep(0.0, soft, height);',
  },
  {
    id: 'matcap',
    category: 'materials',
    name: 'Matcap',
    short: 'Look up lighting from a sphere texture using the view-space normal — fast stylized shading.',
    params: [
      { key: 'contrast', label: 'Contrast', kind: 'float', min: 0.5, max: 2, step: 0.05, default: 1.1 },
      { key: 'tint', label: 'Warm tint', kind: 'float', min: 0, max: 1, step: 0.01, default: 0.35 },
    ],
    snippet: 'vec2 uv = normalView.xy * 0.5 + 0.5; // sample matcap',
  },
  {
    id: 'displace',
    category: 'geometry',
    name: 'Vertex Displacement',
    short: 'Push vertices along normals with noise / waves — turns a smooth mesh into living terrain.',
    params: [
      { key: 'amp', label: 'Amplitude', kind: 'float', min: 0, max: 0.5, step: 0.01, default: 0.18 },
      { key: 'freq', label: 'Frequency', kind: 'float', min: 0.5, max: 8, step: 0.1, default: 2.5 },
      { key: 'noise', label: 'Noise mix', kind: 'float', min: 0, max: 1, step: 0.05, default: 0.6 },
      { key: 'speed', label: 'Time speed', kind: 'float', min: 0, max: 3, step: 0.05, default: 0.8 },
    ],
    snippet: 'pos += normal * (wave + noise) * amp;',
  },
  {
    id: 'combo',
    category: 'final',
    name: 'Contact + Noise + Displacement',
    short: 'Combine contact shading, noise, and vertex deformation into one living material study.',
    hasMask: true,
    params: [
      { key: 'amp', label: 'Displace amp', kind: 'float', min: 0, max: 0.4, step: 0.01, default: 0.14 },
      { key: 'freq', label: 'Noise freq', kind: 'float', min: 0.5, max: 6, step: 0.1, default: 2.2 },
      { key: 'contact', label: 'Contact soft', kind: 'float', min: 0.05, max: 0.7, step: 0.02, default: 0.28 },
      { key: 'speed', label: 'Motion', kind: 'float', min: 0, max: 2, step: 0.05, default: 0.6 },
    ],
    snippet: 'color *= contact;  pos += n * noise * amp;',
  },
];

export function defaultsFor(study: StudyMeta): ParamValues {
  const out: ParamValues = {};
  for (const p of study.params) out[p.key] = p.default;
  return out;
}

export function getStudy(id: string): StudyMeta {
  return STUDIES.find(s => s.id === id) ?? STUDIES[0];
}
