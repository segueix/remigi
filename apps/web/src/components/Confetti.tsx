import { useEffect, useRef } from 'react';

/** Els colors de les fitxes del joc, més or i blanc. */
const COLORS = ['#cc0000', '#1d4ed8', '#e8b400', '#7c3aed', '#ea580c', '#16a34a', '#fde047', '#ffffff'];

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  spin: number;
  /** Balanceig lateral, com un paper de debò. */
  wobble: number;
  wobbleSpeed: number;
  shape: 'rect' | 'circle' | 'star';
  /** Segons de vida que li queden. */
  life: number;
}

/**
 * Un esclat de confeti des d'un punt: surt amunt en ventall i després cau.
 * Pur (l'atzar és injectat) perquè es pugui provar sense navegador.
 */
export function burst(
  random: () => number,
  x: number,
  y: number,
  count: number,
  spread = Math.PI * 0.8,
  angle = -Math.PI / 2,
  power = 1,
): Particle[] {
  return Array.from({ length: count }, () => {
    const direction = angle + (random() - 0.5) * spread;
    const speed = (6 + random() * 12) * power;
    const shape = random();
    return {
      x,
      y,
      vx: Math.cos(direction) * speed,
      vy: Math.sin(direction) * speed,
      size: 6 + random() * 8,
      color: COLORS[Math.floor(random() * COLORS.length)],
      rotation: random() * Math.PI * 2,
      spin: (random() - 0.5) * 0.4,
      wobble: random() * Math.PI * 2,
      wobbleSpeed: 0.05 + random() * 0.12,
      shape: shape < 0.6 ? 'rect' : shape < 0.85 ? 'circle' : 'star',
      life: 3.5 + random() * 3,
    };
  });
}

/** Pluja suau de confeti des de dalt, escampada per tot l'ample. */
export function rain(random: () => number, width: number, count: number): Particle[] {
  return Array.from({ length: count }, () => {
    const [p] = burst(random, random() * width, -20 - random() * 80, 1, Math.PI * 0.3, Math.PI / 2, 0.25);
    return { ...p, life: 6 + random() * 3 };
  });
}

/** Un pas de la simulació (gravetat, fregament de l'aire i balanceig). */
export function step(particle: Particle, dt: number): void {
  // Les velocitats són en píxels per fotograma a 60 fps; `f` és quants
  // fotogrames de 60 fps són `dt` segons.
  const f = dt * 60;
  particle.vy += 0.32 * f;
  const drag = Math.pow(0.965, f);
  particle.vx *= drag;
  particle.vy *= drag;
  particle.wobble += particle.wobbleSpeed * f;
  particle.x += (particle.vx + Math.sin(particle.wobble) * 0.8) * f;
  particle.y += particle.vy * f;
  particle.rotation += particle.spin * f;
  particle.life -= dt;
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
  ctx.fillStyle = p.color;
  if (p.shape === 'rect') {
    // El gir en 3D del paper: s'aplana i es torna a obrir.
    ctx.scale(1, Math.cos(p.wobble));
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
  } else if (p.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? p.size / 1.6 : p.size / 3.6;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** El jugador demana menys moviment: sense confeti (la resta de la celebració es queda). */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Confeti a pantalla completa: canons a banda i banda, una segona descàrrega i
 * una pluja que dura uns segons. No agafa els tocs (`pointer-events: none`) i
 * s'atura sol quan s'acaba, o abans si l'app queda amagada.
 */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || prefersReducedMotion()) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const random = Math.random;
    let particles: Particle[] = [];
    const fire = (side: 'left' | 'right' | 'both', count: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (side !== 'right') particles.push(...burst(random, 0, h * 0.85, count, Math.PI * 0.5, -Math.PI * 0.32, 1.2));
      if (side !== 'left') particles.push(...burst(random, w, h * 0.85, count, Math.PI * 0.5, -Math.PI * 0.68, 1.2));
    };

    fire('both', 90);
    const timers = [
      window.setTimeout(() => fire('both', 70), 600),
      window.setTimeout(() => {
        particles.push(...burst(random, window.innerWidth / 2, window.innerHeight * 0.4, 120, Math.PI * 2, -Math.PI / 2, 0.9));
      }, 1300),
      window.setTimeout(() => fire('both', 60), 2200),
    ];
    // Pluja: quatre tongades al llarg de quatre segons.
    for (let i = 0; i < 8; i++) {
      timers.push(window.setTimeout(() => particles.push(...rain(random, window.innerWidth, 28)), 800 + i * 500));
    }

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of particles) {
        step(p, dt);
        drawParticle(ctx, p);
      }
      particles = particles.filter((p) => p.life > 0 && p.y < window.innerHeight + 40);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="confeti" aria-hidden="true" />;
}
