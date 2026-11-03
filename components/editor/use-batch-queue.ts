"use client";
import { WORKER_ORIGIN, type BatchJob } from "@/lib/api/worker-client";
import { createBatchDownloadQueue } from "@/lib/batch-downloads.mjs";
import { type EditorSession } from "@/lib/editor-session";
import { useEffect, useRef, useState } from "react";
export function useBatchQueue() {
  const [batchUrls, setBatchUrls] = useState("");
  const [batch, setBatch] = useState<BatchJob | null>(null);
  const [batchEditing, setBatchEditing] = useState<{ batchId: string; itemId: string; sourceId: string } | null>(null);
  const [batchDraftItem, setBatchDraftItem] = useState<EditorSession["batchEditing"]>(null);
  const [pastBatches, setPastBatches] = useState<BatchJob[]>([]);
  const [selectedBatchPreviewKey, setSelectedBatchPreviewKey] = useState("");
  const [batchPreviewError, setBatchPreviewError] = useState("");
  const [batchId, setBatchId] = useState("");
  const [batchPollVersion, setBatchPollVersion] = useState(0);
  const batchPollEpoch = useRef(0);
  const batchSubmitPending = useRef(false);
  const [isStartingBatch, setIsStartingBatch] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [isStoppingBatch, setIsStoppingBatch] = useState(false);
  const [deletingBatchItems, setDeletingBatchItems] = useState<string[]>([]);
  const [batchNotice, setBatchNotice] = useState("");
  const deletedBatchItems = useRef(new Set<string>());
  const [resumingBatchItems, setResumingBatchItems] = useState<string[]>([]);
  const [autoDownloadRequests, setAutoDownloadRequests] = useState(0);
  const [autoDownloadError, setAutoDownloadError] = useState("");
  const batchDownloadQueue = useRef<ReturnType<typeof createBatchDownloadQueue> | null>(null);
  useEffect(() => {
    const historyKey = "shortcut-beta-auto-download-requests";
    let history: Set<string>;
    try {
      const saved = JSON.parse(localStorage.getItem(historyKey) || "[]");
      history = new Set(Array.isArray(saved) ? saved : []);
    } catch {
      history = new Set();
    }
    const frames = new Set<HTMLIFrameElement>();
    const cleanupTimers = new Set<ReturnType<typeof setTimeout>>();
    const queue = createBatchDownloadQueue({
      hasRequested: (key) => history.has(key),
      markRequested: (key) => {
        history.add(key);
        try {
          localStorage.setItem(historyKey, JSON.stringify([...history].slice(-2000)));
        } catch {
          /* In-memory deduplication still works. */
        }
      },
      requestDownload: (output) => {
        if (!output.url.startsWith("/files/")) throw new Error("Đường dẫn tải video không hợp lệ.");
        const frame = document.createElement("iframe");
        frame.hidden = true;
        frame.title = `Tự động tải ${output.filename}`;
        frame.src = `${WORKER_ORIGIN}${output.url}`;
        document.body.appendChild(frame);
        frames.add(frame);
        const timer = setTimeout(() => {
          frame.remove();
          frames.delete(frame);
          cleanupTimers.delete(timer);
        }, 60_000);
        cleanupTimers.add(timer);
      },
      onRequested: () => setAutoDownloadRequests((count) => count + 1),
      onError: () => setAutoDownloadError("Không gửi được yêu cầu tải tự động. Dùng nút Tải lại bên dưới."),
    });
    batchDownloadQueue.current = queue;
    return () => {
      queue.dispose();
      batchDownloadQueue.current = null;
      cleanupTimers.forEach(clearTimeout);
      frames.forEach((frame) => frame.remove());
    };
  }, []);
  return {
    batchUrls,
    setBatchUrls,
    batch,
    setBatch,
    batchEditing,
    setBatchEditing,
    batchDraftItem,
    setBatchDraftItem,
    pastBatches,
    setPastBatches,
    selectedBatchPreviewKey,
    setSelectedBatchPreviewKey,
    batchPreviewError,
    setBatchPreviewError,
    batchId,
    setBatchId,
    batchPollVersion,
    setBatchPollVersion,
    batchPollEpoch,
    batchSubmitPending,
    isStartingBatch,
    setIsStartingBatch,
    batchError,
    setBatchError,
    isStoppingBatch,
    setIsStoppingBatch,
    deletingBatchItems,
    setDeletingBatchItems,
    batchNotice,
    setBatchNotice,
    deletedBatchItems,
    resumingBatchItems,
    setResumingBatchItems,
    autoDownloadRequests,
    setAutoDownloadRequests,
    autoDownloadError,
    setAutoDownloadError,
    batchDownloadQueue,
  };
}
