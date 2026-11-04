"use client";
import { workerFetch, type RenderJob } from "@/lib/api/worker-client";
import { retainEqualJobs } from "@/lib/render-job-summary.mjs";
import { useEffect, useRef, useState } from "react";
export function useRenderJobs() {
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const [editorRenderJobs, setEditorRenderJobs] = useState<RenderJob[]>([]);
  const [editorRenderError, setEditorRenderError] = useState("");
  const [editorRenderNotice, setEditorRenderNotice] = useState("");
  const [deletingRenderIds, setDeletingRenderIds] = useState<string[]>([]);
  const [deletingAllRenders, setDeletingAllRenders] = useState(false);
  const deletingAllPending = useRef(false);
  const deletedEditorJobs = useRef(new Set<string>());
  const editorMutationEpoch = useRef(0);
  const [stoppingRenderIds, setStoppingRenderIds] = useState<string[]>([]);
  const [editorRenderPollError, setEditorRenderPollError] = useState("");
  const renderSubmissionPending = useRef(false);
  const [isStartingRender, setIsStartingRender] = useState(false);
  const removedMediaUrls = useRef(new Set<string>());
  useEffect(() => {
    let active = true;
    let pending = false;
    let timer: number;
    let delay = 5_000;
    const controller = new AbortController();
    const poll = async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      const epoch = editorMutationEpoch.current;
      try {
        const response = await workerFetch(`/api/editor-renders?compact=1`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as { jobs?: RenderJob[]; error?: string };
        if (!response.ok || !data.jobs) throw new Error(data.error || "Không đọc được danh sách render.");
        if (active && epoch === editorMutationEpoch.current) {
          const jobs = data.jobs
            .filter((job) => !deletedEditorJobs.current.has(job.id))
            .map((job) => ({
              ...job,
              outputs: job.outputs.filter((output) => !removedMediaUrls.current.has(output.url)),
            }));
          delay = jobs.some((job) => job.state === "queued" || job.state === "rendering") ? 1_200 : 5_000;
          setEditorRenderJobs((current) => retainEqualJobs(current, jobs));
          setRenderJob((current) =>
            current
              ? (() => {
                  const next = jobs.find((job) => job.id === current.id);
                  return next ? retainEqualJobs(current, next) : current;
                })()
              : null,
          );
          setEditorRenderPollError("");
        }
      } catch (caughtError) {
        if (active)
          setEditorRenderPollError(
            caughtError instanceof Error ? caughtError.message : "Mất kết nối với media worker.",
          );
      } finally {
        pending = false;
        if (active) timer = window.setTimeout(poll, delay);
      }
    };
    void poll();

    const onVisible = () => {
      if (document.visibilityState !== "hidden") {
        window.clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(timer);
    };
  }, []);
  return {
    renderJob,
    setRenderJob,
    editorRenderJobs,
    setEditorRenderJobs,
    editorRenderError,
    setEditorRenderError,
    editorRenderNotice,
    setEditorRenderNotice,
    deletingRenderIds,
    setDeletingRenderIds,
    deletingAllRenders,
    setDeletingAllRenders,
    deletingAllPending,
    deletedEditorJobs,
    editorMutationEpoch,
    stoppingRenderIds,
    setStoppingRenderIds,
    editorRenderPollError,
    setEditorRenderPollError,
    renderSubmissionPending,
    isStartingRender,
    setIsStartingRender,
    removedMediaUrls,
  };
}
