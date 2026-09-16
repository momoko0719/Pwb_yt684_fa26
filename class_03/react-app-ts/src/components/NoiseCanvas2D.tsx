import { useEffect, useRef } from 'react';
import type { ColorMode } from '../types';
import { noiseToRGB } from '../lib/colors';

interface Props {
  noiseMap: Float32Array;
  resolution: number;
  colorMode: ColorMode;
}

/**
 * Renders the noise map as a pixel grid onto an HTML <canvas>.
 * The canvas internal size equals `resolution × resolution`; CSS scales it up.
 */
export default function NoiseCanvas2D({ noiseMap, resolution, colorMode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width  = resolution;
    canvas.height = resolution;

    const imageData = ctx.createImageData(resolution, resolution);
    const data = imageData.data; // Uint8ClampedArray, RGBA

    for (let i = 0; i < resolution * resolution; i++) {
      const [r, g, b] = noiseToRGB(noiseMap[i], colorMode);
      const base = i * 4;
      data[base]     = Math.round(r * 255);
      data[base + 1] = Math.round(g * 255);
      data[base + 2] = Math.round(b * 255);
      data[base + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
  }, [noiseMap, resolution, colorMode]);

  return (
    <canvas
      ref={canvasRef}
      className="noise-canvas-2d"
      aria-label="2D noise map"
    />
  );
}
