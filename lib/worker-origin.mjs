// NEXT_PUBLIC_MEDIA_WORKER_ORIGIN is exposed at build time by Next/vinext.
export function resolveWorkerOrigin(value = "http://127.0.0.1:8787") {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)
    || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_MEDIA_WORKER_ORIGIN must be a local HTTP origin without a path.");
  }
  return url.origin;
}
