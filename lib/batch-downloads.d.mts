export type BatchDownload = { key: string; filename: string; url: string };
export type DownloadBatch = {
  id: string;
  items: Array<{ job?: { id: string; outputs: Array<{ part: number; filename: string; url: string }> } | null }>;
};
export function collectBatchDownloads(batch: DownloadBatch): BatchDownload[];
export function createBatchDownloadQueue(options: {
  hasRequested: (key: string) => boolean;
  markRequested: (key: string) => void;
  requestDownload: (output: BatchDownload) => void;
  onRequested?: (output: BatchDownload) => void;
  onError?: (error: unknown) => void;
  interval?: number;
}): { enqueue: (outputs: BatchDownload[]) => void; remove: (keys: string[]) => void; dispose: () => void };
