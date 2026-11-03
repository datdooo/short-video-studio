import { encodeHistory, decodeHistory } from "./history-snapshot.mjs";
import { randomUUID } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { restoreBatchPreparation } from "./batch-queue.mjs";
import { createHistoryPersistence } from "./history-persistence.mjs";
/** One worker-owned domain; shared services are read at operation entry. */
export function createQueueHistory(read, retention = {}) {
  const { dataRoot } = read();
  const batchHistoryPath = path.join(dataRoot, "batch-history.json");

  const historyPersistence = createHistoryPersistence(batchHistoryPath);

  function persistBatchHistory({ strict = false, immediate = false } = {}) {
    const { batches, jobs } = read();

    const snapshot = JSON.stringify(encodeHistory(
      [...batches.values()],
       [...jobs.values()].filter(
        (job) =>
          job.origin === "editor" ||
          [...batches.values()].some((batch) =>
            batch.items.some((item) => !item.deleted && (item.jobId === job.id || item.submissionId === job.id)),
          ),
      ),
      retention,
    ));
    const write = historyPersistence.save(snapshot, { strict: strict || immediate });
    return strict
      ? write
      : write.catch((error) => console.error(`Queue history write failed: ${error.code || "IO_ERROR"}`));
  }

  async function restoreBatchHistory() {
    const { batches, jobs } = read();

    try {
      const history = decodeHistory(JSON.parse(await readFile(batchHistoryPath, "utf8")));
      let normalized = false;
      for (const job of history.jobs || []) {
        if (!["done", "error", "cancelled"].includes(job.state)) {
          normalized = true;
          job.state = "cancelled";
          job.error = "App đã đóng trước khi xử lý xong. File đã hoàn tất vẫn được giữ.";
        }
        jobs.set(job.id, job);
      }
      for (const batch of history.batches || []) {
        const before = JSON.stringify(batch);
        for (const item of batch.items || []) item.id ||= randomUUID();
        restoreBatchPreparation(batch, jobs);
        if (JSON.stringify(batch) !== before) normalized = true;
        batches.set(batch.id, batch);
      }
      await importLegacyRenderHistory();
      if (normalized) await persistBatchHistory({ strict: true });
    } catch (error) {
      if (error.code === "ENOENT") await importLegacyRenderHistory();
      else console.error(`Không đọc được lịch sử hàng đợi: ${error.message}`);
    }
  }

  async function importLegacyRenderHistory() {
    const { batches, jobs, probeMedia, sourcesRoot } = read();

    // Older personal builds stored files but no history. Recover completed YouTube
    // outputs for download/delete, without touching media or claiming to recover AI plans.
    const recoveredItems = [];
    let directories;
    const indexedSources = new Map();
    try {
      try {
        const saved = JSON.parse(await readFile(path.join(dataRoot, "youtube-source-index.json"), "utf8"));
        if (saved?.version === 2 && Array.isArray(saved.records)) {
          for (const source of saved.records) {
            if (/^[a-f0-9-]{16,64}$/i.test(source?.id) && source.kind === "youtube" && typeof source.title === "string" && typeof source.sourceUrl === "string") indexedSources.set(source.id, source);
          }
        }
      } catch { /* Missing/legacy/corrupt index: read individual source records. */ }
      // Directory names are cheap to list. Keep discovering unindexed legacy outputs,
      // including folders whose original media is no longer reusable.
      directories = await readdir(sourcesRoot, { withFileTypes: true });
    } catch {
      return;
    }
    for (const directory of directories) {
      if (!directory.isDirectory() || !/^[a-f0-9-]{16,64}$/i.test(directory.name)) continue;
      const sourceDirectory = path.join(sourcesRoot, directory.name);
      try {
        const source = indexedSources.get(directory.name) || JSON.parse(await readFile(path.join(sourceDirectory, "source.json"), "utf8"));
        if (source.kind !== "youtube") continue;
        for (const jobId of await readdir(path.join(sourceDirectory, "outputs"))) {
          if (!/^[a-f0-9-]{16,64}$/i.test(jobId)) continue;
          if (
            jobs.has(jobId) ||
            [...batches.values()].some((batch) => batch.items.some((item) => item.jobId === jobId))
          )
            continue;
          const outputs = [];
          for (const part of [1, 2]) {
            const partDirectory = path.join(sourceDirectory, "outputs", jobId, `part-${part}`);
            let files;
            try {
              files = await readdir(partDirectory);
            } catch {
              continue;
            }
            for (const filename of files.filter((name) => name.endsWith(".mp4"))) {
              const target = path.join(partDirectory, filename);
              try {
                const media = await probeMedia(target);
                if (!media.duration) continue;
                outputs.push({
                  part,
                  filename,
                  size: (await stat(target)).size,
                  url: `/files/${directory.name}/outputs/${jobId}/part-${part}/${encodeURIComponent(filename)}`,
                });
              } catch {
                /* Ignore incomplete exports. */
              }
            }
          }
          if (!outputs.length) continue;
          jobs.set(jobId, {
            id: jobId,
            sourceId: directory.name,
            state: "done",
            progress: 100,
            currentPart: null,
            outputs,
            error: null,
          });
          recoveredItems.push({
            id: randomUUID(),
            title: source.title,
            url: source.sourceUrl || "Video YouTube đã render",
            sourceId: directory.name,
            jobId,
            state: "done",
            error: null,
          });
        }
      } catch {
        /* Subtitle-only and incomplete source folders are not history. */
      }
    }
    if (recoveredItems.length) {
      const batch = { id: randomUUID(), items: recoveredItems };
      batches.set(batch.id, batch);
      await persistBatchHistory({ strict: true });
    }
  }
  return { persistBatchHistory, restoreBatchHistory };
}
