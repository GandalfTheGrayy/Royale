import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import { cpus } from "node:os";
import { basename, dirname, resolve } from "node:path";
import sharp from "sharp";

const targetRoot = resolve(process.argv[2] ?? "dist/assets");
const cacheRoot = resolve("node_modules/.cache/pehlevan-lossless-webp-v1");
const concurrency = Math.max(2, Math.min(4, cpus().length));

async function findPngs(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await findPngs(child)));
    else if (entry.name.toLowerCase().endsWith(".png")) result.push(child);
  }
  return result;
}

async function ensureLosslessVariant(source) {
  const sourceBytes = await readFile(source);
  const digest = createHash("sha256")
    .update("pehlevan-lossless-webp-v1")
    .update(sourceBytes)
    .digest("hex");
  const cached = resolve(cacheRoot, `${digest}.webp`);
  const destination = `${source}.webp`;

  try {
    await stat(cached);
  } catch {
    await mkdir(dirname(cached), { recursive: true });
    const temporary = resolve(
      dirname(cached),
      `${basename(cached)}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`,
    );
    await sharp(sourceBytes)
      .webp({ lossless: true, effort: 4 })
      .toFile(temporary);
    try {
      await rename(temporary, cached);
    } catch {
      await unlink(temporary).catch(() => undefined);
    }
  }

  const optimized = await stat(cached);
  if (optimized.size >= sourceBytes.length * 0.98) {
    await unlink(destination).catch(() => undefined);
    return {
      original: sourceBytes.length,
      transferred: sourceBytes.length,
      optimized: false,
    };
  }
  await copyFile(cached, destination);
  return {
    original: sourceBytes.length,
    transferred: optimized.size,
    optimized: true,
  };
}

await mkdir(cacheRoot, { recursive: true });
const files = await findPngs(targetRoot);
let cursor = 0;
let originalBytes = 0;
let transferredBytes = 0;
let optimizedCount = 0;

await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (cursor < files.length) {
      const file = files[cursor++];
      const result = await ensureLosslessVariant(file);
      originalBytes += result.original;
      transferredBytes += result.transferred;
      if (result.optimized) optimizedCount += 1;
    }
  }),
);

const savedBytes = originalBytes - transferredBytes;
console.log(
  `Lossless WebP: ${optimizedCount}/${files.length} PNG, ` +
    `${(originalBytes / 1024 / 1024).toFixed(1)} MB -> ` +
    `${(transferredBytes / 1024 / 1024).toFixed(1)} MB ` +
    `(aktarim kazanci ${(savedBytes / 1024 / 1024).toFixed(1)} MB).`,
);
