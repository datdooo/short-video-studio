export type PreviewClock = {
 timeRef: { current: number };
 getSnapshot: () => number;
 getServerSnapshot: () => number;
 subscribe: (listener: () => void) => () => void;
 setTime: import('react').Dispatch<import('react').SetStateAction<number>>;
 dispose: () => void;
};
export function createPreviewClock(): PreviewClock;
