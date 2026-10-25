export const CONTENT_LANGUAGE_VERSION:'source-language-v1';
export const CONTENT_LANGUAGE_SCHEMA:Readonly<{type:'string';description:string}>;
export const CONTENT_LANGUAGE_INSTRUCTIONS:string;
export function normalizeLanguageCode(value:unknown):string;
export function knownContentLanguage(value:unknown):string;
export function sourceContentLanguage(source?:{language?:string;captionWarning?:string;captionTrackId?:string}|null):string;
export function contentLanguageSchema(expected?:unknown):{type:'string';description:string;enum?:string[]};
export function assertContentLanguage(actual:unknown,expected?:unknown):string;
