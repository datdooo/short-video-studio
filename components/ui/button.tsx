"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { Tooltip } from "./tooltip";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "studio-button inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap transition-colors outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "studio-button-primary",
        secondary: "studio-button-secondary",
        ghost: "studio-button-ghost",
        destructive: "studio-button-destructive",
        icon: "studio-button-icon",
        segmented: "studio-button-segmented",
      },
      size: {
        sm: "studio-button-sm",
        md: "studio-button-md",
        lg: "studio-button-lg",
        icon: "studio-button-size-icon",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  tooltip,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    tooltip?: string;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  const button = (
    <Comp
      {...props}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
    />
  );
  const label = tooltip || (size === "icon" ? props.title || props["aria-label"] : undefined);
  return label ? <Tooltip label={label}>{button}</Tooltip> : button;
}

export { Button, buttonVariants };
