# MR.HiSum limited reuse

- Upstream: https://github.com/MRHiSum/MR.HiSum
- Inspected commit: `aeb667f71239887034c2974062a341d312762867`.
- Owner-provided source: `personalproject/preprocess/preprocess.py`, matching
  the corresponding file in the provided MR.HiSum ZIP. No private messages copied.
- Permission status: **Được tác giả cấp phép riêng để tái sử dụng toàn bộ project, theo xác nhận của chủ dự án.**
  (2026-10-21). The owner retains the correspondence privately. This record does
  not claim the upstream public license changed or grant rights to other users.
- Authors: Jinhwan Sul, Jihoon Han, Joonseok Lee. Attribution is in the repository; no product/video credit is added.
- Original public LICENSE retained as provenance, without claiming it changed. The owner confirms the separate grant covers the full project; permission is not pending.
- Adapted component: `align_most_replayed` ->
  `lib/replay-alignment.mjs::alignReplayToSource`.
- Changes: JS, actual normalized variable-width source bins, no100-bin clamp,
  no extrapolation across missing bins, <=4096 time samples. Values remain
  relative replay interest; never viewer counts/retention or a final teaser rank.
- No dataset/media, training code, PyTorch, model weights, HDF5 or knapsack
  summarizer included. Other baseline models and their licenses are not reused.
