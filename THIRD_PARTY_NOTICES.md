# Selected source reuse

## MR.HiSum

Authors: **Jinhwan Sul, Jihoon Han, Joonseok Lee**.
Source: https://github.com/MRHiSum/MR.HiSum
Inspected revision: `aeb667f71239887034c2974062a341d312762867`.

**Được tác giả cấp phép riêng để tái sử dụng toàn bộ project, theo xác nhận của
chủ dự án.** The owner confirms attribution in this repository is sufficient;
no in-product or exported-video credit is required under that separate grant.
The owner retains the correspondence privately; it is not included here.
This does not assert that upstream's public license has changed.

Reused/adapted: `preprocess/preprocess.py::align_most_replayed` to
`lib/replay-alignment.mjs::alignReplayToSource`, using the owner-provided
`personalproject` copy. JavaScript, bounded sampling, variable-width normalized
source bins, explicit null gaps; no fixed100-bin clamp, dataset or model weights.
Original notices and detailed record: [third_party/mr-hisum](third_party/mr-hisum/README.md).

## MomentSearch

Copyright 2026 Traversaal.ai. Source: https://github.com/traversaal-ai/momentsearch
Revision: `875b55fd6b01da85907e77f9b441893831362313`; Apache-2.0.

Reused/adapted: `src/ingest/transcript.py::chunk_cues` to
`lib/teaser-evidence.mjs::chunkTimedCues`: JavaScript, exact source cue IDs,
chapter/gap boundaries. No model, vector DB, Python service or score threshold.
Original [LICENSE](third_party/momentsearch/LICENSE), [NOTICE](third_party/momentsearch/NOTICE)
and [change record](third_party/momentsearch/README.md) retained.

## VideoITG (consulted only)

https://github.com/NVlabs/VideoITG @ `50a60a822c0e362bfd8747c45ba34e66e9c9d650`.
Read `infer.py`, README, requirements, Apache-2.0 code license and separate
NVIDIA research/non-commercial model license. Coarse region discovery followed
by localized frames informed the architecture; **no code/model copied**.
Its CUDA/8B inference stack is not installed or bundled.

Other existing third-party notices/licenses remain in `third_party/` and the
packaged runtime licenses. This document does not replace their obligations.
