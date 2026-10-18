import { copyFile, cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
// Both packagers use one manifest; tests walk the worker's transitive relative
// imports in a staged copy so a new module cannot silently be omitted.
export const WORKER_LIB_FILES = Object.freeze(['subtitles.mjs','render-config.mjs','legacy-plan.mjs','teaser-hooks.mjs','teaser-prompt.mjs','teaser-import.mjs','teaser-boundaries.mjs']);
export const WORKER_LIB_DIRS = Object.freeze(['visual-style','source-context']);
export async function copyWorkerLibraries(project, app) {
 await mkdir(path.join(app,'lib'),{recursive:true});
 for(const file of WORKER_LIB_FILES) await copyFile(path.join(project,'lib',file),path.join(app,'lib',file));
 for(const directory of WORKER_LIB_DIRS) await cp(path.join(project,'lib',directory),path.join(app,'lib',directory),{recursive:true});
}
