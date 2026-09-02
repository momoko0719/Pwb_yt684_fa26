import Scene from './components/Scene'
import Sidebar from './components/Sidebar'
import './App.css'

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="header-dot" />
          <h1 className="site-title">Procedural World Building</h1>
        </div>
        <span className="header-meta">Design 4197-6197 · Ella Tao · Fall 2026</span>
      </header>

      <main className="main">
        <div className="canvas-wrapper">
          <Scene />
          <div className="canvas-hint">Left drag · orbit &nbsp;|&nbsp; Right drag · pan &nbsp;|&nbsp; Scroll · zoom</div>
        </div>
        <Sidebar />
      </main>
    </div>
  )
}
