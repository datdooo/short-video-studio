import { lstat, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createMediaLibrary } from "./media-library.mjs";
/** Library mutation policy reads current worker ownership only when invoked. */
export function createLibraryService(dataRoot, read) {
  const mediaLibrary = createMediaLibrary({
    editorInUse: ({ storageId, sourceId, kind }) => {
      const { editorSourceLeases } = read();
      return storageId === "current" && kind === "original" && editorSourceLeases.has(sourceId);
    },
    roots: [
      { id: "current", label: "Dữ liệu app hiện tại", root: dataRoot },
      // Beta never mounts another profile's library.
    ],
    isBusy: ({ storageId, sourceId, jobId, kind }) => {
      const { jobs, renderControllers, batches, speech, musicSpeech, musicPreview, localSignals, webAiVideos } = read();
      return (
        storageId === "current" &&
        (["part", "parts"].includes(kind)
          ? // Outputs belong to a specific job directory. Playback/analysis of the
            // source, or a different export of that source, cannot mutate these files.
            [...jobs.values()].some(
              (job) =>
                job.id === jobId && (["queued", "rendering"].includes(job.state) || renderControllers.has(job.id)),
            ) ||
            [...batches.values()].some((batch) =>
              batch.items.some(
                (item) => !item.deleted && item.jobId === jobId && (item.deleting || item.state === "submitting"),
              ),
            )
          : speech.isBusy(sourceId) ||
            musicSpeech.isBusy(sourceId) ||
            musicPreview.isBusy(sourceId) ||
            localSignals.isBusy(sourceId) ||
            webAiVideos.isBusy(sourceId) ||
            [...jobs.values()].some(
              (job) =>
                job.sourceId === sourceId &&
                (["queued", "rendering"].includes(job.state) || renderControllers.has(job.id)),
            ) ||
            [...batches.values()].some((batch) =>
              batch.items.some(
                (item) =>
                  !item.deleted &&
                  (item.sourceId || jobs.get(item.jobId)?.sourceId) === sourceId &&
                  (item.deleting ||
                    [
                      "downloading",
                      "analyzing",
                      "paused",
                      "awaiting-import",
                      "review-required",
                      "render-ready",
                      "submitting",
                    ].includes(item.state)),
              ),
            ))
      );
    },
    onMoved: async (item) => {
      const { sourceReuse, jobs, persistBatchHistory } = read();
      if (item.storageId === "current" && item.kind === "original") {
        await sourceReuse.forget(item.sourceId);
        return;
      }
      if (item.storageId !== "current" || !["part", "parts"].includes(item.kind)) return;
      const job = jobs.get(item.jobId);
      if (job) {
        if (item.kind === "parts") {
          job.deleted = true;
          job.outputs = [];
        } else job.outputs = job.outputs.filter((output) => output.url !== item.renderUrl);
      }
      await persistBatchHistory({ strict: true });
    },
    onRestored: async (item) => {
      const { sourceReuse, sourcesRoot, jobs, batches, persistBatchHistory } = read();
      if (item.storageId === "current" && item.kind === "original") {
        await sourceReuse.restored(item.sourceId);
        return;
      }
      if (item.storageId !== "current" || !["part", "parts"].includes(item.kind)) return;
      const outputs = [];
      for (const part of [1, 2]) {
        const folder = path.join(sourcesRoot, item.sourceId, "outputs", item.jobId, `part-${part}`);
        let files;
        try {
          const info = await lstat(folder);
          if (!info.isDirectory() || info.isSymbolicLink()) continue;
          files = await readdir(folder, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const file of files.filter((file) => file.isFile() && /\.mp4$/i.test(file.name))) {
          outputs.push({
            part,
            filename: file.name,
            size: (await stat(path.join(folder, file.name))).size,
            url: `/files/${item.sourceId}/outputs/${item.jobId}/part-${part}/${encodeURIComponent(file.name)}`,
          });
        }
      }
      const job = jobs.get(item.jobId);
      if (job) {
        job.outputs = outputs;
        delete job.deleted;
      } else
        jobs.set(item.jobId, {
          id: item.jobId,
          sourceId: item.sourceId,
          state: "done",
          progress: 100,
          currentPart: null,
          outputs,
          error: null,
        });
      const restoredItemIds = [];
      for (const batch of batches.values())
        for (const candidate of batch.items) {
          if (candidate.jobId === item.jobId && candidate.deleted) {
            delete candidate.deleted;
            candidate.state = "done";
            candidate.error = null;
            restoredItemIds.push(candidate.id);
          }
        }
      await persistBatchHistory({ strict: true });
      return { restoredItemIds, restoredUrls: outputs.map((output) => output.url) };
    },
  });
  return mediaLibrary;
}
