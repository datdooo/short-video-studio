// Output-side FFmpeg options only: disable implicit metadata/chapter mapping
// from every input, including source video, images and background music.
// Filter labels [vout]/[aout] are the sole mapped streams in renderPart.
export const EXPORT_METADATA_POLICY = 'rendered-av-no-source-metadata-v1';
export const EXPORT_METADATA_ARGS = Object.freeze([
  '-map_metadata', '-1',
  '-map_metadata:s', '-1',
  '-map_chapters', '-1',
  '-sn', '-dn',
]);

// Internal history bookkeeping, never embedded in the MP4. This records which
// command policy produced a file; it is not ffprobe/forensic verification.
export function requireCurrentExportPolicy(job) {
  if (job.metadataPolicy !== EXPORT_METADATA_POLICY) {
    throw Object.assign(new Error('Job cũ chưa áp dụng chính sách metadata mới. Xuất thành job mới; file cũ được giữ nguyên, không được coi là đã làm sạch.'), {status:409});
  }
}
