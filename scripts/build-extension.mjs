import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "extension");
const DIST_DIR = path.join(ROOT, "dist");
const TARGETS = new Set(["chrome", "firefox"]);
const requestedTargets = process.argv.slice(2);
const targets = requestedTargets.length > 0 ? requestedTargets : [...TARGETS];

for (const target of targets) {
  if (!TARGETS.has(target)) {
    throw new Error(`Unknown extension target: ${target}`);
  }
}

await fs.rm(DIST_DIR, { recursive: true, force: true });

for (const target of targets) {
  const outDir = path.join(DIST_DIR, target);
  await copyExtensionFiles(SOURCE_DIR, outDir);
  await fs.copyFile(
    path.join(SOURCE_DIR, `manifest.${target}.json`),
    path.join(outDir, "manifest.json")
  );
}

async function copyExtensionFiles(sourceDir, outDir) {
  await fs.mkdir(outDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const outPath = path.join(outDir, entry.name);

    if (entry.isDirectory()) {
      await copyExtensionFiles(sourcePath, outPath);
      continue;
    }

    if (entry.name === "manifest.json" || /^manifest\.[^.]+\.json$/.test(entry.name)) {
      continue;
    }

    await fs.copyFile(sourcePath, outPath);
  }
}
