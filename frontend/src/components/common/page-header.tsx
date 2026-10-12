import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Section } from "@/lib/sections";

export function PageHeader({ section, actions }: { section: Section; actions?: ReactNode }) {
  const Icon = section.icon;
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl border", section.accent.bgSoft, section.accent.border, section.accent.glow)}>
          <Icon className={cn("size-6", section.accent.text)} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{section.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{section.description}</p>
        </div>
      </div>
      {actions}
    </div>
  );
}