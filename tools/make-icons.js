// Draws the home-screen icons (a form with a tick on the app's red). Usage: node tools/make-icons.js
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });

function draw(size, { maskable }) {
  const c = createCanvas(size, size); const g = c.getContext('2d'); const s = size / 512;
  // Background: full square for maskable (the phone crops it), rounded square otherwise.
  g.fillStyle = '#b4121b';
  if (maskable) g.fillRect(0, 0, size, size);
  else { g.beginPath(); g.roundRect(0, 0, size, size, 112 * s); g.fill(); }
  // Keep the drawing inside the safe zone (centre 80%) so round masks don't cut it.
  const k = maskable ? 0.78 : 1; g.translate(size / 2, size / 2); g.scale(k, k); g.translate(-size / 2, -size / 2);
  // Paper
  g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(136 * s, 92 * s, 240 * s, 312 * s, 22 * s); g.fill();
  // Lines on the paper
  g.fillStyle = '#d9dde3';
  [150, 196, 242].forEach((y) => { g.beginPath(); g.roundRect(172 * s, y * s, 168 * s, 18 * s, 9 * s); g.fill(); });
  g.beginPath(); g.roundRect(172 * s, 288 * s, 96 * s, 18 * s, 9 * s); g.fill();
  // Tick badge
  g.fillStyle = '#1f9d55'; g.beginPath(); g.arc(352 * s, 368 * s, 74 * s, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 22 * s; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(318 * s, 370 * s); g.lineTo(343 * s, 395 * s); g.lineTo(390 * s, 343 * s); g.stroke();
  return c.toBuffer('image/png');
}

const files = [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true], ['favicon-32.png', 32, false]];
for (const [name, size, maskable] of files) fs.writeFileSync(path.join(out, name), draw(size, { maskable }));
console.log('Icons written to icons/:', files.map((f) => f[0]).join(', '));
