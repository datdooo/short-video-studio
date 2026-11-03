"use client";
import type { EditPlan } from "@/lib/edit-plan";
import { durationOf, manualPlan } from "@/lib/edit-plan";
import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";
type State = {
  replacePlan: (next: EditPlan) => void;
  setActivePartIndex: Dispatch<SetStateAction<number>>;
  setEditMode: Dispatch<SetStateAction<"ai" | "manual">>;
  setError: Dispatch<SetStateAction<string>>;
  setHasEditPlan: Dispatch<SetStateAction<boolean>>;
  setManualPart1Ranges: Dispatch<SetStateAction<string>>;
  setManualPart1Title: Dispatch<SetStateAction<string>>;
  setManualPart2Ranges: Dispatch<SetStateAction<string>>;
  setManualPart2Title: Dispatch<SetStateAction<string>>;
  setSourceTitle: Dispatch<SetStateAction<string>>;
};
export function useManualEditTool(state: State) {
  const {
    replacePlan,
    setActivePartIndex,
    setEditMode,
    setError,
    setHasEditPlan,
    setManualPart1Ranges,
    setManualPart1Title,
    setManualPart2Ranges,
    setManualPart2Title,
    setSourceTitle,
  } = state;
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const registration = context.registerTool(
      {
        name: "apply_manual_edit_plan",
        title: "Apply manual edit plan",
        description:
          "Apply chronological timestamp ranges for two video parts without using AI, and update the visible edit plan.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            originalTitle: { type: "string" },
            part1Title: { type: "string" },
            part1Ranges: {
              type: "string",
              description: "One timestamp range per line, for example 00:10 - 00:25 Hook",
            },
            part2Title: { type: "string" },
            part2Ranges: { type: "string", description: "One timestamp range per line" },
          },
          required: ["originalTitle", "part1Title", "part1Ranges", "part2Title", "part2Ranges"],
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const values = input as {
            originalTitle: string;
            part1Title: string;
            part1Ranges: string;
            part2Title: string;
            part2Ranges: string;
          };
          if (!values || Object.values(values).some((value) => typeof value !== "string")) {
            throw new Error("All manual edit-plan fields must be strings.");
          }
          const nextPlan = manualPlan(values);

          setSourceTitle(values.originalTitle);
          setManualPart1Title(values.part1Title);
          setManualPart1Ranges(values.part1Ranges);
          setManualPart2Title(values.part2Title);
          setManualPart2Ranges(values.part2Ranges);
          replacePlan(nextPlan);
          setHasEditPlan(true);
          setEditMode("manual");
          setActivePartIndex(0);
          setError("");
          return {
            source: "manual",
            partCount: nextPlan.parts.length,
            sourceDurations: nextPlan.parts.map((part) => durationOf(part)),
            finalSpeed: nextPlan.render.speed,
          };
        },
      },
      { signal: lifecycle.signal },
    );
    void Promise.resolve(registration).catch(() => undefined);
    return () => lifecycle.abort();
  }, [
    replacePlan,
    setManualPart1Title,
    setManualPart2Title,
    setManualPart1Ranges,
    setManualPart2Ranges,
    setEditMode,
    setHasEditPlan,
    setSourceTitle,
  ]);
  return {};
}
