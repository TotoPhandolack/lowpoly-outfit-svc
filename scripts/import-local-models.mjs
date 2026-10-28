import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serviceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendPublic = path.resolve(serviceRoot, '../lowpoly-outfit/public');
const modelRoot = path.join(frontendPublic, 'models');
const imageRoot = path.join(frontendPublic, 'images');
const apiBase = (process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');
const token = process.env.API_ADMIN_TOKEN;

const folders = {
  hats: 'hat',
  shirts: 'shirt',
  pants: 'pant',
  skirts: 'pant',
  shoes: 'shoes',
  necklace: 'necklace',
};

const thumbnailOverrides = {
  'models/hats/hat.glb': 'images/hats/tophat_render.jpg',
  'models/hats/sunday_hat.glb': 'images/hats/sunday_hat_render.jpg',
  'models/skirts/skirt_polkadot.glb': 'images/skirts/polkadot_skirt_render.jpg',
};

if (!token) {
  console.error('Set API_ADMIN_TOKEN in the environment before running this import.');
  process.exit(1);
}

function displayName(filename) {
  return filename
    .replace(/\.glb$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const existingResponse = await fetch(`${apiBase}/models`);
if (!existingResponse.ok) {
  throw new Error(`Could not read the current catalog (${existingResponse.status}).`);
}
const existingPayload = await existingResponse.json();
const existing = new Set(
  (existingPayload.data ?? []).map(
    (model) => `${model.category}:${model.name.trim().toLowerCase()}`,
  ),
);

let uploaded = 0;
let skipped = 0;
let failed = 0;

for (const [folder, category] of Object.entries(folders)) {
  const categoryPath = path.join(modelRoot, folder);
  if (!fs.existsSync(categoryPath)) continue;

  const modelFiles = fs
    .readdirSync(categoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.glb'))
    .map((entry) => path.join(categoryPath, entry.name))
    .sort();

  for (const modelPath of modelFiles) {
    const filename = path.basename(modelPath);
    const name = displayName(filename);
    const key = `${category}:${name.toLowerCase()}`;
    if (existing.has(key)) {
      skipped += 1;
      continue;
    }

    const relativeModelPath = path.relative(frontendPublic, modelPath).split(path.sep).join('/');
    const baseName = filename.replace(/\.glb$/i, '');
    const expectedThumbnail = thumbnailOverrides[relativeModelPath] ??
      ['.png', '.jpg', '.jpeg', '.webp']
        .map((extension) => `images/${baseName}${extension}`)
        .find((imagePath) => fs.existsSync(path.join(frontendPublic, imagePath))) ??
      null;
    const form = new FormData();
    const modelBuffer = fs.readFileSync(modelPath);
    form.set('model', new Blob([modelBuffer], { type: 'model/gltf-binary' }), filename);
    form.set('name', name);
    form.set('category', category);

    if (expectedThumbnail) {
      const thumbnailPath = path.join(frontendPublic, expectedThumbnail);
      if (fs.existsSync(thumbnailPath)) {
        const thumbnailBuffer = fs.readFileSync(thumbnailPath);
        const extension = path.extname(thumbnailPath).toLowerCase();
        const contentType = {
          '.png': 'image/png',
          '.webp': 'image/webp',
        }[extension] ?? 'image/jpeg';
        form.set(
          'thumbnail',
          new Blob([thumbnailBuffer], { type: contentType }),
          path.basename(thumbnailPath),
        );
      }
    }

    try {
      const response = await fetch(`${apiBase}/models`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!response.ok) {
        failed += 1;
        console.error(`${filename}: upload failed (${response.status}) ${await response.text()}`);
        continue;
      }
      existing.add(key);
      uploaded += 1;
      console.log(`Uploaded ${filename}`);
    } catch (error) {
      failed += 1;
      console.error(`${filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

console.log(`Import finished: ${uploaded} uploaded, ${skipped} already present, ${failed} failed.`);
if (failed > 0) process.exitCode = 1;
