// These names identify released contracts; do not renumber historical entries.
export const PROMPT_VERSIONS = Object.freeze({
  web: Object.freeze({ current: 'external-editing-full-media-compact-v25', legacy: Object.freeze([
    'external-editing-full-media-compact-v19', 'external-editing-full-media-compact-v20',
    'external-editing-full-media-compact-v21', 'external-editing-full-media-compact-v22',
    'external-editing-full-media-compact-v23', 'external-editing-full-media-compact-v24',
  ]) }),
  hook: Object.freeze({ current: 'same-part-hook-v12-text-reselection', legacy: 'same-part-hook-v1', adaptiveLegacy: Object.freeze([
    'same-part-hook-v10-evidence-discovery', 'same-part-hook-v9-ranked-selection',
    'same-part-hook-v8-timing-provenance', 'same-part-hook-v7-complete-speech',
    'same-part-hook-v6-impact-evidence', 'same-part-hook-v5-vietnamese',
    'same-part-hook-v4-part-arc', 'same-part-hook-v3-editorial',
  ]) }),
});
export const WEB_AI_COMPATIBLE_PROMPT_VERSIONS = Object.freeze([...PROMPT_VERSIONS.web.legacy, PROMPT_VERSIONS.web.current]);
export const ADAPTIVE_HOOK_PROMPT_VERSIONS = Object.freeze([PROMPT_VERSIONS.hook.current, ...PROMPT_VERSIONS.hook.adaptiveLegacy]);
