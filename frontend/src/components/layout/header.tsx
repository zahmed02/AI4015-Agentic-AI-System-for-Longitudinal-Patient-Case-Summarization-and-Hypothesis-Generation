"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Stethoscope } from "lucide-react";
import { getSection, SECTION } from "@/lib/sections";
import { useSystemStatus } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { StatusDot, type StatusState } from "@/components/common/status-dot";

export function Header({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const section = getSection(pathname);
  const Icon = section.icon;
  const { data, isError, isLoading } = useSystemStatus();

  const state = (ok: boolean | undefined): StatusState =>
    isLoading ? "unknown" : isError ? "down" : ok ? "ok" : "down";

  const services: { label: string; state: StatusState }[] = [
    { label: "API", state: isLoading ? "unknown" : isError ? "down" : "ok" },
    { label: "ChromaDB", state: state(data?.chroma.ok) },
    { label: "Neo4j", state: state(data?.neo4j.ok) },
  ];

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open navigation"
          className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground lg:hidden"
        >
          <Menu className="size-5" />
        </button>
        <span className={cn("flex size-8 items-center justify-center rounded-lg border", section.accent.bgSoft, section.accent.border)}>
          <Icon className={cn("size-4", section.accent.text)} />
        </span>
        <span className="truncate text-sm font-semibold">{section.title}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-3 sm:flex">
          {services.map((s) => (
            <StatusDot key={s.label} label={s.label} state={s.state} />
          ))}
        </div>
        {pathname !== SECTION.analyze.href && (
          <Link
            href="/analyze"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
          >
            <Stethoscope className="size-4" />
            <span className="hidden sm:inline">New analysis</span>
          </Link>
        )}
      </div>
    </header>
  );
}