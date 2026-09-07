# 🦖 Dino React

Clon del juego del dinosaurio de Chrome, hecho con **React 19 + Vite 7** y renderizado sobre
`<canvas>` 2D. Incluye 4 niveles con progresión automática, sistema de vidas, power-up de
escudo, obstáculos variados (cactus y pájaros), nubes con parallax y récord persistente en
`localStorage`.

Es una aplicación **100 % cliente**: no hay backend, ni llamadas de red, ni cuentas de usuario.

---

## Requisitos

- Node.js 20.19+ o 22.12+ (requisito de Vite 7)
- npm 10+

## Puesta en marcha

```bash
npm install
```

```bash
npm run dev
```

Abre la URL que imprime Vite (por defecto `http://localhost:5173`).

### Otros scripts

| Script            | Qué hace                                     |
|-------------------|----------------------------------------------|
| `npm run dev`     | Servidor de desarrollo con HMR               |
| `npm run build`   | Build de producción en `dist/`               |
| `npm run preview` | Sirve localmente el build de `dist/`         |
| `npm run lint`    | ESLint sobre todo el proyecto                |

---

## Controles

| Tecla / gesto            | Acción                        |
|--------------------------|-------------------------------|
| `Enter`                  | Iniciar / reiniciar y saltar  |
| `Espacio` o `↑`          | Saltar                        |
| `↓` (mantener)           | Agacharse                     |
| `P`                      | Pausa / continuar             |
| `R`                      | Reiniciar                     |
| Toque (móvil)            | Saltar                        |
| Toque mantenido (>180ms) | Agacharse                     |

---

## Mecánicas

- **Puntaje:** 60 puntos por segundo mientras la partida está activa.
- **Vidas:** empiezas con 3. Cada choque sin escudo resta una; a 0 es *Game Over*.
- **Escudo:** power-up circular cian que perdona **un** golpe. Solo puede haber uno en pantalla.
- **Récord:** se guarda en `localStorage` bajo la clave `dino_highscore` y se actualiza en vivo.
- **Hitbox:** al agacharse el dino reduce su altura al 55 % y se recortan 4 px por lado, para
  que pasar por debajo de los pájaros sea justo.

### Niveles y umbrales

La progresión es automática según el puntaje; también hay botones de selección rápida
para pruebas.

| # | Nivel               | Puntos | Velocidad | Prob. pájaro | Prob. power-up |
|---|---------------------|--------|-----------|--------------|----------------|
| 1 | Desierto Amanecer   | 0      | 320 px/s  | 0 %          | 5 %            |
| 2 | Mediodía Ventoso    | 350    | 380 px/s  | 20 %         | 7 %            |
| 3 | Atardecer Rojo      | 900    | 430 px/s  | 35 %         | 8 %            |
| 4 | Noche Estrellada    | 1800   | 500 px/s  | 45 %         | 10 %           |

A partir del nivel 4 se dibujan estrellas de fondo.

---

## Estructura del proyecto

```
dino-react/
├── index.html              # Punto de entrada HTML
├── vite.config.js          # Configuración de Vite (plugin de React)
├── eslint.config.js        # Reglas de ESLint (flat config)
├── public/
│   ├── dino.png            # Sprite del dino, servido desde la raíz (/dino.png)
│   └── icon-carlos.png     # Logo del footer de crédito
└── src/
    ├── main.jsx            # Bootstrap de React (StrictMode)
    ├── App.jsx             # HUD, botones, overlay de Game Over, <canvas>, footer
    ├── styles.css          # Estilos (tema oscuro)
    └── game/
        ├── useGameEngine.js  # Hook con TODO el motor: bucle rAF, física, colisiones, dibujo
        ├── levels.js         # Definición de niveles y umbrales de puntaje
        └── utils.js          # clamp, randRange, AABB, persistencia del récord
```

### Notas de arquitectura

- Todo el estado *por frame* vive en `useRef` para no provocar renders de React 60 veces por
  segundo. El HUD se sincroniza al estado de React solo ~10 veces por segundo
  (`hudUpdateAccumRef`) o al morir.
- El bucle usa `requestAnimationFrame` con `dt` limitado a 32 ms, para que un cambio de pestaña
  no teletransporte al dino a través de un obstáculo.
- El canvas se dimensiona a 900×240 CSS y se escala por `devicePixelRatio` (tope ×2) para
  nitidez en pantallas HiDPI.
- Las colisiones son AABB simples (`aabbIntersect`).

---

## Seguridad

Revisión realizada el **7 de septiembre de 2026**.

### Tokens y secretos

**No hay ninguno, y no debería haberlo.** El proyecto no realiza llamadas de red ni se
autentica contra ningún servicio. Se buscaron patrones de credenciales (`api_key`, `secret`,
`token`, `password`, `Bearer`, claves `sk-`/`ghp_`/`AKIA`, JWT) en todo el código fuente,
`index.html`, CSS y JSON: **sin coincidencias**. Tampoco existen archivos `.env`.

> ⚠️ Recordatorio para el futuro: Vite **inyecta en el bundle** cualquier variable con prefijo
> `VITE_`. Ese bundle es público. Si algún día se añade un backend, la clave va en el servidor,
> nunca en una variable `VITE_*`.

### Superficie de ataque del código

| Vector                                  | Estado                                                    |
|-----------------------------------------|-----------------------------------------------------------|
| `eval` / `new Function`                 | ✅ No se usa                                              |
| `innerHTML` / `dangerouslySetInnerHTML` | ✅ No se usa — todo el texto pasa por el escapado de JSX  |
| `fetch` / `XMLHttpRequest`              | ✅ No se usa — cero tráfico saliente                      |
| Entrada de usuario                      | ✅ Solo teclas y toques; nada se interpola en el DOM      |
| Dependencias en producción              | ✅ Solo `react` y `react-dom`                             |

`localStorage` guarda un único entero (el récord). No contiene datos personales y está bajo el
control total del usuario en su propio navegador, así que manipularlo solo se hace trampa a uno
mismo. Aun así conviene endurecer la lectura, porque un valor no numérico devuelve `NaN` y deja
el récord permanentemente roto:

```js
// src/game/utils.js — lectura defensiva sugerida
export const loadHighScore = () => {
  const n = parseInt(localStorage.getItem("dino_highscore") ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
```

Además, `localStorage` **lanza excepción** en Safari en modo privado y con las cookies
bloqueadas, lo que tumbaría el arranque del juego; envolver lectura y escritura en `try/catch`
lo evita.

### Dependencias

```bash
npm audit --omit=dev
```

→ **0 vulnerabilidades.** Nada de lo que se envía al navegador está afectado.

El audit completo sí reporta **13 avisos (10 altos)**, pero *todos* están en el toolchain de
desarrollo (`vite`, `rollup`, `postcss`, `esbuild`, `picomatch`, `nanoid`, `@babel/core`,
`brace-expansion`, `ajv`…). No llegan al bundle de producción. Aun así conviene actualizarlos,
porque varios afectan al **servidor de desarrollo en Windows**: lectura arbitraria de archivos
vía WebSocket, *bypass* de `server.fs.deny` con rutas alternativas y una fuga de hash NTLMv2 vía
rutas UNC en `launch-editor`.

```bash
npm audit fix
```

Se resuelven todos dentro de los rangos semver actuales, sin `--force` ni cambios de API.

### Recomendaciones operativas

1. **No expongas el servidor de desarrollo.** Sin `--host` Vite solo escucha en `localhost`, que
   es lo correcto. Evita `npm run dev -- --host` en redes que no controles: los avisos de arriba
   son explotables precisamente por ahí.
2. **Añade una CSP** al desplegar. Para esta app basta una muy estricta, ya que no carga nada
   externo:
   ```html
   <meta http-equiv="Content-Security-Policy"
         content="default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'">
   ```
3. **Sirve el build con HTTPS** y cabeceras `X-Content-Type-Options: nosniff` y
   `Referrer-Policy: no-referrer`.
4. **El proyecto no está bajo control de versiones.** Un `git init` antes de seguir evita perder
   trabajo; el `.gitignore` ya está listo y excluye `node_modules`, `dist`, `*.log` y `*.local`.

---

## Errores conocidos

- `index.html` referencia el favicon como `href="public/dino.png"`. En Vite la carpeta `public/`
  se sirve desde la raíz, así que la ruta correcta es `/dino.png`; tal cual está, el icono falla
  en el build de producción.
- Los `keydown` globales llaman a `preventDefault()` sobre `Espacio` y `Enter` en toda la
  ventana, lo que bloquearía esas teclas si en el futuro se añaden campos de formulario.

---

## Licencia

Proyecto personal sin licencia declarada. Todos los derechos reservados por el autor.
