import { useRef } from "react";
import { useGameEngine } from "./game/useGameEngine";
import { LEVELS } from "./game/levels";
import "./styles.css";

export default function App() {
  const canvasRef = useRef(null);
  const { hud, controls } = useGameEngine(canvasRef);

  return (
    <div className="wrapper">
      <div className="card">
        <div className="hud">
          <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap"}}>
            <span className="badge">Nivel: <strong>{hud.levelName}</strong></span>
            <span className="badge">Velocidad: {Math.round(hud.speed)} px/s</span>
            <span className="badge">Puntaje: <strong>{hud.score}</strong></span>
            <span className="badge">Récord: <strong>{hud.highScore}</strong></span>
            <span className="badge">Vidas: ❤️ {hud.lives}</span>
            {hud.shield && <span className="badge" style={{borderColor:"rgba(34,197,94,0.5)"}}>Escudo activo</span>}
            {hud.paused && !hud.gameOver && <span className="badge" style={{borderColor:"rgba(34,211,238,0.5)", color:"#a5f3fc"}}>Pausado</span>}
            {hud.gameOver && <span className="badge" style={{borderColor:"rgba(239,68,68,0.6)", color:"#fecaca"}}>Game Over</span>}
          </div>
          <div className="btns">
            <button className="primary" onClick={controls.start}>Iniciar</button>
            <button onClick={controls.togglePause}>Pausa/Continuar</button>
            <button onClick={controls.reset}>Reiniciar</button>
          </div>
        </div>

        <div className="info">
          Controles: <span className="kbd">Enter</span> iniciar/reiniciar,&nbsp;
          <span className="kbd">Espacio</span>/<span className="kbd">↑</span> saltar,&nbsp;
          <span className="kbd">↓</span> agacharse,&nbsp;
          <span className="kbd">P</span> pausar,&nbsp;
          <span className="kbd">R</span> reiniciar. En móvil: toque para saltar, mantener para agacharse.
        </div>

        <div className="info">
          Progresión automática de nivel: 0→1 (0 pts), 1→2 (350 pts), 2→3 (900 pts), 3→4 (1800 pts).
        </div>

        <div className="info">
          Power-up: <strong>Escudo</strong> (te perdona 1 golpe). Dinámicas: cactus, pájaros a distintas alturas, nubes con parallax, ciclo de “cielos”.
        </div>

        <div className="canvas-wrap" style={{marginTop:12}}>
          <canvas ref={canvasRef} />
          {hud.gameOver && (
            <div className="overlay">
              <div className="panel">
                <h2>💥 ¡Has perdido!</h2>
                <p>Puntaje: <strong>{hud.score}</strong> · Récord: <strong>{hud.highScore}</strong></p>
                <div className="btns" style={{justifyContent:"center", marginTop:8}}>
                  <button className="primary" onClick={controls.reset}>Jugar de nuevo</button>
                </div>
                <div className="footer">
                  Consejo: pulsa <span className="kbd">Enter</span> para reiniciar rápido.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="info" style={{marginTop:12}}>Selección rápida de niveles (pruebas):</div>
        <div className="level-select">
          {LEVELS.map((L, i) => (
            <button key={L.id} onClick={() => controls.selectLevel(i)}>
              {L.id}. {L.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
