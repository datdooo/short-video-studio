import type { EditPlan } from "@/lib/edit-plan";
import { stripBlocks, stripTicks } from "@/lib/timeline-strip.mjs";

// Read-only map of the source: where each Part keeps its main ranges (and teaser).
// Clicking a main range of the active Part seeks the preview; editing stays in the fields below.
export function TimelineStrip({
  plan,
  duration,
  activePartIndex,
  onSeekMain,
}: {
  plan: EditPlan;
  duration: number;
  activePartIndex: number;
  onSeekMain: (partIndex: number, rangeIndex: number) => void;
}) {
  const ticks = stripTicks(duration);
  return (
    <div className="studio-strip" aria-label="Bản đồ nguồn của các Part">
      {plan.parts.map((part, partIndex) => {
        const active = partIndex === activePartIndex;
        return (
          <div key={part.id} className="studio-strip-row" data-active={active}>
            <span className="studio-strip-label">Part {part.id}</span>
            <div className="studio-strip-track">
              {stripBlocks(part, duration).map((block) => {
                const name = `Part ${part.id} · ${block.kind === "teaser" ? "Teaser" : `Main ${block.index + 1}`} · ${block.label}`;
                const style = { left: `${block.left}%`, width: `${block.width}%` };
                return block.kind === "main" && active ? (
                  <div
                    key={`m${block.index}`}
                    role="button"
                    tabIndex={0}
                    aria-label={name}
                    title={name}
                    className="studio-strip-block"
                    data-kind="main"
                    style={style}
                    onClick={() => onSeekMain(partIndex, block.index)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSeekMain(partIndex, block.index);
                      }
                    }}
                  />
                ) : (
                  <span
                    key={`${block.kind}${block.index}`}
                    title={name}
                    className="studio-strip-block"
                    data-kind={block.kind}
                    style={style}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      {ticks.length > 0 && (
        <div className="studio-strip-ruler" aria-hidden="true">
          {ticks.map((tick, index) => (
            <span key={index}>{tick}</span>
          ))}
        </div>
      )}
    </div>
  );
}
