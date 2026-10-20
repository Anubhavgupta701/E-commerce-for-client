// Generates tasteful editorial placeholder artwork in the Khaas brown/white palette.
// Replace these with real product photography before launch.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '..', 'client', 'public', 'img');
fs.mkdirSync(out, { recursive: true });

const products = [
  ['linen-shirt', 'Linen Shirt', '#E9DCCB', '#A87952'],
  ['kurta', 'Handloom Kurta', '#F3E9DA', '#6B422D'],
  ['denim', 'Raw Denim', '#E4D6C2', '#3B2418'],
  ['sweater', 'Merino Sweater', '#EFE3D0', '#A87952'],
  ['dinner-set', 'Stoneware Set', '#FAF7F2', '#6B422D'],
  ['lamp', 'Brass Lamp', '#EAD9BE', '#9A5B12'],
  ['throw', 'Woven Throw', '#EFE0CB', '#6B422D'],
  ['pour-over', 'Pour-Over Set', '#F5EEE1', '#3B2418'],
  ['wallet', 'Leather Wallet', '#E7D3B8', '#3B2418'],
  ['weekender', 'Weekender Bag', '#EAD9C0', '#6B422D'],
  ['scarf', 'Silk Scarf', '#F1E4CE', '#A87952'],
  ['carafe', 'Copper Carafe', '#EDDCC4', '#9A5B12'],
];

for (const [slug, label, bg, accent] of products) {
  const rot = (slug.length * 37) % 24 - 12;
  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
  <rect width="800" height="1000" fill="${bg}"/>
  <g transform="rotate(${rot} 400 480)">
    <ellipse cx="400" cy="430" rx="230" ry="300" fill="${accent}" opacity="0.16"/>
    <ellipse cx="400" cy="430" rx="160" ry="220" fill="none" stroke="${accent}" stroke-width="3" opacity="0.55"/>
    <ellipse cx="400" cy="430" rx="105" ry="150" fill="${accent}" opacity="0.22"/>
    <line x1="400" y1="180" x2="400" y2="680" stroke="${accent}" stroke-width="2" opacity="0.4"/>
    <line x1="240" y1="430" x2="560" y2="430" stroke="${accent}" stroke-width="2" opacity="0.4"/>
  </g>
  <circle cx="400" cy="430" r="10" fill="#3B2418" opacity="0.8"/>
  <text x="400" y="830" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="44" fill="#3B2418">${label}</text>
  <text x="400" y="880" text-anchor="middle" font-family="Georgia, serif" font-size="22" letter-spacing="6" fill="#6B422D">KHAAS</text>
  <rect x="360" y="905" width="80" height="2" fill="#A87952"/>
</svg>`;
  fs.writeFileSync(path.join(out, `${slug}.svg`), svg);
}
console.log(`wrote ${products.length} placeholders to ${out}`);
