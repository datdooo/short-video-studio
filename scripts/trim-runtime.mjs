import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

// Only emitted development metadata in the generated app copy is disposable.
// Do not trim source node_modules, runtime JSON/JS, native libraries, or licenses.
export async function trimRuntime(directory) {
  if (!directory.includes(`${path.sep}release${path.sep}`) || !directory.endsWith(`${path.sep}Contents${path.sep}Resources${path.sep}app${path.sep}node_modules`)) throw new Error("Refusing to trim outside a generated app runtime.");
  let bytes = 0;
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const filename = path.join(folder, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else if (entry.isFile() && /\.map$|\.d\.(ts|mts|cts)$/.test(entry.name)) {
        bytes += (await stat(filename)).size;
        await rm(filename);
      }
    }
  }
  await walk(directory);
  return bytes;
}
