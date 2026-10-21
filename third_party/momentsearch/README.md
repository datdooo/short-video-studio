# MomentSearch reuse

- Upstream: https://github.com/traversaal-ai/momentsearch
- Inspected commit: `875b55fd6b01da85907e77f9b441893831362313`.
- License: Apache-2.0; original LICENSE and NOTICE retained here.
- Adapted source: `src/ingest/transcript.py::chunk_cues` ->
  `lib/teaser-evidence.mjs::chunkTimedCues`.
- Changes: JavaScript, exact source cue IDs/provenance, chapter/gap boundaries;
  no diarization, Python, Qdrant, FastAPI, database, embeddings or new providers.
- `src/rag/search.py` and `src/rag/rerank.py` consulted for neighboring evidence
  and separate modalities; their confidence gates/RRF/reranker were NOT copied.
  ChatGPT ranks teasers; no absolute local appeal threshold.
