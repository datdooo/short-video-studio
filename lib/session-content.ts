import type { EditorSession } from "./editor-session";
// Ignore generated preview/mock plans and layout-only settings in a new session.
export function hasSessionContent(data: Partial<EditorSession>): boolean {
  return !!(data.hasEditPlan || data.sourceCaptions || data.webAiContext || data.batchEditing || data.batchDraftItem ||
    Object.keys(data.controls || {}).length ||
    [data.sourceId, data.sourceUrl, data.localFileName, data.localDraftId, data.sourceTitle, data.transcript,
      data.instruction, data.supplementalPrompt, data.batchUrls, data.renderJobId, data.batchId,
      data.manualPart1Title, data.manualPart2Title, data.manualPart1Ranges, data.manualPart2Ranges,
      data.webAiPrompt, data.webAiResult].some(value => typeof value === "string" && value.trim()));
}
