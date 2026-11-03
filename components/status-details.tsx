"use client";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
export function StatusDetails({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={`studio-status-details-trigger ${className}`}>
          {label}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        collisionPadding={12}
        className="studio-status-details-popover"
        aria-label={label}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
