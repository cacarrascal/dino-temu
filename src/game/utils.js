export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const randRange = (min, max) => Math.random() * (max - min) + min;

export function aabbIntersect(a, b) {
  return (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
}

export const loadHighScore = () => {
  const v = localStorage.getItem("dino_highscore");
  return v ? parseInt(v, 10) : 0;
};
export const saveHighScore = (score) => {
  const hs = loadHighScore();
  if (score > hs) localStorage.setItem("dino_highscore", String(score));
};
