# Installing React

A short guide for this course: check what you already have, decide if you need updates, then create a React app.

---

## Your machine (checked Sep 2, 2026)

| Tool | Status | Version | Need update? |
| --- | --- | --- | --- |
| **Node.js** | Installed | `v24.13.0` | **No** — this is current Active LTS |
| **npm** | Installed | `11.6.2` | **No** — comes with Node |
| **npx** | Installed | `11.6.2` | **No** |
| **nvm** | Installed (`nvm4w`) | `1.2.2` | Optional; useful for switching Node versions |
| **React** | Not installed yet | — | Install **per project** (not globally) |

**Bottom line:** Node and npm are ready. You do **not** need to reinstall or upgrade Node. Next step is to create a React project (React will be added inside that project).

---

## 1. How to check yourself anytime

Open a terminal and run:

```bash
node --version
npm --version
npx --version
```

### Is React installed?

React is usually a **project dependency**, not a global app. Check inside a project folder:

```bash
npm list react react-dom
```

Or open that project's `package.json` and look for `"react"` under `dependencies`.

Check global installs (usually empty — that's fine):

```bash
npm list -g react react-dom
```

If you see `(empty)`, React is not installed globally. That is normal.

### See which Node versions nvm knows about

```bash
nvm list
```

On this machine you currently have: `* 24.13.0` (active).

---

## 2. Do you need to update?

### Node.js

| Situation | Action |
| --- | --- |
| You have **v24.x** (LTS) | Keep it — good for class work |
| You have **v22.x** (older LTS) | Still OK; upgrade later if you want |
| You have **v20 or older** | Update to LTS 24 |
| You have an **odd** version (23, 25, …) | Prefer even LTS (22 or 24) for stability |

**You are on v24.13.0 → no update required.**

If you ever do need to install/switch with nvm on Windows:

```bash
nvm install 24
nvm use 24
node --version
```

### React

React version lives in each project. When you create a new app with Vite (below), you get a current React (typically React 19). You only “update React” later with:

```bash
npm install react@latest react-dom@latest
```

inside that project folder.

---

## 3. Install React the modern way (Vite)

`create-react-app` is outdated. For 2026 class work, use **Vite + React**.

### Create the app

From a parent folder (for example inside this course repo, or Desktop):

```bash
npm create vite@latest my-react-app -- --template react
```

Or TypeScript template:

```bash
npm create vite@latest my-react-app -- --template react-ts
```

Then:

```bash
cd my-react-app
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### What just happened?

| Step | Meaning |
| --- | --- |
| `npm create vite@latest ...` | Scaffolds a React project |
| `npm install` | Downloads React, React DOM, Vite, etc. into `node_modules` |
| `npm run dev` | Starts the local dev server |

After `npm install`, confirm React:

```bash
npm list react react-dom
```

---

## 4. Optional: React + Three.js (later for this course)

Your backlog mentions React + Three.js. After the basic Vite app works, you can add Three.js:

```bash
npm install three @react-three/fiber @react-three/drei
```

Do this only after the basic React app runs.

---

## 5. Common problems

### `node` is not recognized

Node is not installed, or the terminal was open before install. Close and reopen the terminal, or install from [nodejs.org](https://nodejs.org/) (LTS) / use nvm.

### Port already in use

Vite will offer another port, or stop the other process using 5173.

### Want a fresh check after installing

```bash
node --version
npm --version
cd my-react-app
npm list react react-dom
```

---

## 6. Quick checklist

- [x] Node.js installed (`v24.13.0` on this machine)
- [x] npm works (`11.6.2`)
- [ ] Create a Vite React app
- [ ] `npm install` then `npm run dev`
- [ ] Confirm `npm list react` shows a version
- [ ] (Later) Add Three.js packages when needed

---

## Official docs

- [Node.js downloads](https://nodejs.org/)
- [Vite + React guide](https://vite.dev/guide/)
- [React docs](https://react.dev/learn)
