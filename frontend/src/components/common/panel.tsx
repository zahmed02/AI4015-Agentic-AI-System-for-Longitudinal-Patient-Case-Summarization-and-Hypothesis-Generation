import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Accent } from "@/lib/sections";

interface PanelProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  accent?: Accent;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function Panel({ title, description, icon: Icon, accent, action, className, bodyClassName, children }: PanelProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card/80 backdrop-blur-sm",
        accent ? accent.border : "border-border",
        className,
      )}
    >
      {accent && (
        <div aria-hidden className={cn("absolute inset-x-0 top-0 h-px bg-linear-to-r opacity-70", accent.gradient)} />
      )}
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border", accent ? [accent.bgSoft, accent.border] : "border-border bg-secondary")}>
                <Icon className={cn("size-4", accent?.text)} />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-sm font-semibold">{title}</h2>}
              {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}