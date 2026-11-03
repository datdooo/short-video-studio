import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function WorkspaceHeader({
  icon,
  title,
  description,
  actions,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header data-slot="workspace-header">
      <div className="min-w-0">
        <h1>
          <span aria-hidden="true">{icon}</span>
          {title}
        </h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="studio-action-row">{actions}</div>}
    </header>
  );
}

export function Panel({
  as: Tag = "section",
  padding = "md",
  className,
  ...props
}: ComponentProps<"div"> & {
  as?: "section" | "article" | "aside" | "div";
  padding?: "sm" | "md";
}) {
  return <Tag data-slot="panel" data-padding={padding} className={cn("workspace-panel", className)} {...props} />;
}

export function PanelHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="panel-header" className={cn(className)} {...props} />;
}
export function PanelBody({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="panel-body" className={cn(className)} {...props} />;
}
export function PanelFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="panel-footer" className={cn(className)} {...props} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="empty-state" className={cn(className)}>
      <span aria-hidden="true">{icon}</span>
      <p className="font-medium">{title}</p>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function InlineNotice({
  tone = "info",
  className,
  role,
  ...props
}: ComponentProps<"div"> & {
  tone?: "info" | "success" | "warning" | "error";
}) {
  return (
    <div
      data-slot="inline-notice"
      data-tone={tone}
      role={role ?? (tone === "error" ? "alert" : "status")}
      className={cn(className)}
      {...props}
    />
  );
}

export function Toolbar({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="workspace-toolbar" className={cn(className)} {...props} />;
}
