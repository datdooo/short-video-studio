"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Film, FolderOpen, Loader2, Play, RefreshCw, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export type LibraryFile = {
  id: string; kind: "original" | "part" | "parts"; storageId: string; sourceId: string;
  jobId?: string; part?: number; title: string; filename: string; size: number; busy: boolean;
  renderUrl?: string | null; createdAt?: string; deletedAt?: string;
  restoredItemIds?: string[]; restoredUrls?: string[];
};
type Library = {
  storages: Array<{ id: string; label: string }>;
  originals: LibraryFile[]; parts: LibraryFile[]; trash: LibraryFile[]; warnings: string[];
  totals: { originals: number; parts: number; trash: number };
};
function sizeLabel(value: number) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)} GB`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} MB`;
  return `${Math.ceil(value / 1e3)} KB`;
}

export function MediaLibraryPanel({ workerOrigin, ready, onMoved, onRestored, renderCount, renderList }: {
  renderCount: number; renderList: (query: string) => ReactNode;
  workerOrigin: string; ready: boolean; onMoved: (file: LibraryFile) => void; onRestored: (file: LibraryFile) => void;
}) {
  const [library, setLibrary] = useState<Library | null>(null);
  const [tab, setTab] = useState<"renders" | "originals" | "parts" | "trash">("renders");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<LibraryFile | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const requestPending = useRef(false);
  const previewVideo = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`${workerOrigin}/api/storage`, { cache: "no-store", signal });
    const data = await response.json() as { library?: Library; error?: string };
    if (!response.ok || !data.library) throw new Error(data.error || "Không đọc được kho video.");
    if (!signal?.aborted) setLibrary(data.library);
  }, [workerOrigin]);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      void load(controller.signal).catch((caught) => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Không đọc được kho video."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [ready, load]);
  async function refresh() {
    setLoading(true); setError("");
    try { await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Không đọc được kho video."); }
    finally { setLoading(false); }
  }
  async function action(kind: "move" | "restore" | "purge", files: LibraryFile[]) {
    if (requestPending.current || !files.length) return;
    const permanent = kind === "purge";
    const message = permanent
      ? `Xoá VĨNH VIỄN ${files.length} mục (${sizeLabel(files.reduce((sum, file) => sum + file.size, 0))})?\n\nKhông thể khôi phục qua app. Chỉ xoá những mục này trong Thùng rác, không đụng tới Downloads hay các video đang lưu khác.`
      : kind === "restore" ? `Khôi phục “${files[0].title}” về vị trí cũ? App sẽ không ghi đè file đã tồn tại.`
        : `Chuyển ${files.length} ${tab === "originals" ? "video gốc" : "part"} vào Thùng rác?\n\nCó thể khôi phục. Video gốc và các part được quản lý riêng: xoá gốc không xoá part, xoá part không xoá gốc. Bản trong Downloads không bị ảnh hưởng.`;
    if (!window.confirm(message)) return;
    requestPending.current = true; setWorking(true); setError(""); setNotice("");
    let completed = 0;
    try {
      if (permanent) {
        const response = await fetch(`${workerOrigin}/api/storage/trash`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: files.map((file) => file.id) }) });
        const data = await response.json() as { error?: string; freedBytes?: number };
        if (!response.ok) throw new Error(data.error || "Không xoá được mục trong Thùng rác.");
        completed = files.length;
        setNotice(`Đã xoá vĩnh viễn ${completed} mục, giải phóng khoảng ${sizeLabel(data.freedBytes || 0)}.`);
      } else {
        for (const file of files) {
          const response = await fetch(`${workerOrigin}/api/storage/${kind === "move" ? "trash" : "restore"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: file.id }) });
          const data = await response.json() as { error?: string; moved?: LibraryFile; restored?: LibraryFile };
          if (!response.ok) throw new Error(data.error || "Không xử lý được video.");
          completed++;
          if (kind === "move") {
            onMoved(data.moved || file);
            setPreview((current) => current?.id === file.id ? null : current);
          } else onRestored(data.restored || file);
          setSelected((current) => { const next = new Set(current); next.delete(file.id); return next; });
        }
        setNotice(kind === "restore" ? "Đã khôi phục file về vị trí cũ." : `Đã chuyển ${completed} mục vào Thùng rác. Chưa giải phóng dung lượng; chọn Xoá vĩnh viễn nếu không cần giữ nữa.`);
      }
      setSelected(new Set());
    } catch (caught) {
      setError(`${completed ? `Đã xử lý ${completed} mục. ` : ""}${caught instanceof Error ? caught.message : "Không xử lý được video."}`);
    } finally {
      try { await load(); } catch { /* The next refresh can reconnect. */ }
      requestPending.current = false; setWorking(false);
    }
  }
  const files = (tab === "renders" ? [] : library?.[tab] || []).filter((file) => `${file.title} ${file.filename}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const selectedFiles = files.filter((file) => selected.has(file.id) && !file.busy).slice(0, 500);
  const available = files.filter((file) => !file.busy).slice(0, 500);
  return <section className="studio-library px-5 py-6">
    <Tabs value={tab} onValueChange={(value) => { previewVideo.current?.pause(); setTab(value as typeof tab); setSelected(new Set()); }}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><FolderOpen className="size-6 text-[#ff806a]" /> Kho</h1><p className="mt-2 text-sm leading-6 text-zinc-400">Quản lý riêng video gốc và các part. Không tự xoá sau render, không xoá bản đã tải về Downloads.</p></div>
      <Button variant="outline" onClick={() => void refresh()} disabled={!ready || loading || working} className="border-white/15 bg-white/5">{loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Làm mới</Button>
    </div>
    <div className="relative mt-5 min-w-0"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input aria-label="Tìm trong Kho" value={search} onChange={(event) => { setSearch(event.target.value); setSelected(new Set()); }} placeholder="Tìm theo title, tên file hoặc mã render…" className="studio-input studio-icon-input pl-9" /></div>
    <TabsList className="studio-library-tabs mt-3" aria-label="Nội dung Kho">
      <TabsTrigger value="renders">Danh sách render <span className="studio-count">{renderCount}</span></TabsTrigger>
      <TabsTrigger value="originals">Nguồn <span className="studio-count">{library ? library.originals.length : '…'}</span></TabsTrigger>
      <TabsTrigger value="parts">Part <span className="studio-count">{library ? library.parts.length : '…'}</span></TabsTrigger>
      <TabsTrigger value="trash">Thùng rác <span className="studio-count">{library ? library.trash.length : '…'}</span></TabsTrigger>
    </TabsList>
    {!ready && <p className="mt-4 text-sm text-amber-200">App chưa kết nối media worker.</p>}
    {error && <p role="alert" className="mt-4 break-words text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="mt-4 text-sm text-emerald-300">{notice}</p>}
    {library?.warnings.map((warning) => <p key={warning} className="mt-2 text-xs text-amber-200">{warning}</p>)}
    <TabsContent value="renders" forceMount hidden={tab !== "renders"}>{renderList(search)}</TabsContent>
    <TabsContent value={tab === "renders" ? "originals" : tab} forceMount hidden={tab === "renders"}>
    <p className="mt-3 text-xs text-muted-foreground">{tab !== "renders" && library ? sizeLabel(library.totals[tab]) : "—"} trong mục này.</p>
    <p className="mt-3 text-xs leading-5 text-zinc-500">Bao gồm dữ liệu hiện tại và kho cũ trong Documents nếu có. File trong thùng rác vẫn chiếm dung lượng cho đến khi xoá vĩnh viễn.</p>
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <Button variant="outline" onClick={() => setSelected(new Set(available.map((file) => file.id)))} disabled={!available.length || working} className="border-white/15 bg-white/5">Chọn tất cả {available.length > 1 ? `(${available.length})` : ""}</Button>
      {selectedFiles.length > 0 && <Button onClick={() => void action(tab === "trash" ? "purge" : "move", selectedFiles)} disabled={working} className="bg-red-500/15 text-red-200 hover:bg-red-500/25">{working ? <Loader2 className="animate-spin" /> : <Trash2 />} {tab === "trash" ? "Xoá vĩnh viễn" : "Chuyển vào thùng rác"} ({selectedFiles.length})</Button>}
    </div>
    <div className="studio-library-content-grid mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="studio-library-file-list max-h-[65vh] space-y-3 overflow-y-auto pr-1">
        {files.map((file) => <div key={file.id} className="studio-library-card rounded-2xl border border-white/10 bg-white/[.025] p-4">
          <div className="flex items-start gap-3"><input type="checkbox" aria-label={`Chọn ${file.title} ${file.filename}`} checked={selected.has(file.id)} disabled={file.busy || working} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(file.id); else next.delete(file.id); return next; })} className="mt-1 size-4 shrink-0 accent-[#ff4d2e]" /><span className="studio-library-file-icon" aria-hidden="true"><Film size={20}/></span><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold leading-6">{file.title}</p><p className="mt-1 break-all text-xs text-zinc-400">{file.kind === "original" ? "Video gốc" : file.kind === "parts" ? "Bộ Part" : `Part ${file.part}`} · {file.filename} · {sizeLabel(file.size)}</p><p className="mt-1 text-[11px] text-zinc-500">{library?.storages.find((store) => store.id === file.storageId)?.label}{file.deletedAt ? ` · Xoá lúc ${new Date(file.deletedAt).toLocaleString("vi-VN")}` : ""}</p>{file.busy && <p className="mt-2 text-xs text-amber-200">Đang xử lý — chưa thể xoá hoặc khôi phục.</p>}</div></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {tab !== "trash" ? <><Button variant="outline" size="sm" onClick={() => { setPreview(file); setPreviewError(""); }} className="border-white/15 bg-transparent"><Play className="size-3.5" /> Xem</Button><a href={`${workerOrigin}/api/storage/media/${encodeURIComponent(file.id)}?download=1`} download={file.filename} className="studio-control studio-download flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs"><Download className="size-3.5" /> Tải file</a><Button variant="outline" size="sm" disabled={working || file.busy} onClick={() => void action("move", [file])} className="border-red-400/20 bg-transparent text-red-300"><Trash2 className="size-3.5" /> Chuyển vào thùng rác</Button></> : <><Button variant="outline" size="sm" disabled={working || file.busy} onClick={() => void action("restore", [file])} className="border-emerald-400/20 bg-transparent text-emerald-300"><RotateCcw className="size-3.5" /> Khôi phục</Button><Button variant="outline" size="sm" disabled={working || file.busy} onClick={() => void action("purge", [file])} className="border-red-400/20 bg-transparent text-red-300"><Trash2 className="size-3.5" /> Xoá vĩnh viễn</Button></>}
          </div>
        </div>)}
        {!files.length && <p className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">{loading ? "Đang đọc kho video…" : tab === "trash" ? "Thùng rác đang trống." : "Không có video phù hợp."}</p>}
      </div>
      <aside className="rounded-2xl border border-white/10 bg-[#111216] p-4 lg:sticky lg:top-20"><p className="eyebrow">XEM TRƯỚC FILE</p>{preview ? <><video ref={previewVideo} key={preview.id} src={`${workerOrigin}/api/storage/media/${encodeURIComponent(preview.id)}`} controls playsInline preload="metadata" onError={() => setPreviewError("File không còn ở kho đang lưu. Làm mới danh sách để kiểm tra.")} onLoadedMetadata={() => setPreviewError("")} className="mt-3 max-h-[360px] w-full rounded-xl bg-black object-contain" /><p className="mt-3 break-words text-xs leading-5">{preview.title}</p>{previewError && <p className="mt-2 text-xs text-red-300">{previewError}</p>}</> : <p className="mt-3 text-xs leading-6 text-zinc-500">Bấm Xem ở video gốc hoặc Part để kiểm tra trước khi xoá.</p>}<p className="mt-4 text-xs leading-6 text-zinc-500">Khôi phục không ghi đè file. Xoá vĩnh viễn chỉ tác động đến các mục được xác nhận trong thùng rác, không đụng tới source code, tài khoản hay Downloads.</p></aside>
    </div>
    </TabsContent>
    </Tabs>
  </section>;
}
