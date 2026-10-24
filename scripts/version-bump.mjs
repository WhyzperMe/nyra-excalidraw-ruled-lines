import { readFile, writeFile } from "node:fs/promises";

const manifestPath = "manifest.json";
const packagePath = "package.json";
const versionsPath = "versions.json";
const constantsPath = "src/core/constants.ts";

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const pkg = JSON.parse(await readFile(packagePath, "utf8"));
const versions = JSON.parse(await readFile(versionsPath, "utf8"));
const constants = await readFile(constantsPath, "utf8");

const version = String(pkg.version ?? "").trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid package version: ${version || "<empty>"}`);
}

manifest.version = version;
versions[version] = manifest.minAppVersion;

const versionPattern = /export const PLUGIN_VERSION = "[^"]+";/;
if (!versionPattern.test(constants)) {
  throw new Error("Could not locate PLUGIN_VERSION in src/core/constants.ts");
}
const nextConstants = constants.replace(versionPattern, `export const PLUGIN_VERSION = "${version}";`);

await Promise.all([
  writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`),
  writeFile(versionsPath, `${JSON.stringify(versions, null, 2)}\n`),
  writeFile(constantsPath, nextConstants),
]);
