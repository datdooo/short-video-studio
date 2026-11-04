"use client";
import { workerErrorMessage } from "@/lib/api/worker-client";
import { useConfirm, toast } from "./confirmation-provider";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Film, FolderOpen, Loader2, Play, RefreshCw, RotateCcw, Search, Trash2 } from "lucide-react";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState, InlineNotice, Panel, PanelBody, PanelHeader, Toolbar } from "@/components/ui/workspace";
import { TaskProgress } from "./task-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export type LibraryFile = {
  id: string;
  kind: "original" | "part" | "parts";
  storageId: string;
  sourceId: string;
  jobId?: string;
  part?: number;
  title: string;
  filename: string;
  size: number;
  busy: boolean;
  renderUrl?: string | null;
  createdAt?: string;
  deletedAt?: string;
  inUseByEditor?: boolean;
  restoredItemIds?: string[];
  restoredUrls?: string[];
};
type Library = {
  storages: Array<{ id: string; label: string }>;
  originals: LibraryFile[];
  parts: LibraryFile[];
  trash: LibraryFile[];
  warnings: string[];
  totals: { originals: number; parts: number; trash: number };
};
function sizeLabel(value: number) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)} GB`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} MB`;
  return `${Math.ceil(value / 1e3)} KB`;
}

export function MediaLibraryPanel({
  editorSourceId,
  ensureEditorSource,
  workerOrigin,
  ready,
  onMoved,
  onRestored,
  renderCount,
  renderList,
}: {
  editorSourceId: string;
  ensureEditorSource: () => Promise<void>;
  renderCount: number;
  renderList: (query: string) => ReactNode;
  workerOrigin: string;
  ready: boolean;
  onMoved: (file: LibraryFile) => void;
  onRestored: (file: LibraryFile) => void;
}) {
  const confirm = useConfirm();
  const [library, setLibrary] = useState<Library | null>(null);
  const [tab, setTab] = useState<"renders" | "originals" | "parts" | "trash">("renders");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<LibraryFile | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [loadPending, setLoading] = useState(false);
  const loading = ready && loadPending;
  const [working, setWorking] = useState(false);
  const [operation, setOperation] = useState<{
    startedAt: number;
    completed: number;
    total: number;
    label: string;
  } | null>(null);
  const requestPending = useRef(false);
  const loadSerial = useRef(0),
    refreshPending = useRef(false),
    mounted = useRef(true);
  const nextLoadSerial = useCallback(() => ++loadSerial.current, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      nextLoadSerial();
    };
  }, [nextLoadSerial]);
  const previewVideo = useRef<HTMLVideoElement | null>(null);
  // React clears refs before passive unmount cleanup. Pause the owned node
  // while it is still available, including workspace/file replacement.
  const bindPreviewVideo = useCallback((node: HTMLVideoElement | null) => {
    const previous = previewVideo.current;
    if (previous && previous !== node) previous.pause();
    previewVideo.current = node;
  }, []);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const serial = nextLoadSerial();
      const response = await fetch(`${workerOrigin}/api/storage`, { cache: "no-store", signal });
      const data = (await response.json()) as { library?: Library; error?: string };
      if (!response.ok || !data.library) throw new Error(data.error || "Không đọc được kho video.");
      if (!signal?.aborted && mounted.current && serial === loadSerial.current) setLibrary(data.library);
    },
    [workerOrigin, nextLoadSerial],
  );
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      void load(controller.signal)
        .catch((caught) => {
          if (!controller.signal.aborted)
            setError(caught instanceof Error ? caught.message : "Không đọc được kho video.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [ready, load]);
  async function refresh() {
    if (refreshPending.current || requestPending.current) return;
    refreshPending.current = true;
    setLoading(true);
    setError("");
    try {
      await load();
    } catch (caught) {
      if (mounted.current) setError(caught instanceof Error ? caught.message : "Không đọc được kho video.");
    } finally {
      refreshPending.current = false;
      if (mounted.current) setLoading(false);
    }
  }
  const handleStorageAction = useCallback(
    async (kind: "move" | "restore" | "purge", files: LibraryFile[]) => {
      if (requestPending.current || !files.length) return;
      // Refresh this renderer's ownership before asking the server to delete.
      // The worker independently checks every active Editor lease, not this flag.
      requestPending.current = true;
      setWorking(true);
      setError("");
      try {
        if (kind !== "restore" && files.some((file) => file.storageId === "current" && file.kind === "original")) {
          await ensureEditorSource();
          if (!mounted.current) {
            requestPending.current = false;
            return;
          }
          if (
            files.some(
              (file) => file.storageId === "current" && file.kind === "original" && file.sourceId === editorSourceId,
            )
          )
            throw Error(
              kind === "purge"
                ? "Nguồn đang dùng trong Editor; đổi nguồn hoặc mở Phiên mới trước khi xoá vĩnh viễn."
                : "Nguồn đang dùng trong Editor; đổi nguồn hoặc mở Phiên mới trước khi chuyển vào Thùng rác.",
            );
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Chưa kiểm tra được nguồn Editor.");
        requestPending.current = false;
        setWorking(false);
        return;
      }
      const permanent = kind === "purge";
      const message = permanent
        ? `Xoá VĨNH VIỄN ${files.length} mục (${sizeLabel(files.reduce((sum, file) => sum + file.size, 0))})?\n\nKhông thể khôi phục qua app. Chỉ xoá những mục này trong Thùng rác, không đụng tới Downloads hay các video đang lưu khác.`
        : kind === "restore"
          ? `Khôi phục “${files[0].title}” về vị trí cũ? App sẽ không ghi đè file đã tồn tại.`
          : `Chuyển ${files.length} ${tab === "originals" ? "video gốc" : "part"} vào Thùng rác?\n\nCó thể khôi phục. Video gốc và các part được quản lý riêng: xoá gốc không xoá part, xoá part không xoá gốc. Bản trong Downloads không bị ảnh hưởng.`;
      if ((await confirm({ message })) !== "confirm") {
        requestPending.current = false;
        setWorking(false);
        return;
      }
      requestPending.current = true;
      nextLoadSerial();
      setOperation({
        startedAt: Date.now(),
        completed: 0,
        total: files.length,
        label: permanent ? "Xóa mục đã chọn" : kind === "restore" ? "Khôi phục" : "Chuyển vào thùng rác",
      });
      setWorking(true);
      setError("");
      setNotice("");
      const moved: LibraryFile[] = [];
      let completed = 0;
      try {
        if (permanent) {
          const response = await fetch(`${workerOrigin}/api/storage/trash`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: files.map((file) => file.id) }),
          });
          const data = (await response.json()) as { error?: string; freedBytes?: number };
          if (!response.ok) throw new Error(data.error || "Không xoá được mục trong Thùng rác.");
          completed = files.length;
          setNotice(`Đã xoá vĩnh viễn ${completed} mục, giải phóng khoảng ${sizeLabel(data.freedBytes || 0)}.`);
        } else {
          for (const file of files) {
            const response = await fetch(`${workerOrigin}/api/storage/${kind === "move" ? "trash" : "restore"}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: file.id }),
            });
            const data = (await response.json()) as { error?: string; moved?: LibraryFile; restored?: LibraryFile };
            if (!response.ok) throw new Error(data.error || "Không xử lý được video.");
            completed++;
            setOperation((current) => (current ? { ...current, completed } : current));
            if (kind === "move") {
              onMoved(data.moved || file);
              if (data.moved) moved.push(data.moved);
              setPreview((current) => (current?.id === file.id ? null : current));
            } else onRestored(data.restored || file);
            setSelected((current) => {
              const next = new Set(current);
              next.delete(file.id);
              return next;
            });
          }
          setNotice(
            kind === "restore"
              ? "Đã khôi phục file về vị trí cũ."
              : `Đã chuyển ${completed} mục vào Thùng rác. Chưa giải phóng dung lượng; chọn Xoá vĩnh viễn nếu không cần giữ nữa.`,
          );
        }
        setSelected(new Set());
        if (kind === "move" && moved.length)
          toast.success("Đã chuyển vào Thùng rác", {
            action: {
              label: "Hoàn tác",
              onClick: () => {
                void (async () => {
                  try {
                    for (const file of moved) {
                      const response = await fetch(`${workerOrigin}/api/storage/restore`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: file.id }),
                      });
                      const data = (await response.json()) as { restored?: LibraryFile };
                      if (!response.ok || !data.restored) throw Error("Không khôi phục được");
                      onRestored(data.restored);
                    }
                    await load();
                    toast.success("Đã khôi phục");
                  } catch {
                    toast.error("Chưa khôi phục được; mở Thùng rác để thử lại");
                  }
                })();
              },
            },
          });
      } catch (caught) {
        setError(
          `${completed ? `Đã xử lý ${completed} mục. ` : ""}${caught instanceof Error ? caught.message : "Không xử lý được video."}`,
        );
      } finally {
        try {
          await load();
        } catch {
          /* The next refresh can reconnect. */
        }
        requestPending.current = false;
        setWorking(false);
        setOperation(null);
      }
    },
    [editorSourceId, ensureEditorSource, workerOrigin, tab, onMoved, onRestored, load, confirm, nextLoadSerial],
  );
  const files = (tab === "renders" ? [] : library?.[tab] || []).filter((file) =>
    `${file.title} ${file.filename}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const selectedFiles = files.filter((file) => selected.has(file.id) && !file.busy).slice(0, 500);
  const available = files.filter((file) => !file.busy).slice(0, 500);
  return (
    <section className="studio-library px-5 py-6">
      <h1 className="sr-only">Kho</h1>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          previewVideo.current?.pause();
          setTab(value as typeof tab);
          setSelected(new Set());
        }}
      >
        <Toolbar>
          <div className="studio-library-search relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              aria-label="Tìm trong Kho"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelected(new Set());
              }}
              placeholder="Tìm theo title, tên file hoặc mã render…"
              className="studio-input studio-icon-input pl-9"
            />
          </div>
          <TabsList className="studio-library-tabs" aria-label="Nội dung Kho">
            <TabsTrigger value="renders">
              Danh sách render <span className="studio-count">{renderCount}</span>
            </TabsTrigger>
            <TabsTrigger value="originals">
              Nguồn <span className="studio-count">{library ? library.originals.length : "…"}</span>
            </TabsTrigger>
            <TabsTrigger value="parts">
              Part <span className="studio-count">{library ? library.parts.length : "…"}</span>
            </TabsTrigger>
            <TabsTrigger value="trash">
              Thùng rác <span className="studio-count">{library ? library.trash.length : "…"}</span>
            </TabsTrigger>
          </TabsList>
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            onClick={() => void refresh()}
            disabled={!ready || loading || working}
          >
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Làm mới
          </Button>
        </Toolbar>
        <p className="studio-muted text-xs">Video và render cũ hơn 3 ngày tự động bị xoá (trừ mục đang dùng).</p>
        {!ready && <InlineNotice tone="warning">App chưa kết nối media worker.</InlineNotice>}
        {operation && (
          <TaskProgress
            label={operation.label}
            startedAt={operation.startedAt}
            percent={
              operation.total > 1 && operation.label !== "Xóa mục đã chọn"
                ? (operation.completed / operation.total) * 100
                : null
            }
            detail={`${operation.completed}/${operation.total} mục đã được worker xác nhận`}
          />
        )}
        {error && (
          <InlineNotice tone="error" role="alert">
            {workerErrorMessage(error)}
          </InlineNotice>
        )}
        {notice && (
          <InlineNotice tone="success" role="status">
            {notice}
          </InlineNotice>
        )}
        {library?.warnings.map((warning) => (
          <InlineNotice key={warning} tone="warning">
            {workerErrorMessage(warning)}
          </InlineNotice>
        ))}
        <TabsContent value="renders" forceMount hidden={tab !== "renders"}>
          {renderList(search)}
        </TabsContent>
        <TabsContent value={tab === "renders" ? "originals" : tab} forceMount hidden={tab === "renders"}>
          <p className="mt-3 text-xs text-muted-foreground">
            {tab !== "renders" && library ? sizeLabel(library.totals[tab]) : "—"} trong mục này.
          </p>
          <Toolbar className="mt-3">
            <Button
              variant="secondary"
              onClick={() => setSelected(new Set(available.map((file) => file.id)))}
              disabled={!available.length || working}
            >
              Chọn tất cả {available.length > 1 ? `(${available.length})` : ""}
            </Button>
            {selectedFiles.length > 0 && (
              <Button
                variant="destructive"
                onClick={() => void handleStorageAction(tab === "trash" ? "purge" : "move", selectedFiles)}
                disabled={working}
              >
                {working ? <Loader2 className="animate-spin" /> : <Trash2 />}{" "}
                {tab === "trash" ? "Xoá vĩnh viễn" : "Chuyển vào thùng rác"} ({selectedFiles.length})
              </Button>
            )}
          </Toolbar>
          <div className="studio-library-content-grid mt-3 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="studio-library-file-list max-h-[65vh] space-y-3 overflow-y-auto pr-1">
              {files.map((file) => (
                <Panel as="article" padding="sm" key={file.id} className="studio-library-card workspace-list-row">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${file.title} ${file.filename}`}
                      checked={selected.has(file.id)}
                      disabled={file.busy || working}
                      onChange={(event) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(file.id);
                          else next.delete(file.id);
                          return next;
                        })
                      }
                      className="size-4 shrink-0 accent-primary"
                    />
                    <span className="studio-library-file-icon" aria-hidden="true">
                      <Film size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold leading-6">{file.title}</p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {file.kind === "original"
                          ? "Video gốc"
                          : file.kind === "parts"
                            ? "Bộ Part"
                            : `Part ${file.part}`}{" "}
                        · {file.filename} · {sizeLabel(file.size)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {library?.storages.find((store) => store.id === file.storageId)?.label}
                        {file.deletedAt ? ` · Xoá lúc ${new Date(file.deletedAt).toLocaleString("vi-VN")}` : ""}
                      </p>
                      {!file.busy &&
                        (file.inUseByEditor ||
                          (file.storageId === "current" &&
                            file.kind === "original" &&
                            file.sourceId === editorSourceId)) && (
                          <StatusChip tone="warning" className="mt-2">
                            Nguồn đang dùng trong Editor.
                          </StatusChip>
                        )}
                      {file.busy && (
                        <StatusChip tone="warning" className="mt-2">
                          Đang xử lý — chưa thể xoá hoặc khôi phục.
                        </StatusChip>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tab !== "trash" ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setPreview(file);
                            setPreviewError("");
                          }}
                        >
                          <Play className="size-3.5" /> Xem
                        </Button>
                        <Button variant="secondary" size="sm" asChild>
                          <a
                            href={`${workerOrigin}/api/storage/media/${encodeURIComponent(file.id)}?download=1`}
                            download={file.filename}
                            className="studio-download"
                          >
                            <Download className="size-3.5" /> Tải file
                          </a>
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={working || file.busy}
                          onClick={() => void handleStorageAction("move", [file])}
                        >
                          <Trash2 className="size-3.5" /> Chuyển vào thùng rác
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={working || file.busy}
                          onClick={() => void handleStorageAction("restore", [file])}
                        >
                          <RotateCcw className="size-3.5" /> Khôi phục
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={working || file.busy}
                          onClick={() => void handleStorageAction("purge", [file])}
                        >
                          <Trash2 className="size-3.5" /> Xoá vĩnh viễn
                        </Button>
                      </>
                    )}
                  </div>
                </Panel>
              ))}
              {!files.length && (
                <EmptyState
                  icon={<FolderOpen />}
                  title={
                    loading
                      ? "Đang đọc kho video…"
                      : tab === "trash"
                        ? "Thùng rác đang trống."
                        : "Không có video phù hợp."
                  }
                  description={
                    loading ? "Vui lòng chờ trong giây lát." : "Chọn mục khác hoặc thay đổi từ khóa tìm kiếm."
                  }
                />
              )}
            </div>
            <Panel as="aside" className="lg:sticky lg:top-20">
              <PanelHeader>
                <h2 className="text-sm font-semibold">Xem trước file</h2>
              </PanelHeader>
              <PanelBody>
                {preview ? (
                  <>
                    <video
                      aria-label="Xem trước file trong kho"
                      ref={bindPreviewVideo}
                      key={preview.id}
                      src={`${workerOrigin}/api/storage/media/${encodeURIComponent(preview.id)}`}
                      controls
                      playsInline
                      preload="metadata"
                      onError={() => setPreviewError("File không còn ở kho đang lưu. Làm mới danh sách để kiểm tra.")}
                      onLoadedMetadata={() => setPreviewError("")}
                      className="mt-3 max-h-[360px] w-full rounded-xl bg-(--sample-black) object-contain"
                    />
                    <p className="mt-3 break-words text-xs leading-5">{preview.title}</p>
                    {previewError && (
                      <InlineNotice tone="error" className="mt-2">
                        {workerErrorMessage(previewError)}
                      </InlineNotice>
                    )}
                  </>
                ) : (
                  <EmptyState
                    icon={<Play />}
                    title="Chưa chọn video."
                    description="Chọn Xem trên một file trong danh sách."
                  />
                )}
              </PanelBody>
            </Panel>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
