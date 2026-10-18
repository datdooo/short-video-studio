# High-quality FHD export checkpoint

Output remains **1080 × 1920, 30 fps, H.264, yuv420p, MP4**. This refinement
changes compression defaults only. No canvas, source scaling, geometry, preset,
animation, transition, timeline, subtitle, audio or color-composition changes.

## Inspected settings and chosen defaults

| Setting | Phase 9 | New default |
| --- | --- | --- |
| Software encoder | libx264 | libx264 |
| Software rate control | CRF 18 | CRF 17 |
| Software preset | medium | medium |
| Software profile/level | Encoder automatic; observed High / 4.0 | Same |
| VideoToolbox encoder | h264_videotoolbox | Same |
| VT target / maximum / buffer | 12M / 16M / 24M | 16M / 20M / 32M |
| VT profile / level | High / 4.2 | Same |
| VT spatial AQ / realtime / allow_sw | 1 / 0 / 0 | Same |
| GOP/keyframes | No explicit `-g`, keyint or scene-cut override; encoder automatic | Same |
| Pixel format / range | yuv420p / limited (`tv`) | Same |
| Color space / primaries / transfer | bt709 / bt709 / bt709 | Same |
| Audio | AAC, 192 kbps; existing 48 kHz stereo pipeline | Same |
| Container | MP4, avc1 tag, faststart + write_colr | Same |

The application still prefers VideoToolbox on supported macOS and uses its
existing CPU fallback. VideoToolbox uses bitrate controls, not CRF. Local FFmpeg
encoder help confirms the existing profile/level/AQ/realtime/allow_sw options.
Existing explicit operator environment overrides remain supported. There is no
new quality selector, profile state, codec selector or advanced export panel.

Software uses quality-based encoding rather than a fixed bitrate floor: flat
frames legitimately need fewer bits. CRF remains uncapped and sizes depend on
content. The hardware target is moderate for vertical FHD; the maximum/buffer
are rate-control settings, not a promise of a fixed file size.

## Controlled comparison actually completed

Local evidence: `.isolation-verification/animation-offline-source-Bfr26r/`.
`rc-quality.mjs` in the ignored evidence directory evaluates the actual worker's
render functions to produce six lossless FFV1/YUV420P composed references. It then
compares Phase 9 encoding settings with the proposed defaults on those same frames.
This holds the corrected timeline and composition constant between encoders.

The deterministic source combines moving test patterns, fine grid detail and a
seeded green cellular texture as a foliage stress proxy. It is synthetic, not a
real farming/face-quality trial. Each reference has four retained ranges and
96 output frames. Cases: Current blur; Viral grain/Fade/Dip; News dark gradient/
REC/Pop/Flash; Farming JP vignette/Slide/Dip; Cinematic film frame/Flash; Bright
soft gradient/glow/Fade/Flash. Actual Japanese/Korean/mixed-script text is present.

All 24 comparison MP4s pass H.264, dimensions, 30 fps, frame-count and Rec.709
assertions. Duration and decoded AAC audio agree across profiles for each
reference. SSIM/PSNR compare decoded frame indices on a shared 1/30 time base;
MKV's millisecond-rounded timestamps must not be compared directly to MP4 PTS.

| Mean over six stress compositions | CPU CRF 18 | CPU CRF 17 | VT 12M | VT 16M |
| --- | ---: | ---: | ---: | ---: |
| SSIM | 0.991846 | 0.993148 | 0.958830 | 0.967746 |
| PSNR (dB) | 44.66 | 45.54 | 35.91 | 37.68 |
| Actual video bitrate (Mbps) | 18.13 | 19.70 | 11.23 | 14.02 |
| File size extrapolated (MiB/min) | 131.17 | 142.39 | 81.79 | 101.70 |
| Title-region mean absolute RGB error | 0.827 | 0.748 | 2.699 | 2.020 |
| Subtitle-region mean absolute RGB error | 1.740 | 1.568 | 3.811 | 2.955 |

Software size increases approximately 8.6%; hardware approximately 24.3% in this
deliberately difficult synthetic set. Visual inspection of reference/old/new
title, subtitle and fine-grid crops supports improved retention, particularly
VideoToolbox edge/grid cleanliness. CPU gains are smaller because CRF 18 was
already strong. No pixel parity between different encoders is claimed.

Three interleaved encode repeats of one 3.2-second composed reference, with no
other QA/browser work running, measured:

| Encoder settings | Mean encode time |
| --- | ---: |
| CPU 18 / medium | 1.457 s |
| CPU 17 / medium | 1.438 s |
| VT 12M | 0.673 s |
| VT 16M | 0.677 s |

Differences are within short-run variation (hardware +0.7%); software's apparent
speedup is not a throughput claim. These are encode-only timings, not full-job
performance. Evidence: `rc-quality-summary.json`, `rc-quality-performance.json`,
`rc-quality-crops.png` and the reference directory's `quality-result.json`.

## Qualification boundary / limitations

The settings comparison is complete, but the default changes still require a
fresh DEV package and actual application/default-worker render checks. The bundle
currently on disk predates these new defaults. Full RC qualification is pending;
see [final-visual-editor-qualification.md](final-visual-editor-qualification.md).

Eight-bit H.264 does not eliminate banding, and difficult moving grain/textures
remain harder for VideoToolbox than software. Real camera/face footage, social
platform re-encoding, Windows and every encoder have not been qualified here.
No VMAF dependency was added; PSNR/SSIM supplement visual inspection. No 4K/2K,
HEVC, AV1, HDR, 10-bit default, AI enhancement, sharpening, denoising, added grain
or new rendering subsystem was introduced.
