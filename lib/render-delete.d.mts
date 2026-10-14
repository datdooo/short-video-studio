export function completedRenderJobs<T extends { sourceId: string; state: string; stopping?: boolean }>(jobs: T[]): T[];
