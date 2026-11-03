# UI language

Controls, statuses and actionable errors use Vietnamese. Proper names (YouTube,
ChatGPT, Gemini, Muse, FFmpeg), familiar workspace names (Editor/Batch), model IDs
and persisted preset names may remain unchanged. Preset IDs are never translated.
Shared control vocabulary lives in `lib/ui-strings.ts`; provider-specific
technical details remain in collapsed diagnostics. Text returned from the source
is not UI copy and retains its content language. The app intentionally uses a
charcoal/orange dark-only palette; forced-colors and reduced-motion are supported.
