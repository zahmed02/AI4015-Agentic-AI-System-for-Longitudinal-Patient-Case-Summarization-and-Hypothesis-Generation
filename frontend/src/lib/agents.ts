import { Scale, ScrollText, Stethoscope, type LucideIcon } from "lucide-react";
import type { AgentName } from "@/lib/types";

export interface AgentStyle {
  label: string;
  role: string;
  icon: LucideIcon;
  text: string;
  bgSoft: string;
  border: string;
  solid: string;
  glow: string;
}

export const AGENT_ORDER: AgentName[] = ["historian", "diagnostician", "critic"];

export const AGENTS: Record<AgentName, AgentStyle> = {
  historian: {
    label: "Historian",
    role: "Retrieves case excerpts and builds a structured clinical timeline.",
    icon: ScrollText,
    text: "text-sky-300", bgSoft: "bg-sky-500/10", border: "border-sky-500/40", solid: "bg-sky-400",
    glow: "shadow-[0_0_30px_-8px_rgba(56,189,248,0.5)]",
  },
  diagnostician: {
    label: "Diagnostician",
    role: "Proposes three ranked differential diagnoses grounded in the timeline.",
    icon: Stethoscope,
    text: "text-emerald-300", bgSoft: "bg-emerald-500/10", border: "border-emerald-500/40", solid: "bg-emerald-400",
    glow: "shadow-[0_0_30px_-8px_rgba(52,211,153,0.5)]",
  },
  critic: {
    label: "Critic",
    role: "Checks every claim against the evidence and requests revisions.",
    icon: Scale,
    text: "text-amber-300", bgSoft: "bg-amber-500/10", border: "border-amber-500/40", solid: "bg-amber-400",
    glow: "shadow-[0_0_30px_-8px_rgba(251,191,36,0.5)]",
  },
};