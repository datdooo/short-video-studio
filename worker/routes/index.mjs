import { createCodexRoutes } from "./codex.mjs";
import { createBatchRoutes } from "./batch.mjs";
import { createHealthRoutes } from "./health.mjs";
import { createMusicRoutes } from "./music.mjs";
import { createRenderRoutes } from "./render.mjs";
import { createRouter } from "./router.mjs";
import { createSourcesRoutes } from "./sources.mjs";
import { createStorageRoutes } from "./storage.mjs";
/** Composition only: handlers preserve captured route priorities and shared service identity. */
export function createWorkerRoutes(services) {
  return createRouter(
    [
      createSourcesRoutes(services),
      createHealthRoutes(services),
      createCodexRoutes(services),
      createMusicRoutes(services),
      createBatchRoutes(services),
      createStorageRoutes(services),
      createRenderRoutes(services),
    ].flat(),
  );
}
