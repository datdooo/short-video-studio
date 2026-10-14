import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const sourceName = /^source\.(mp4|mov|mkv|webm|m4v|avi)$/i;
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function filename(value) {
  if (typeof value !== "string" || !value || value === "." || value === ".." || /[\/\\\0]/.test(value)) fail("Tên file không hợp lệ.");
  return value;
}
async function safePath(root, pieces, missing = false) {
  let target = root;
  for (const piece of [null, ...pieces]) {
    if (piece !== null) target = path.join(target, filename(piece));
    try {
      if ((await lstat(target)).isSymbolicLink()) fail("Không xử lý symlink trong kho video.", 409);
    } catch (error) { if (!(missing && error.code === "ENOENT")) throw error; }
  }
  return target;
}
async function children(folder) {
  try { return await readdir(folder, { withFileTypes: true }); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
}
async function bytes(target) {
  const info = await lstat(target);
  if (info.isSymbolicLink()) fail("Không xử lý symlink trong thùng rác.", 409);
  if (!info.isDirectory()) return info.size;
  let total = 0;
  for (const entry of await children(target)) total += await bytes(path.join(target, entry.name));
  return total;
}

export async function boundedCatalogue(task, label, timeout = 2500) {
  let timer;
  try {
    return await Promise.race([task, new Promise((resolve) => {
      timer = setTimeout(() => resolve({ originals: [], parts: [], trash: [], warnings: [`Chưa đọc được ${label}. Kiểm tra quyền truy cập file của ShortCut Studio trên macOS rồi bấm Làm mới. Các kho khác vẫn dùng được.`] }), timeout);
    })]);
  } finally { clearTimeout(timer); }
}

export function createMediaLibrary({ roots, isBusy = () => false, onMoved = () => {}, onRestored = () => {} }) {
  const storages = new Map(roots.map((root) => [root.id, { ...root, root: path.resolve(root.root) }]));
  const locks = new Set();
  const scans = new Map();
  let mutations = Promise.resolve();
  function serialized(work) { const task = mutations.then(work); mutations = task.catch(() => {}); return task; }
  function storage(id) { const value = storages.get(id); if (!value) fail("Kho dữ liệu không hợp lệ."); return value; }
  function decode(id) {
    let data;
    try { data = JSON.parse(Buffer.from(id, "base64url").toString()); } catch { fail("Mã video không hợp lệ."); }
    if (!data || !uuid.test(data.sourceId) || !["original", "part"].includes(data.kind)) fail("Mã video không hợp lệ.");
    storage(data.storageId); filename(data.filename);
    if (data.kind === "original" && !sourceName.test(data.filename)) fail("Chỉ xử lý file video nguồn.");
    if (data.kind === "part" && (!uuid.test(data.jobId) || ![1, 2].includes(data.part) || !/\.mp4$/i.test(data.filename))) fail("Mã Part không hợp lệ.");
    return data;
  }
  function pieces(data) {
    return ["sources", data.sourceId, ...(data.kind === "part" ? ["outputs", data.jobId, `part-${data.part}`] : []), data.filename];
  }
  function busy(data) { return locks.has(`${data.storageId}:${data.sourceId}`) || isBusy(data); }
  function guard(data) { if (busy(data)) fail("Video đang được tải, AI hoặc render. Dừng/chờ tác vụ hoàn tất trước khi xoá hoặc khôi phục.", 409); }
  function lock(data) { guard(data); const key = `${data.storageId}:${data.sourceId}`; locks.add(key); return () => locks.delete(key); }
  async function metadata(store, sourceId) {
    try { return JSON.parse(await readFile(await safePath(store.root, ["sources", sourceId, "source.json"]), "utf8")); }
    catch (error) { if (error.status) throw error; }
    // Older sources can have been removed manually. Keep recovered trash rows
    // recognizable using this app's own history, never unrelated user files.
    try {
      const history = JSON.parse(await readFile(await safePath(store.root, ["batch-history.json"]), "utf8"));
      const items = (history.batches || []).flatMap((batch) => batch.items || []);
      const item = items.find((item) => item.sourceId === sourceId || (history.jobs || []).some((job) => job.id === item.jobId && job.sourceId === sourceId));
      return { title: item?.title || (history.jobs || []).find((job) => job.sourceId === sourceId)?.plan?.originalTitle || sourceId };
    } catch { return { title: sourceId }; }
  }
  async function entry(data) {
    const store = storage(data.storageId);
    const target = await safePath(store.root, pieces(data));
    const info = await lstat(target);
    if (!info.isFile()) fail("Không phải file video.");
    const source = await metadata(store, data.sourceId);
    return { ...data, id: Buffer.from(JSON.stringify(data)).toString("base64url"), title: source.title || data.sourceId,
      size: info.size, createdAt: info.mtime.toISOString(), busy: busy(data),
      renderUrl: data.storageId === "current" && data.kind === "part" ? `/files/${data.sourceId}/outputs/${data.jobId}/part-${data.part}/${encodeURIComponent(data.filename)}` : null,
      target };
  }
  function publicEntry(value) { const item = { ...value }; delete item.target; return item; }
  async function trashEntry(id) {
    const parts = String(id).split(":");
    if (parts.length !== 3) fail("Mã thùng rác không hợp lệ.");
    const [storageId, category, key] = parts;
    const store = storage(storageId);
    if (category === "media") {
      if (!uuid.test(key)) fail("Mã thùng rác không hợp lệ.");
      const directory = await safePath(store.root, ["trash", "media", key]);
      const manifest = JSON.parse(await readFile(await safePath(store.root, ["trash", "media", key, "entry.json"]), "utf8"));
      const data = decode(manifest.originalId);
      if (data.storageId !== storageId) fail("Kho thùng rác không khớp.");
      const target = await safePath(store.root, ["trash", "media", key, data.filename]);
      if (!(await lstat(target)).isFile()) fail("File trong thùng rác không hợp lệ.");
      return { ...data, id, title: String(manifest.title || data.sourceId), size: await bytes(directory), deletedAt: manifest.deletedAt,
        busy: busy(data), directory, target, originalId: manifest.originalId };
    }
    if (category === "renders") {
      const ids = key.split("--");
      if (ids.length !== 3 || !ids.every((value) => uuid.test(value))) fail("Mã render cũ không hợp lệ.");
      const [sourceId, jobId] = ids;
      const directory = await safePath(store.root, ["trash", "renders", key]);
      if (!(await lstat(directory)).isDirectory()) fail("Thư mục render không hợp lệ.");
      const source = await metadata(store, sourceId);
      const data = { storageId, sourceId, jobId, kind: "parts" };
      return { ...data, id, title: source.title || sourceId, filename: "Bộ Part đã xoá", size: await bytes(directory),
        deletedAt: (await lstat(directory)).mtime.toISOString(), busy: busy(data), directory, target: directory };
    }
    fail("Loại thùng rác không hợp lệ.");
  }
  function publicTrash(value) { const item = { ...value }; delete item.directory; delete item.target; delete item.originalId; return item; }
  return {
    isLocked: (sourceId) => locks.has(`current:${sourceId}`),
    async list() {
      const results = await Promise.all([...storages.values()].map(async (store) => {
        let task = scans.get(store.id);
        if (!task) {
          task = (async () => {
            const originals = [], parts = [], trash = [], warnings = [];
        try {
          for (const source of await children(path.join(store.root, "sources"))) {
            if (!source.isDirectory() || !uuid.test(source.name)) continue;
            for (const file of await children(await safePath(store.root, ["sources", source.name]))) {
              if (file.isFile() && sourceName.test(file.name)) originals.push(publicEntry(await entry({ storageId: store.id, sourceId: source.name, kind: "original", filename: file.name })));
            }
            for (const job of await children(path.join(store.root, "sources", source.name, "outputs"))) {
              if (!job.isDirectory() || !uuid.test(job.name)) continue;
              for (const part of [1, 2]) {
                const folder = path.join(store.root, "sources", source.name, "outputs", job.name, `part-${part}`);
                for (const file of await children(folder)) {
                  if (file.isFile() && /\.mp4$/i.test(file.name)) parts.push(publicEntry(await entry({ storageId: store.id, sourceId: source.name, jobId: job.name, part, kind: "part", filename: file.name })));
                }
              }
            }
          }
          for (const category of ["media", "renders"]) {
            for (const folder of await children(path.join(store.root, "trash", category))) {
              if (!folder.isDirectory()) continue;
              try { trash.push(publicTrash(await trashEntry(`${store.id}:${category}:${folder.name}`))); }
              catch (error) { warnings.push(`Không đọc được một mục trong thùng rác ${store.label}: ${error.message}`); }
            }
          }
        } catch (error) { warnings.push(`Không đọc được đầy đủ ${store.label}: ${error.message}`); }
            return { originals, parts, trash, warnings };
          })();
          scans.set(store.id, task);
          void task.finally(() => { if (scans.get(store.id) === task) scans.delete(store.id); }).catch(() => {});
        }
        return boundedCatalogue(task, store.label);
      }));
      const originals = results.flatMap((result) => result.originals), parts = results.flatMap((result) => result.parts), trash = results.flatMap((result) => result.trash), warnings = results.flatMap((result) => result.warnings);
      originals.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); parts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); trash.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
      return { storages: roots.map(({ id, label }) => ({ id, label })), originals, parts, trash, warnings,
        totals: { originals: originals.reduce((sum, item) => sum + item.size, 0), parts: parts.reduce((sum, item) => sum + item.size, 0), trash: trash.reduce((sum, item) => sum + item.size, 0) } };
    },
    async media(id) { return (await entry(decode(id))).target; },
    moveRender({ storageId = "current", sourceId, jobId }) { return serialized(async () => {
      if (!uuid.test(sourceId) || !uuid.test(jobId)) fail("Mã render không hợp lệ.");
      const store = storage(storageId), item = { storageId, sourceId, jobId, kind: "parts" };
      const release = lock(item);
      try {
        let target;
        try {
          target = await safePath(store.root, ["sources", sourceId, "outputs", jobId]);
          if (!(await lstat(target)).isDirectory()) fail("Không phải thư mục render.");
          await bytes(target); // Reject nested symlinks as well as linked parents.
        } catch (error) { if (error.code === "ENOENT") return { removed: true, trashId: null }; throw error; }
        const key = `${sourceId}--${jobId}--${randomUUID()}`;
        const destination = await safePath(store.root, ["trash", "renders", key], true);
        await mkdir(path.dirname(destination), { recursive: true });
        await rename(target, destination);
        await onMoved(item);
        return { removed: true, trashId: `${storageId}:renders:${key}` };
      } finally { release(); }
    }); },
    move(id) { return serialized(async () => {
      const item = await entry(decode(id));
      const release = lock(item);
      try {
        const store = storage(item.storageId), key = randomUUID();
        await safePath(store.root, ["trash", "media", key], true);
        const directory = path.join(store.root, "trash", "media", key);
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, "entry.json"), JSON.stringify({ originalId: item.id, title: item.title, deletedAt: new Date().toISOString() }), { flag: "wx" });
        try { await rename(item.target, path.join(directory, item.filename)); }
        catch (error) { await rm(directory, { recursive: true }); throw error; }
        await onMoved(publicEntry(item));
        return { moved: publicEntry(item), trashId: `${store.id}:media:${key}` };
      } finally { release(); }
    }); },
    restore(id) { return serialized(async () => {
      const item = await trashEntry(id), store = storage(item.storageId);
      const release = lock(item);
      try {
        const relative = item.kind === "parts" ? ["sources", item.sourceId, "outputs", item.jobId] : pieces(item);
        const destination = await safePath(store.root, relative, true);
        try { await lstat(destination); fail("File đã tồn tại ở vị trí cũ. Không ghi đè; mục vẫn ở thùng rác.", 409); }
        catch (error) { if (error.code !== "ENOENT") throw error; }
        await mkdir(path.dirname(destination), { recursive: true });
        await rename(item.target, destination);
        if (item.kind !== "parts") await rm(item.directory, { recursive: true });
        const result = await onRestored(publicTrash(item));
        return { restored: { ...publicTrash(item), ...(result || {}) } };
      } finally { release(); }
    }); },
    purge(ids) { return serialized(async () => {
      if (!Array.isArray(ids) || !ids.length || ids.length > 500 || new Set(ids).size !== ids.length) fail("Chọn từ 1 đến 500 mục khác nhau để xoá.");
      const items = await Promise.all(ids.map(trashEntry));
      items.forEach(guard);
      const keys = new Set(items.map((item) => `${item.storageId}:${item.sourceId}`));
      keys.forEach((key) => locks.add(key));
      try {
        let freedBytes = 0;
        for (const item of items) {
          // Revalidate the exact managed child directory immediately before rm.
          await trashEntry(item.id);
          await rm(item.directory, { recursive: true, force: false });
          freedBytes += item.size;
        }
        return { deleted: ids, freedBytes };
      } finally { keys.forEach((key) => locks.delete(key)); }
    }); },
  };
}
