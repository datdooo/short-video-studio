# Beta render: remove redundant work, retain output settings

Source changes on `beta/maintenance`, base
`4fd5e4e402e6445b837e0522a169beaf16c82ac4`. Target package: Beta build 1104.
The actual package result and source commit are recorded in the build handoff.

## Confirmed source findings and changes

- `worker/server.mjs::renderPart`: static titles without
  `current-title-glow-shine` still generated a transparent full-canvas shine PNG,
  decoded it at 30fps, cropped it, evaluated its per-pixel alpha and composited it
  on every frame. Omit that asset/input/filter branch when neither title uses
  shine and title animation is off. Keep actual shine and the animated-title
  graph unchanged, including its existing RGB/alpha grouping. Allocate subtitle,
  gradient, scene and transition input indices in the same order as argv so an
  omitted shine input cannot shift an overlay onto the wrong stream. BGM still
  derives its input index from the actual argv.
- `worker/media-resources.mjs::balancedFfmpegArgs`: final `renderPart` commands
  explicitly request a bounded two-thread complex-filter pool. Other commands
  retain one filter thread. Decoder two threads, encoder two threads, input
  queues, OS priority, one export lane and one serial editor lane are unchanged.
  Health/job resource profile is `balanced-m2-editor-v3`, with
  `renderFilterComplexThreads: 2` in health. A thread pool can increase CPU/RAM
  usage; no throughput or responsiveness improvement has been measured.
- Static PNG inputs (title, actual shine, gradient, animated scene and transition
  atlas) now decode once and repeat one cached frame with
  `loop=loop=-1:size=1:start=0,setpts=N/(30*TB)`. Input `-framerate 30` is retained;
  input `-loop 1` is removed for these images only. The existing motion/crop/shine
  expressions still run on that same 30fps clock. Source footage, subtitle
  ffconcat sequences and all A/V range assembly are untouched. The loop stores
  one decoded frame per static input, not an entire video. The packaged FFmpeg
  capability help confirms loop/size/start support; no media was processed.

Keep the current blur recipe (270x480, boxblur 12:2, then upscale), foreground
geometry/zoom, filter math, 1080x1920/30fps, 1.25x export clock, captions,
transitions, BGM/ducking, AAC 192k, Rec.709 and VideoToolbox/x264 quality settings.
Default video target 12M, maxrate 14M and buffer 24M remain. No faster encoder
preset, realtime mode or lower-resolution effect was substituted. Output
validation, cancellation, source protection and existing completed files remain.

FFmpeg documents `filter_complex_threads` as a complex-graph thread count, not a
quality setting: [official source documentation](https://github.com/FFmpeg/FFmpeg/blob/master/doc/ffmpeg.texi).
This does not establish bit-identical encoded files or measured visual equality.
The additional optimization follows the documented single-frame loop example
and the upstream implementations: [loop documentation](https://github.com/FFmpeg/FFmpeg/blob/master/doc/filters.texi),
[decoded-frame reference reuse](https://github.com/FFmpeg/FFmpeg/blob/master/libavfilter/f_loop.c),
[image demuxer loop reads](https://github.com/FFmpeg/FFmpeg/blob/master/libavformat/img2dec.c).
These are implementation references, not external benchmark results for this app.

## Template comparison limits

Clean Tutorial and Korean Tutorial have no scene decoration or actual shine and
are reasonable lightweight choices; they mostly differ in typography. All stock
templates still use source blur. Nonanimated scene decoration is precomposited
into the title asset once per part, so counting decorations alone does not rank
per-frame cost. Current uses the legacy YUV color path but has actual shine;
other templates use the RGB color path. Source inspection alone cannot establish
a fastest template. Title animation and cut transitions are independent controls
retained when changing template. Caption count, ranges, source codec and editor
activity also affect time. No benchmark percentage or fastest-template claim.

## Not run / manual acceptance

No tests, separate lint/typecheck, browser automation, AI, ASR, download or render.
Source/diff review (`git diff --check`), official documentation reading and one
authorized build/package with its normal guards. Build result is separate from
runtime acceptance. The running installed Beta is preserved; only the release
bundle is replaced after successful package/native audit/codesign. DEV and user
media/exports/drafts are untouched.

After an authorized build, compare the same job/settings on old/new apps. Check
static no-shine templates with subtitles on/off, gradient and source-blur,
transitions/BGM; then Current shine and each title animation. Inspect cut/text
boundaries, colors, audio and durations. Measure total time, CPU, memory/swap and
editor playback on M2 8GB. Check cancel and CPU fallback without deleting prior
completed output. No runtime or quality acceptance is claimed here.
