"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { HeartPulse } from "lucide-react";
import { SECTION_LIST, getSection } from "@/lib/sections";
import { useSystemStatus } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const activeHref = getSection(pathname).href;
  const { data } = useSystemStatus();

  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-3 px-5 py-5">
        <span className="flex size-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_30px_-10px_rgba(34,211,238,0.7)]">
          <HeartPulse className="size-5 text-cyan-300" />
        </span>
        <span>
          <span className="block text-base font-semibold leading-tight tracking-tight">ChronoMed</span>
          <span className="block text-[11px] leading-tight text-muted-foreground">
            Case summarization &amp; hypotheses
          </span>
        </span>
      </Link>

      <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Main navigation">
        {SECTION_LIST.map((section) => {
          const active = section.href === activeHref;
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? section.accent.text : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className={cn("absolute inset-0 rounded-xl border", section.accent.bgSoft, section.accent.border)}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon className="relative z-10 size-[18px]" />
              <span className="relative z-10">{section.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl border border-border bg-background/50 p-3 text-xs">
        <p className="mb-2 font-medium text-muted-foreground">Language models</p>
        {data ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Primary</span>
              <span className="truncate font-mono text-cyan-300">{data.llm.primary_model}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Fallback</span>
              <span className="truncate font-mono text-emerald-300">{data.llm.fallback_model}</span>
            </div>
          </div>
        ) : (
          <Skeleton className="h-9 w-full" />
        )}
      </div>
    </div>
  );
}