/**
 * Sample a scalar field into a regular 3D grid (Float32Array).
 * Index = x + y * n + z * n * n
 */

export function createVolume(
  n: number,
  sample: (x: number, y: number, z: number) => number,
  /** World half-extent mapped to [−extent, +extent] */
  extent = 1,
): Float32Array {
  const data = new Float32Array(n * n * n);
  const inv = n > 1 ? 1 / (n - 1) : 0;
  for (let z = 0; z < n; z++) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const wx = (x * inv * 2 - 1) * extent;
        const wy = (y * inv * 2 - 1) * extent;
        const wz = (z * inv * 2 - 1) * extent;
        data[x + y * n + z * n * n] = sample(wx, wy, wz);
      }
    }
  }
  return data;
}

export function volumeIndex(x: number, y: number, z: number, n: number): number {
  return x + y * n + z * n * n;
}
