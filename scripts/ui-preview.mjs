// Renders the floating dock, its panel and the settings screen with sample data in headless Chrome (design review tool).
// Usage: node scripts/ui-preview.mjs <output-dir> [scenario,theme,width,height,touch ...]   e.g. panel,dark,1000,720,0
// Scenarios: dock | collapsed | panel | settings
import esbuild from "esbuild";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const out = resolve(process.argv[2] ?? "ui-preview-out");
mkdirSync(out, { recursive: true });
await esbuild.build({
  entryPoints: ["e2e/preview/preview.tsx"],
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  outfile: join(out, "preview.js"),
  alias: { obsidian: resolve("e2e/preview/obsidian-stub.ts") },
  logLevel: "warning",
  define: { "process.env.NODE_ENV": '"production"' },
});
await esbuild.build({
  entryPoints: ["src/styles/index.css"],
  bundle: true,
  outfile: join(out, "styles.css"),
  logLevel: "warning",
});
copyFileSync("e2e/preview/obsidian-base.css", join(out, "base.css"));
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="base.css"><link rel="stylesheet" href="styles.css"><body><script src="preview.js"></script>`,
);

const chrome = process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const shots = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ["dock,dark,1000,500,0", "panel,light,1000,780,0"];
for (const shot of shots) {
  const [scenario, theme, w, h = "700", touch = "0", scale = "1"] = shot.split(",");
  const file = join(out, `${scenario}-${theme}-${w}x${h}${touch === "1" ? "-touch" : ""}.png`);
  const url = `${pathToFileURL(join(out, "index.html")).href}?scenario=${scenario}&theme=${theme}&w=${w}&h=${h}&touch=${touch}`;
  const result = spawnSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      `--user-data-dir=${join(out, "profile")}`,
      "--hide-scrollbars",
      `--window-size=${Math.max(Number(w), 500)},${scenario === "settings" ? 2400 : h}`,
      `--force-device-scale-factor=${scale}`,
      "--virtual-time-budget=3000",
      `--screenshot=${file}`,
      url,
    ],
    { encoding: "utf8", timeout: 60000 },
  );
  console.log(`${result.status === 0 ? "ok" : "FAILED"} ${file}`);
}
