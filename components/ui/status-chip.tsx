import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function StatusChip({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & {
  tone?: "neutral" | "success" | "warning";
}) {
  return <span data-slot="status-chip" data-tone={tone} className={cn(className)} {...props} />;
}
