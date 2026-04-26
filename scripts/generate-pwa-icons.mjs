import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'static/brand/logo.svg');
const out = join(root, 'static');

const svg = readFileSync(src);

const targets = [
	{ name: 'icon-192.png', size: 192 },
	{ name: 'icon-512.png', size: 512 },
	{ name: 'apple-touch-icon.png', size: 180 },
	{ name: 'favicon-32.png', size: 32 },
	{ name: 'favicon-16.png', size: 16 }
];

for (const { name, size } of targets) {
	await sharp(svg, { density: Math.max(72, size * 4) })
		.resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.png()
		.toFile(join(out, name));
	console.log(`✓ ${name} (${size}×${size})`);
}

const maskableSize = 512;
const innerSize = Math.round(maskableSize * 0.8);
const padding = (maskableSize - innerSize) / 2;
const innerPng = await sharp(svg, { density: 2048 })
	.resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
	.png()
	.toBuffer();
await sharp({
	create: {
		width: maskableSize,
		height: maskableSize,
		channels: 4,
		background: { r: 10, g: 10, b: 10, alpha: 1 }
	}
})
	.composite([{ input: innerPng, top: padding, left: padding }])
	.png()
	.toFile(join(out, 'icon-512-maskable.png'));
console.log(`✓ icon-512-maskable.png (${maskableSize}×${maskableSize})`);

const fav = readFileSync(join(out, 'favicon-32.png'));
writeFileSync(join(out, 'favicon.ico'), fav);
console.log('✓ favicon.ico (using 32px PNG)');
