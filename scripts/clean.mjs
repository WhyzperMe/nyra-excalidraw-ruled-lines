import { rm } from "node:fs/promises";

for (const target of ["main.js", "styles.css", "release"]) {
  await rm(target, { force: true, recursive: true });
}
