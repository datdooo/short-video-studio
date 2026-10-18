import type { CSSProperties } from "react";
import type { TextStyle } from "./types";
import type { SubtitleStyle } from "../subtitles.mjs";
export function textPreviewCss(style: TextStyle, text: string, scale?: number, role?: string): CSSProperties;
export function subtitlePreviewCss(style: SubtitleStyle, text: string, scale?: number): CSSProperties;
export function escapeTextXml(value: unknown): string;
export function styledTextSvg(lines: string[], options: { fontFamily: string; fontSize: number; firstBaseline: number; lineHeight: number; roundBaseline?: boolean; style: TextStyle }): string;
