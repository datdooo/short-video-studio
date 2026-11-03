"use client";
import { EditorRenderList } from "@/components/editor-render-list";
import { MediaLibraryPanel, type LibraryFile } from "@/components/media-library-panel";
import { WORKER_ORIGIN, type RenderJob, type WorkerHealth } from "@/lib/api/worker-client";

type Props = {
  deleteAllEditorRenders: () => Promise<void>;
  deleteEditorRender: (job: RenderJob, confirmed?: boolean) => Promise<boolean>;
  deletingAllRenders: boolean;
  deletingRenderIds: string[];
  editorRenderError: string;
  editorRenderJobs: RenderJob[];
  editorRenderNotice: string;
  editorRenderPollError: string;
  editorSourceId: string;
  ensureEditorSource: () => Promise<void>;
  libraryMoved: (file: LibraryFile) => void;
  libraryRestored: (file: LibraryFile) => void;
  stoppingRenderIds: string[];
  stopRender: (job: RenderJob) => Promise<void>;
  workerHealth: WorkerHealth | null;
};
export function StorageView({ model }: { model: Props }) {
  const {
    deleteAllEditorRenders,
    deleteEditorRender,
    deletingAllRenders,
    deletingRenderIds,
    editorRenderError,
    editorRenderJobs,
    editorRenderNotice,
    editorRenderPollError,
    editorSourceId,
    ensureEditorSource,
    libraryMoved,
    libraryRestored,
    stoppingRenderIds,
    stopRender,
    workerHealth,
  } = model;

  return (
    <section className="studio-library-workspace">
      <MediaLibraryPanel
        editorSourceId={editorSourceId}
        ensureEditorSource={ensureEditorSource}
        workerOrigin={WORKER_ORIGIN}
        ready={Boolean(workerHealth?.ok)}
        onMoved={libraryMoved}
        onRestored={libraryRestored}
        renderCount={editorRenderJobs.length}
        renderList={(query) => (
          <EditorRenderList
            query={query}
            jobs={editorRenderJobs}
            stopping={stoppingRenderIds}
            deleting={deletingRenderIds}
            deletingAll={deletingAllRenders}
            error={editorRenderError || editorRenderPollError}
            notice={editorRenderNotice}
            origin={WORKER_ORIGIN}
            onStop={(job) => void stopRender(job)}
            onDelete={(job) => void deleteEditorRender(job)}
            onDeleteAll={() => void deleteAllEditorRenders()}
          />
        )}
      />
    </section>
  );
}
