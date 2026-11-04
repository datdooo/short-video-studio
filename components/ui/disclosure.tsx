"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// UI primitive exception: native disclosure preserves keyboard, open state and QA selectors.
export function Disclosure({ className, section, ...props }: ComponentProps<"details"> & { section?: boolean }) {
  return (
    <details
      data-slot="disclosure"
      className={cn("studio-disclosure", section && "studio-section", className)}
      {...props}
    />
  );
}

export function DisclosureTrigger({ className, ...props }: ComponentProps<"summary">) {
  return <summary data-slot="disclosure-trigger" className={cn(className)} {...props} />;
}
