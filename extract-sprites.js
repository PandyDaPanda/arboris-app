const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'stage5.html');
const outDir = path.join(__dirname, 'sprites-to-edit');
const buf = fs.readFileSync(htmlPath, 'utf8');

const names = [
  'SPRITE_DIRT',
  'SPRITE_SPROUT',
  'SPRITE_SAPLING',
  'SPRITE_FULL',
  'SPRITE_MAGIC_FULL',
  'SPRITE_MAGIC_DIRT',
  'SPRITE_MAGIC_SPROUT',
  'SPRITE_GRASS_TILE',
  'SPRITE_STUMP',
];

fs.mkdirSync(outDir, { recursive: true });

for (const name of names) {
  const re = new RegExp(
    'const ' + name + ' = "data:image/png;base64,([^"]+)"'
  );
  const m = buf.match(re);
  if (!m) {
    console.error('Missing:', name);
    continue;
  }
  const png = Buffer.from(m[1], 'base64');
  const file = path.join(
    outDir,
    name.replace(/^SPRITE_/, '').toLowerCase() + '.png'
  );
  fs.writeFileSync(file, png);
  console.log('Wrote', path.basename(file), png.length, 'bytes');
}
