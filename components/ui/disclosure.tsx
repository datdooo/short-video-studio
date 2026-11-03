"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// UI primitive exception: native disclosure preserves keyboard, open state and QA selectors.
export function Disclosure({ className, ...props }: ComponentProps<"details">) {
  return <details data-slot="disclosure" className={cn("studio-disclosure", className)} {...props} />;
}

export function DisclosureTrigger({ className, ...props }: ComponentProps<"summary">) {
  return <summary data-slot="disclosure-trigger" className={cn(className)} {...props} />;
}
