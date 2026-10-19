import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { normalizeSourceContext, computeSourceCacheKey, normalizeComments, commentSignalsUnavailable } from '../lib/source-context/index.mjs';
import { youtubeUrl } from './youtube-common.mjs';
import { createSharedOperations } from './shared-operation.mjs';
import { COMMENT_TIMEOUT_MS } from './youtube-downloader.mjs';

// Acquisition is explicit. Loading/previewing/rendering a saved source never calls this.
export function sourceContextFor(source) {
  const base = normalizeSourceContext({ sourceId: source.id, kind: source.kind === 'youtube' ? 'youtube' : 'local',
    url: source.sourceUrl, title: source.title, durationSeconds: source.duration, width: source.width, height: source.height });
  try {
    if (source.sourceContext && computeSourceCacheKey(source.sourceContext) === computeSourceCacheKey(base)) {
      const context = normalizeSourceContext(source.sourceContext);
      context.source = { ...base.source };
      return context;
    }
  } catch { /* Invalid serialized identity is not trusted. */ }
  return base;
}

export async function saveSourceContext(directory, context) {
  const file = path.join(directory, 'source.json');
  const current = JSON.parse(await readFile(file, 'utf8'));
  await atomicJson(file, { ...current, sourceContext: context });
}

async function atomicJson(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: 'wx' }); await rename(temporary, file); }
  finally { await rm(temporary, { force: true }); }
}

// No transient raw URLs, credentials, or source media are cached here.
export function createSourceContextService({ youtube, cacheRoot, timeouts = {} }) {
  const shared = createSharedOperations();
  async function enrich(base, comments, signal) {
    const key = computeSourceCacheKey(base), file = path.join(cacheRoot, createHash('sha256').update(key).digest('hex') + '.json');
    let context = base;
    try {
      const cached = JSON.parse(await readFile(file, 'utf8'));
      if (computeSourceCacheKey(cached) === key) context = normalizeSourceContext(cached);
    } catch { /* Missing/malformed cache is optional. */ }
    const fields = () => context.provenance.fields;
    if (!fields().contextMetadata) {
      const timeout = AbortSignal.timeout(timeouts.metadata ?? 60_000);
      const bounded = AbortSignal.any([signal, timeout]);
      try {
        const extracted = await youtube.context(base.source.url, bounded);
        bounded.throwIfAborted();
        if (extracted?.metadata?.videoId === youtubeUrl(base.source.url).id) {
          context = normalizeSourceContext({ ...context, metadata: { ...context.metadata, ...extracted.metadata },
            chapters: extracted.chapters, descriptionMarkers: extracted.descriptionMarkers,
            comments: extracted.provenance.fields.contextComments ? extracted.comments : context.comments,
            provenance: { ...extracted.provenance, fields: { ...fields(), ...extracted.provenance.fields } } });
        } else throw new Error('Metadata unavailable');
      } catch {
        signal.throwIfAborted();
        fields().contextMetadata = timeout.aborted ? 'timeout' : 'unavailable';
      }
    }
    if (comments && !fields().contextComments) {
      const timeout = AbortSignal.timeout(timeouts.comments ?? COMMENT_TIMEOUT_MS);
      const bounded = AbortSignal.any([signal, timeout]);
      try {
        const info = await youtube.comments(base.source.url, bounded);
        bounded.throwIfAborted();
        if (info.id && info.id !== youtubeUrl(base.source.url).id) throw new Error('Source mismatch');
        context.comments = normalizeComments(info, { durationMs: base.source.durationMs });
        fields().contextComments = 'yt-dlp';
      } catch {
        signal.throwIfAborted();
        context.comments = commentSignalsUnavailable({}, timeout.aborted ? 'comment-timeout' : 'comment-retrieval-failed');
        fields().contextComments = timeout.aborted ? 'timeout' : 'unavailable';
      }
    }
    signal.throwIfAborted();
    // Bind each imported media record independently even when a YouTube cache is reused.
    context.source = { ...base.source };
    context.metadata.durationSeconds = base.source.durationSeconds;
    try { await mkdir(cacheRoot, { recursive: true, mode: 0o700 }); await atomicJson(file, context); }
    catch { /* A read-only cache must not prevent analysis/import. */ }
    signal.throwIfAborted();
    return context;
  }
  return {
    async ensure(source, { signal, comments = false } = {}) {
      signal?.throwIfAborted();
      const base = sourceContextFor(source);
      if (base.source.kind === 'local') return base;
      // Canonical URL validation occurs before any cache/network use.
      base.source.url = youtubeUrl(source.sourceUrl).url;
      const key = computeSourceCacheKey(base);
      let context = await shared(key, active => enrich(base, comments, active), signal);
      // A simultaneous metadata-only import may have owned the first operation.
      if (comments && !context.provenance.fields.contextComments) {
        context = await shared(key, active => enrich(context, true, active), signal);
      }
      const result = structuredClone(context);
      result.source = { ...base.source };
      return result;
    },
  };
}
