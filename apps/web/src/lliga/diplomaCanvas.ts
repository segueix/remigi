import type { DiplomaContent } from './champion';

/**
 * El diploma de «Millor jugador del món», dibuixat en un llenç (un full A4
 * apaïsat a 150 ppp) perquè es pugui descarregar com a PNG o enviar per
 * WhatsApp com a imatge. Tot és vectorial (res d'imatges externes ni de
 * tipus de lletra descarregats): funciona sense connexió i surt igual a tots
 * els dispositius.
 */

export const DIPLOMA_WIDTH = 1754;
export const DIPLOMA_HEIGHT = 1240;

const SERIF = 'Georgia, "Times New Roman", "DejaVu Serif", serif';
const NAVY = '#1e2a4a';
const GOLD = '#b8860b';
const GOLD_LIGHT = '#f2d27a';
const RED = '#a61b1b';
/** Els colors de les fitxes del joc, com a la franja de l'app. */
const TILE_COLORS = ['#cc0000', '#1d4ed8', '#1c1917', '#ea580c'];

/** Text amb separació entre lletres (`letterSpacing` del llenç no és a tot arreu). */
function spacedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number): void {
  const chars = [...text];
  const widths = chars.map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, w) => sum + w, 0) + spacing * (chars.length - 1);
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  chars.forEach((char, i) => {
    ctx.fillText(char, cursor, y);
    cursor += widths[i] + spacing;
  });
  ctx.textAlign = align;
}

/** Fa servir la mida més gran (fins a `size`) amb què el text cap a `maxWidth`. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, style: string): number {
  let current = size;
  ctx.font = `${style} ${current}px ${SERIF}`;
  while (current > 24 && ctx.measureText(text).width > maxWidth) {
    current -= 2;
    ctx.font = `${style} ${current}px ${SERIF}`;
  }
  return current;
}

/** Rectangle de cantons arrodonits (`roundRect` no és als navegadors antics). */
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number, points = 5): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function goldFill(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, '#8a6508');
  gradient.addColorStop(0.35, GOLD_LIGHT);
  gradient.addColorStop(0.55, '#d4a017');
  gradient.addColorStop(1, '#8a6508');
  return gradient;
}

/** El marc: tres línies (blau, or, blau fi) i uns floronets a les quatre cantonades. */
function drawFrame(ctx: CanvasRenderingContext2D): void {
  const w = DIPLOMA_WIDTH;
  const h = DIPLOMA_HEIGHT;
  ctx.lineJoin = 'round';

  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 16;
  ctx.strokeRect(40, 40, w - 80, h - 80);

  ctx.strokeStyle = goldFill(ctx, 0, 0, w, h);
  ctx.lineWidth = 8;
  ctx.strokeRect(68, 68, w - 136, h - 136);

  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 2;
  ctx.strokeRect(86, 86, w - 172, h - 172);

  // Floronets de les cantonades: un rombe d'or amb un cercle al mig.
  const corners: [number, number][] = [
    [68, 68],
    [w - 68, 68],
    [68, h - 68],
    [w - 68, h - 68],
  ];
  for (const [cx, cy] of corners) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = goldFill(ctx, -34, -34, 34, 34);
    ctx.fillRect(-30, -30, 60, 60);
    ctx.strokeStyle = NAVY;
    ctx.lineWidth = 3;
    ctx.strokeRect(-30, -30, 60, 60);
    ctx.restore();
    ctx.fillStyle = NAVY;
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** «REMIGI» amb fitxes de colors: la firma de la casa. */
function drawTiles(ctx: CanvasRenderingContext2D, cx: number, y: number): void {
  const letters = [...'REMIGI'];
  const size = 84;
  const gap = 14;
  const total = letters.length * size + (letters.length - 1) * gap;
  letters.forEach((letter, i) => {
    const x = cx - total / 2 + i * (size + gap);
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.rotate(((i % 2 === 0 ? -1 : 1) * 3 * Math.PI) / 180);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#fffbeb';
    roundedRect(ctx, -size / 2, -size / 2, size, size, 12);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#d6cdb2';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = TILE_COLORS[i % TILE_COLORS.length];
    ctx.font = `bold 58px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 0, 4);
    ctx.restore();
  });
  ctx.textBaseline = 'alphabetic';
}

/** Línia decorativa amb una estrella al mig. */
function drawDivider(ctx: CanvasRenderingContext2D, cx: number, y: number, half: number): void {
  ctx.strokeStyle = goldFill(ctx, cx - half, y, cx + half, y);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - half, y);
  ctx.lineTo(cx - 34, y);
  ctx.moveTo(cx + 34, y);
  ctx.lineTo(cx + half, y);
  ctx.stroke();
  ctx.fillStyle = goldFill(ctx, cx - 20, y - 20, cx + 20, y + 20);
  starPath(ctx, cx, y, 20, 8);
  ctx.fill();
}

/** El segell de cera daurat, amb cintes i una estrella. */
function drawSeal(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  // Cintes
  ctx.fillStyle = RED;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + dir * 12, cy + 30);
    ctx.lineTo(cx + dir * 66, cy + 118);
    ctx.lineTo(cx + dir * 42, cy + 106);
    ctx.lineTo(cx + dir * 22, cy + 128);
    ctx.lineTo(cx + dir * -4, cy + 40);
    ctx.closePath();
    ctx.fill();
  }
  // Roseta d'arcs
  const scallops = 28;
  ctx.fillStyle = goldFill(ctx, cx - 100, cy - 100, cx + 100, cy + 100);
  ctx.beginPath();
  for (let i = 0; i < scallops; i++) {
    const a = (Math.PI * 2 * i) / scallops;
    const x = cx + Math.cos(a) * 92;
    const y = cy + Math.sin(a) * 92;
    ctx.moveTo(x + 14, y);
    ctx.arc(x, y, 14, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a6508';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff6d6';
  starPath(ctx, cx, cy + 2, 48, 20);
  ctx.fill();
  ctx.strokeStyle = '#8a6508';
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** Dibuixa el diploma sencer al llenç (que ha de fer `DIPLOMA_WIDTH × DIPLOMA_HEIGHT`). */
export function drawDiploma(ctx: CanvasRenderingContext2D, content: DiplomaContent): void {
  const w = DIPLOMA_WIDTH;
  const h = DIPLOMA_HEIGHT;
  const cx = w / 2;

  // Paper: pergamí amb la vora una mica més fosca.
  const paper = ctx.createRadialGradient(cx, h / 2, 200, cx, h / 2, w * 0.62);
  paper.addColorStop(0, '#fffaf0');
  paper.addColorStop(0.7, '#f7e9c4');
  paper.addColorStop(1, '#e8cf94');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, w, h);

  // Estrelles tènues de fons.
  ctx.fillStyle = 'rgba(184, 134, 11, 0.1)';
  for (let i = 0; i < 26; i++) {
    const x = 160 + ((i * 337) % (w - 320));
    const y = 170 + ((i * 211) % (h - 340));
    starPath(ctx, x, y, 14 + (i % 4) * 6, 6 + (i % 4) * 2);
    ctx.fill();
  }

  drawFrame(ctx);
  drawTiles(ctx, cx, 124);

  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = `bold 30px ${SERIF}`;
  spacedText(ctx, 'DIPLOMA D’HONOR', cx, 285, 12);

  // El títol, amb una ombra d'or perquè faci relleu.
  ctx.fillStyle = NAVY;
  fitFont(ctx, content.title, w - 340, 112, 'bold');
  ctx.shadowColor = 'rgba(184, 134, 11, 0.55)';
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 4;
  ctx.fillText(content.title, cx, 400);
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  drawDivider(ctx, cx, 450, 330);

  ctx.fillStyle = '#4a3f2a';
  ctx.font = `italic 36px ${SERIF}`;
  ctx.fillText('Es concedeix a', cx, 530);

  // El nom, tan gran com càpiga.
  ctx.fillStyle = RED;
  fitFont(ctx, content.playerName, w - 420, 128, 'italic bold');
  ctx.fillText(content.playerName, cx, 650);
  ctx.strokeStyle = goldFill(ctx, 300, 680, w - 300, 680);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(300, 684);
  ctx.lineTo(w - 300, 684);
  ctx.stroke();

  ctx.fillStyle = '#4a3f2a';
  ctx.font = `italic 36px ${SERIF}`;
  ctx.fillText(content.honor, cx, 752);

  ctx.fillStyle = NAVY;
  fitFont(ctx, content.leagueName, w - 420, 64, 'bold');
  ctx.fillText(content.leagueName, cx, 832);

  ctx.fillStyle = '#4a3f2a';
  ctx.font = `34px ${SERIF}`;
  ctx.fillText(content.stats, cx, 900);

  // Peu: data a l'esquerra, segell al mig i la signatura de la casa a la dreta.
  drawSeal(ctx, cx, 1010);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#4a3f2a';
  ctx.font = `30px ${SERIF}`;
  ctx.fillText(content.dateText, 400, 1060);
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(220, 1020);
  ctx.lineTo(580, 1020);
  ctx.moveTo(w - 580, 1020);
  ctx.lineTo(w - 220, 1020);
  ctx.stroke();
  ctx.font = `italic bold 44px ${SERIF}`;
  ctx.fillStyle = NAVY;
  ctx.fillText('Remigi', w - 400, 1004);
  ctx.font = `30px ${SERIF}`;
  ctx.fillStyle = '#4a3f2a';
  ctx.fillText('La Lliga Mundial', w - 400, 1060);

  // El número de sèrie, a la cantonada de baix a l'esquerra.
  ctx.fillStyle = 'rgba(30, 42, 74, 0.6)';
  ctx.font = `22px ${SERIF}`;
  ctx.textAlign = 'left';
  ctx.fillText(`Diploma núm. ${content.serial}`, 130, h - 118);
}

/** Crea el llenç del diploma (al navegador). */
export function diplomaCanvas(content: DiplomaContent): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = DIPLOMA_WIDTH;
  canvas.height = DIPLOMA_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no pot dibuixar el diploma.');
  drawDiploma(ctx, content);
  return canvas;
}

/** El diploma com a imatge PNG, a punt per descarregar o compartir. */
export function diplomaBlob(content: DiplomaContent): Promise<Blob> {
  const canvas = diplomaCanvas(content);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No s’ha pogut crear la imatge del diploma.'))), 'image/png');
  });
}
