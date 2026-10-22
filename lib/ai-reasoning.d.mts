export type ReasoningEffort='none'|'minimal'|'low'|'medium'|'high'|'xhigh'|'max'|'ultra';
export const REASONING_POLICY_VERSION:string;
export function reasoningCapabilities(model?:Record<string,unknown>):ReasoningEffort[]|undefined;
export function lowestReasoning(model:string,metadata?:Record<string,unknown>,adapter?:string):{effort:ReasoningEffort;source:string;key:string};
export const ANALYSIS_MODEL:'gpt-6.1-sol';

export const ANALYSIS_REASONING:'low';
export function videoReasoning():{effort:'low';source:string;key:string};
