# Foreground warm cloud light leak v2 — checkpoint

Reference: https://www.youtube.com/watch?v=DnupAgEfzPM (sportsteve24).
Browser playback/frames inspected: initial green/cyan pass around27–28s; hue/settings
around54–58s warm yellow/orange/red; intensity adjustment around65s. User explicitly
selected the54–58s warm variant. Provided screenshots are reference only, never assets.

Original local cloud-field sprite (`public/effects/warm-cloud-leak-v2.png`,~764KiB,
216×270×19frames), generator `scripts/generate-vr-light-leak.mjs`. Continuous multiscale
flow/overlapping soft blooms, warm yellow/red/magenta palette, sin² entry/exit. No Adobe
code/footage/asset extracted. This is an approximation, not Adobe algorithm/exact parity.

New hookTransition ID `vr-light-leak-v2` preserves the600ms independent hook window;
ordinary Dip/Flash internal cuts retain400ms. Legacy `rainbow-light-leak` keeps its old
saved behavior; no queued snapshot is silently migrated. Only newly introduced hook
policies default to v2; existing explicit choices remain explicit.

Export: cut/grade → foreground scale/pad/crop → sprite screen blend → original alpha
restored → vertical background composite → decorations/titles/subtitles/part labels.
Transparent native-size padding does not receive bloom. Preview uses the same sprite,
frame selection and even-size foreground clip, nested inside an isolated foreground
container. No per-pixel procedural loop for v2 on the UI thread, no video remount/AI/job.
One browser-decoded cached sprite; changing controls chooses a CSS frame only.

`qa-adaptive-teaser.mjs` lossless control:0 changed pixels outside visible source rect;
text matches because drawn after effect. Actual two-part FHD smoke passed exact final
frames/subtitle repetition/audio tails. Real source editor normal-speed boundary playback and screenshot passed scope observation;
72 unique decoded preview frames have regular30fps PTS. Controls/seek/workspaces
remained responsive during this bounded test. Packaged runtime/sprite smoke passed.
There is no quantitative M2 dropped-frame benchmark or fresh native packaged-browser
interaction proof. Warm palette/plumes resemble the chosen reference; plume structure,
exposure evolution and fixed timing differ. Unit tests alone do not prove parity. Reference demonstrates a clip-entry effect; this
implementation centers its fixed600ms envelope at hook→main without removing footage.
