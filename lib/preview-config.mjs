import {PLAYBACK_RATE} from './render-config.mjs';
// Editor clock only. Export quality/policy continue using PLAYBACK_RATE=1.25.
export const PREVIEW_RATE=1;
export const PREVIEW_TIMEBASE='presentation-1x-v1';
export const PREVIEW_MIX_VERSION='music-mix-v5-vad-sidechain-1x';
// Existing transition windows/title animations are authored in export seconds.
// Map the same edited footage position; do not alter source endpoints or presets.
export const previewToExportTime=seconds=>seconds*PREVIEW_RATE/PLAYBACK_RATE;
