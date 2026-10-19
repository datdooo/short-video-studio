export type MainAnalysis = {
  version: string; sourceId: string; sourceKey: string; method: string; provider: string; model: string;
  fallbackReason?: string; recipeId: string; analysisKey?: string; cacheKey?: string; localCacheKey?: string;
  scoreSemantics: string; limitations: string[];
  structural: { coverage:number; balance:number };
  parts: { id:number; reason:string; signals:Record<string,{contribution:number;evidence:number[];detail:string}> }[];
};
