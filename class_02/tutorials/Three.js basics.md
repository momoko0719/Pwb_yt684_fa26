# Three.js Basics

A starter guide for using Three.js inside this React + TypeScript project. We use **React Three Fiber** (R3F) — a React wrapper around Three.js — so you write 3D scenes as JSX components instead of raw Three.js imperative code.

---

## What's installed

| Package | What it does |
| --- | --- |
| `three` | The core 3D engine |
| `@react-three/fiber` | React renderer for Three.js — write scenes as JSX |
| `@react-three/drei` | Ready-made helpers (cameras, controls, shapes, text, etc.) |

**Versions in this project:**
- `three@0.185.1`
- `@react-three/fiber@9.7.0`
- `@react-three/drei@10.7.8`

---

## Core concepts (plain language)

| Term | What it means |
| --- | --- |
| **Scene** | The 3D world container — everything lives inside it |
| **Camera** | The viewpoint into the scene |
| **Renderer** | Draws the scene to the browser canvas |
| **Mesh** | A 3D object — made of a geometry + a material |
| **Geometry** | The shape (box, sphere, plane…) |
| **Material** | The surface appearance (color, shiny, wireframe…) |
| **Light** | A light source — without one, objects appear black |
| **Canvas** | R3F's top-level component; sets up scene + renderer for you |

---

## 1. Your first 3D scene

Replace `src/App.tsx` with this to get a spinning cube on screen:

```tsx
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh } from 'three'

function SpinningCube() {
  const meshRef = useRef<Mesh>(null)

  // runs every frame (~60fps)
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.01
      meshRef.current.rotation.y += 0.01
    }
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="royalblue" />
    </mesh>
  )
}

export default function App() {
  return (
    <Canvas style={{ width: '100vw', height: '100vh' }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 2, 2]} />
      <SpinningCube />
    </Canvas>
  )
}
```

Run it:
```bash
npm run dev
```

---

## 2. What each part does

```tsx
<Canvas>          // creates the WebGL renderer + scene + camera
  <ambientLight>  // soft light from all directions
  <directionalLight position={[x, y, z]}>  // sun-like directional light
  <mesh>          // a 3D object
    <boxGeometry args={[width, height, depth]} />
    <meshStandardMaterial color="..." />
  </mesh>
</Canvas>
```

`useFrame` is a hook that runs a function on every animation frame — good for rotation, animation, and anything that changes over time.

---

## 3. Common geometries

```tsx
<boxGeometry args={[1, 1, 1]} />          // cube
<sphereGeometry args={[0.5, 32, 32]} />   // sphere (radius, widthSegments, heightSegments)
<planeGeometry args={[5, 5]} />           // flat plane
<coneGeometry args={[0.5, 1, 32]} />      // cone (radius, height, segments)
<torusGeometry args={[1, 0.3, 16, 100]} />// donut
<cylinderGeometry args={[0.5, 0.5, 1]} /> // cylinder
```

---

## 4. Common materials

```tsx
<meshBasicMaterial color="red" />         // flat color, ignores light
<meshStandardMaterial color="orange" />   // PBR material, reacts to light
<meshPhongMaterial color="green" shininess={100} />  // shiny, older model
<meshNormalMaterial />                    // rainbow normals, good for debugging
<meshWireframeMateria wireframe />        // or just add wireframe prop to any material
```

> `meshStandardMaterial` is the most realistic and most commonly used.

---

## 5. Positioning objects

Objects have `position`, `rotation`, and `scale` as props:

```tsx
<mesh position={[1, 0, 0]}>   {/* move right 1 unit */}
<mesh position={[0, 2, -3]}>  {/* x, y, z in Three.js units */}
<mesh rotation={[0, Math.PI / 4, 0]}>  {/* rotate 45° around Y */}
<mesh scale={[2, 1, 1]}>      {/* stretch along X */}
```

---

## 6. Lights

```tsx
<ambientLight intensity={0.5} />
{/* soft light everywhere — no shadows, no direction */}

<directionalLight position={[5, 5, 5]} intensity={1} />
{/* sun-like — casts parallel rays, can cast shadows */}

<pointLight position={[0, 3, 0]} intensity={2} />
{/* like a light bulb — radiates in all directions */}

<spotLight position={[0, 5, 0]} angle={0.3} />
{/* cone-shaped beam */}
```

> Without any light, `meshStandardMaterial` objects appear completely black. Always add at least an `ambientLight`.

---

## 7. Orbit controls (mouse drag to orbit)

From `@react-three/drei`, add `<OrbitControls />` inside the canvas:

```tsx
import { OrbitControls } from '@react-three/drei'

<Canvas>
  <OrbitControls />
  <ambientLight />
  <mesh>
    <sphereGeometry args={[1, 32, 32]} />
    <meshStandardMaterial color="coral" />
  </mesh>
</Canvas>
```

Left-drag to orbit, right-drag to pan, scroll to zoom.

---

## 8. Multiple objects

```tsx
<Canvas>
  <ambientLight intensity={0.5} />
  <directionalLight position={[3, 3, 3]} />

  <mesh position={[-2, 0, 0]}>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color="royalblue" />
  </mesh>

  <mesh position={[0, 0, 0]}>
    <sphereGeometry args={[0.7, 32, 32]} />
    <meshStandardMaterial color="coral" />
  </mesh>

  <mesh position={[2, 0, 0]}>
    <coneGeometry args={[0.5, 1.2, 32]} />
    <meshStandardMaterial color="limegreen" />
  </mesh>
</Canvas>
```

---

## 9. Animating with useFrame

```tsx
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh } from 'three'

function FloatingBall() {
  const ref = useRef<Mesh>(null)

  useFrame(({ clock }) => {
    if (ref.current) {
      // clock.getElapsedTime() gives seconds since start
      ref.current.position.y = Math.sin(clock.getElapsedTime()) * 0.5
    }
  })

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial color="gold" />
    </mesh>
  )
}
```

`clock.getElapsedTime()` returns seconds elapsed — `Math.sin()` turns it into a smooth oscillation.

---

## 10. Quick reference cheat sheet

| Task | Code |
| --- | --- |
| Set up a scene | `<Canvas>` |
| Add a cube | `<mesh><boxGeometry /><meshStandardMaterial /></mesh>` |
| Animate per frame | `useFrame(() => { ... })` |
| Add mouse controls | `<OrbitControls />` (from drei) |
| Soft fill light | `<ambientLight intensity={0.5} />` |
| Move an object | `position={[x, y, z]}` |
| Rotate an object | `rotation={[x, y, z]}` (radians) |
| Scale an object | `scale={[x, y, z]}` |

---

## 11. Practice exercise

1. Open `src/App.tsx`
2. Set up a `<Canvas>` with lights
3. Add three different shapes with different colors and positions
4. Add `<OrbitControls />` from drei
5. Make one shape animate with `useFrame`

---

## Official docs

- [Three.js docs](https://threejs.org/docs/)
- [React Three Fiber docs](https://docs.pmnd.rs/react-three-fiber)
- [Drei helpers catalog](https://drei.pmnd.rs/)
