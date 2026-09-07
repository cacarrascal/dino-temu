import { useEffect, useRef, useState, useCallback } from "react";
import { LEVELS, LEVEL_THRESHOLDS } from "./levels";
import { aabbIntersect, clamp, randRange, loadHighScore, saveHighScore } from "./utils";

export function useGameEngine(canvasRef) {
  // -------- HUD (estado visible) --------
  const [hud, setHud] = useState({
    levelIndex: 0,
    levelName: LEVELS[0].name,
    score: 0,
    highScore: loadHighScore(),
    speed: LEVELS[0].speed,
    paused: true,
    gameOver: false,
    shield: false,
    lives: 3,
  });

  // -------- Internos --------
  const rafRef = useRef(null);
  const startedRef = useRef(false);
  const pausedRef = useRef(true);
  const gameOverRef = useRef(false);
  const wRef = useRef(900);
  const hRef = useRef(240);

  const levelIndexRef = useRef(0);
  const scoreRef = useRef(0);
  const scoreFloatRef = useRef(0);
  const hudUpdateAccumRef = useRef(0);
  const highRef = useRef(hud.highScore);
  const shieldRef = useRef(false);
  const livesRef = useRef(3);

  // Tamaño/posición del dino (más pequeño)
  const dinoRef = useRef({
    x: 60, y: 0, w: 44, h: 48,
    vy: 0, onGround: true, duck: false, jumpBoost: 580
  });

  const groundYRef = useRef(LEVELS[0].groundY);
  const gravityRef = useRef(1600);

  const obstaclesRef = useRef([]); // {x,y,w,h,type:"cactus"|"bird"}
  const cloudsRef = useRef([]);    // {x,y,w,h,speed}
  const powerupsRef = useRef([]);  // {x,y,w,h,type:"shield"}

  const lastSpawnRef = useRef(0);
  const nextSpawnRef = useRef(1000);
  const timeRef = useRef(0);

  // -------- Sprite del dino (PNG) --------
  const dinoImgRef = useRef(null);
  const dinoLoadedRef = useRef(false);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cssWidth = 900, cssHeight = 240;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [canvasRef]);

  // Precarga PNG
  useEffect(() => {
    const img = new Image();
    img.src = "/dino.png"; // coloca tu imagen en /public/dino.png
    img.onload = () => { dinoImgRef.current = img; dinoLoadedRef.current = true; };
  }, []);

  // Entradas
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.repeat) return;

      if (e.code === "Enter") {
        e.preventDefault();
        if (gameOverRef.current) {
          reset();
          startedRef.current = true;
          pausedRef.current = false;
          setHud(h => ({ ...h, paused: false, gameOver: false, score: 0 }));
          return;
        }
        startedRef.current = true;
        pausedRef.current = false;
        dinoJump();
      } else if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (gameOverRef.current) return;
        startedRef.current = true;
        pausedRef.current = false;
        dinoJump();
      } else if (e.code === "ArrowDown") {
        dinoRef.current.duck = true;
      } else if (e.code === "KeyP") {
        togglePause();
      } else if (e.code === "KeyR") {
        reset();
      }
    };
    const onKeyUp = (e) => { if (e.code === "ArrowDown") dinoRef.current.duck = false; };

    let touchHeld = false; let holdTimeout = null;
    const onTouchStart = () => {
      if (gameOverRef.current) return;
      startedRef.current = true; pausedRef.current = false;
      touchHeld = true;
      holdTimeout = setTimeout(() => { if (touchHeld) dinoRef.current.duck = true; }, 180);
      dinoJump();
    };
    const onTouchEnd = () => { touchHeld = false; dinoRef.current.duck = false; if (holdTimeout) clearTimeout(holdTimeout); };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Niveles
  const applyLevel = useCallback((idx) => {
    levelIndexRef.current = idx;
    const L = LEVELS[idx];
    groundYRef.current = L.groundY;
    setHud((h) => ({ ...h, levelIndex: idx, levelName: L.name, speed: L.speed }));
  }, []);
  const updateAutoLevel = useCallback((score) => {
    let target = 0;
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) if (score >= LEVEL_THRESHOLDS[i]) target = i;
    target = clamp(target, 0, LEVELS.length - 1);
    if (target !== levelIndexRef.current) applyLevel(target);
  }, [applyLevel]);

  // Player
  const dinoJump = () => {
    const dino = dinoRef.current;
    if (dino.onGround) { dino.vy = -dino.jumpBoost; dino.onGround = false; }
  };

  // Spawners
  function spawnClouds() {
    if (Math.random() < 0.02) {
      cloudsRef.current.push({
        x: wRef.current + randRange(0, 60),
        y: randRange(20, 100),
        w: randRange(60, 120),
        h: randRange(16, 28),
        speed: randRange(20, 60),
      });
    }
  }
  function spawnObstaclesAndPowerups() {
    const L = LEVELS[levelIndexRef.current];
    if (timeRef.current - lastSpawnRef.current > nextSpawnRef.current) {
      lastSpawnRef.current = timeRef.current;
      nextSpawnRef.current = randRange(L.spawnEveryMs[0], L.spawnEveryMs[1]);
      // pájaros más altos para que el duck funcione mejor
      if (Math.random() < L.birdChance) {
        const heights = [L.groundY - 110, L.groundY - 140, L.groundY - 170];
        obstaclesRef.current.push({ type: "bird", x: wRef.current + 20, y: heights[Math.floor(Math.random()*heights.length)], w: 44, h: 28 });
      } else {
        const tall = Math.random() < 0.4;
        obstaclesRef.current.push({ type: "cactus", x: wRef.current + 12, y: L.groundY - (tall ? 46 : 32), w: tall ? 26 : 18, h: tall ? 46 : 32 });
      }
      if (Math.random() < L.powerupChance && powerupsRef.current.length < 1) {
        powerupsRef.current.push({ type: "shield", x: wRef.current + 200, y: L.groundY - 110, w: 22, h: 22 });
      }
    }
  }

  // ---- hitbox del dino (más pequeño al agacharse) ----
  const getDinoHitbox = (dino) => {
    const DUCK_SCALE = 0.55; // 55% de alto al agacharse
    const inset = 4;         // recorte lateral superior para ser justos
    if (dino.duck && dino.onGround) {
      const h = dino.h * DUCK_SCALE;
      const y = groundYRef.current - h; // apoyar en el suelo
      return { x: dino.x + inset, y: y + 2, w: dino.w - inset*2, h: h - 4 };
    }
    return { x: dino.x + inset, y: dino.y + 2, w: dino.w - inset*2, h: dino.h - 4 };
  };

  // Loop
  const loop = useCallback((tNow) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (rafRef.current == null) timeRef.current = 0;
    const last = timeRef.current || tNow;
    const dt = Math.min(0.032, (tNow - last) / 1000);
    timeRef.current = tNow;

    const L = LEVELS[levelIndexRef.current];
    const speed = L.speed;

    // Fondo
    ctx.fillStyle = L.bgTint; ctx.fillRect(0, 0, wRef.current, hRef.current);

    // Estrellas
    if (levelIndexRef.current >= 3) {
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 40; i++) {
        const x = (i * 23.7 + (tNow * 0.01)) % wRef.current;
        const y = (i * 11.3) % 120;
        ctx.fillStyle = "white"; ctx.fillRect(x, y, 1, 1);
      }
      ctx.globalAlpha = 1;
    }

    // Suelo
    ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, L.groundY + 1); ctx.lineTo(wRef.current, L.groundY + 1); ctx.stroke();

    // Parallax
    spawnClouds();
    cloudsRef.current.forEach(cl => { cl.x -= cl.speed * dt; ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(cl.x, cl.y, cl.w, cl.h); });
    cloudsRef.current = cloudsRef.current.filter(c => c.x + c.w > -10);

    // Spawns
    if (!pausedRef.current && !gameOverRef.current && startedRef.current) spawnObstaclesAndPowerups();

    // Obstáculos
    obstaclesRef.current.forEach(ob => {
      ob.x -= speed * dt;
      if (ob.type === "cactus") { ctx.fillStyle = "#16a34a"; ctx.fillRect(ob.x, ob.y, ob.w, ob.h); }
      else { ctx.fillStyle = "#60a5fa"; ctx.fillRect(ob.x, ob.y, ob.w, ob.h); ctx.fillStyle = "#f59e0b"; ctx.fillRect(ob.x + ob.w - 6, ob.y + 10, 6, 4); }
    });
    obstaclesRef.current = obstaclesRef.current.filter(o => o.x + o.w > -20);

    // Power-ups
    powerupsRef.current.forEach(p => {
      p.x -= (speed * 0.9) * dt;
      ctx.beginPath(); ctx.fillStyle = "#22d3ee"; ctx.arc(p.x + p.w/2, p.y + p.h/2, p.w/2, 0, Math.PI*2); ctx.fill();
    });
    powerupsRef.current = powerupsRef.current.filter(p => p.x + p.w > -20);

    // Dino: física
    const dino = dinoRef.current;
    const ducking = dino.duck && dino.onGround;
    const targetH = ducking ? 28 : 48; // agachado MUCHO más bajo
    dino.h += (targetH - dino.h) * Math.min(1, dt * 16);
    if (!pausedRef.current && !gameOverRef.current && startedRef.current) {
      dino.vy += gravityRef.current * dt; dino.y += dino.vy * dt;
      if (dino.y + dino.h >= L.groundY) { dino.y = L.groundY - dino.h; dino.vy = 0; dino.onGround = true; } else { dino.onGround = false; }
    }

    // Dibujo del dino
    if (dinoLoadedRef.current && dinoImgRef.current) {
      ctx.drawImage(dinoImgRef.current, dino.x, dino.y, dino.w, dino.h);
    } else {
      ctx.fillStyle = shieldRef.current ? "#22c55e" : "#e5e7eb";
      ctx.fillRect(dino.x, dino.y, dino.w, dino.h);
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(dino.x + dino.w - 10, dino.y + 8, 3, 3);
    }

    // Colisiones (usa hitbox reducido al agacharse)
    if (!pausedRef.current && !gameOverRef.current && startedRef.current) {
      const dinoBox = getDinoHitbox(dino);

      // power-ups
      for (let i = powerupsRef.current.length - 1; i >= 0; i--) {
        const p = powerupsRef.current[i];
        const pBox = { x: p.x, y: p.y, w: p.w, h: p.h };
        if (aabbIntersect(dinoBox, pBox)) { shieldRef.current = true; powerupsRef.current.splice(i,1); }
      }
      // obstáculos
      for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
        const ob = obstaclesRef.current[i];
        const obBox = { x: ob.x, y: ob.y, w: ob.w, h: ob.h };
        if (aabbIntersect(dinoBox, obBox)) {
          if (shieldRef.current) {
            shieldRef.current = false;
            obstaclesRef.current.splice(i,1);
          } else {
            livesRef.current -= 1;
            obstaclesRef.current.splice(i,1);
            if (livesRef.current <= 0) {
              gameOverRef.current = true;
              pausedRef.current = true;
              saveHighScore(scoreRef.current);
            }
          }
        }
      }
    }

    // Puntaje + high score en vivo
    if (!pausedRef.current && !gameOverRef.current && startedRef.current) {
      scoreFloatRef.current += 60 * dt; // 60 pts/seg
      const intScore = Math.floor(scoreFloatRef.current);
      if (intScore !== scoreRef.current) {
        scoreRef.current = intScore;
        if (scoreRef.current > highRef.current) { highRef.current = scoreRef.current; saveHighScore(highRef.current); }
        updateAutoLevel(scoreRef.current);
      }
    }

    // HUD sync (≈10 FPS o en game over)
    hudUpdateAccumRef.current += dt;
    if (hudUpdateAccumRef.current >= 0.1 || gameOverRef.current) {
      hudUpdateAccumRef.current = 0;
      setHud((h) => ({
        ...h,
        score: scoreRef.current,
        highScore: highRef.current,
        levelIndex: levelIndexRef.current,
        levelName: LEVELS[levelIndexRef.current].name,
        speed: LEVELS[levelIndexRef.current].speed,
        paused: pausedRef.current,
        gameOver: gameOverRef.current,
        shield: shieldRef.current,
        lives: livesRef.current,
      }));
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [canvasRef, updateAutoLevel]);

  // Controles públicos
  const start = useCallback(() => {
    if (!canvasRef.current) return;
    if (!rafRef.current) { setupCanvas(); rafRef.current = requestAnimationFrame(loop); }
    pausedRef.current = false; startedRef.current = true;
    setHud(h => ({ ...h, paused: false }));
  }, [canvasRef, loop, setupCanvas]);

  const pause = useCallback(() => { pausedRef.current = true; setHud(h => ({ ...h, paused: true })); }, []);
  const togglePause = useCallback(() => { pausedRef.current = !pausedRef.current; setHud(h => ({ ...h, paused: pausedRef.current })); }, []);

  const reset = useCallback(() => {
    scoreRef.current = 0;
    scoreFloatRef.current = 0;
    hudUpdateAccumRef.current = 0;
    shieldRef.current = false;
    livesRef.current = 3;
    obstaclesRef.current = [];
    powerupsRef.current = [];
    cloudsRef.current = [];
    lastSpawnRef.current = 0;
    nextSpawnRef.current = 1000;
    timeRef.current = 0;
    gameOverRef.current = false;
    startedRef.current = false;
    pausedRef.current = true;

    const idx = 0; applyLevel(idx);
    const L = LEVELS[idx];
    dinoRef.current = { x: 60, y: L.groundY - 48, w: 44, h: 48, vy: 0, onGround: true, duck: false, jumpBoost: 580 };

    setHud(h => ({
      ...h,
      score: 0,
      speed: L.speed,
      levelIndex: idx,
      levelName: L.name,
      paused: true,
      gameOver: false,
      shield: false,
      highScore: loadHighScore(),
      lives: 3,
    }));
  }, [applyLevel]);

  const selectLevel = useCallback((idx) => {
    applyLevel(idx);
    const L = LEVELS[idx];
    dinoRef.current.y = L.groundY - dinoRef.current.h;
    setHud(h => ({ ...h, levelIndex: idx, levelName: L.name, speed: L.speed }));
  }, [applyLevel]);

  // init/cleanup
  useEffect(() => {
    setupCanvas();
    rafRef.current = requestAnimationFrame(loop);
    const L = LEVELS[0]; dinoRef.current.y = L.groundY - dinoRef.current.h;
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
  }, [loop, setupCanvas]);

  return { hud, controls: { start, pause, togglePause, reset, selectLevel } };
}
