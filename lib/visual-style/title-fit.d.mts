import type { VisualStyle } from "./types";
export type TitleFit = { text: string; lines?: string[]; fontSize: number; lineSpacing: number; lineCount: number; maxLines: number; truncated: boolean };
export function needsMeasuredTitleFit(style: Pick<VisualStyle, "originalTitle" | "partTitle">): boolean;
export function constrainTitlePair(original: string, part: string, pair: { original: TitleFit; part: TitleFit }, measure: (text: string, size: number, role: "original" | "part") => number | Promise<number>): Promise<{ original: TitleFit; part: TitleFit }>;
