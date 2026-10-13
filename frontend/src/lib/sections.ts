import {
  FlaskConical, FolderOpen, LayoutDashboard, Network, ShieldCheck, Stethoscope, Workflow,
  type LucideIcon,
} from "lucide-react";

export interface Accent {
  text: string;
  bgSoft: string;
  border: string;
  borderHover: string;
  solid: string;
  gradient: string;
  glow: string;
}

export interface Section {
  href: string;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: Accent;
}

export const ACCENTS = {
  cyan: {
    text: "text-cyan-300", bgSoft: "bg-cyan-500/10", border: "border-cyan-500/25",
    borderHover: "hover:border-cyan-400/60", solid: "bg-cyan-400",
    gradient: "from-cyan-400 to-sky-500", glow: "shadow-[0_0_40px_-14px_rgba(34,211,238,0.55)]",
  },
  emerald: {
    text: "text-emerald-300", bgSoft: "bg-emerald-500/10", border: "border-emerald-500/25",
    borderHover: "hover:border-emerald-400/60", solid: "bg-emerald-400",
    gradient: "from-emerald-400 to-teal-500", glow: "shadow-[0_0_40px_-14px_rgba(52,211,153,0.55)]",
  },
  sky: {
    text: "text-sky-300", bgSoft: "bg-sky-500/10", border: "border-sky-500/25",
    borderHover: "hover:border-sky-400/60", solid: "bg-sky-400",
    gradient: "from-sky-400 to-blue-500", glow: "shadow-[0_0_40px_-14px_rgba(56,189,248,0.55)]",
  },
  violet: {
    text: "text-violet-300", bgSoft: "bg-violet-500/10", border: "border-violet-500/25",
    borderHover: "hover:border-violet-400/60", solid: "bg-violet-400",
    gradient: "from-violet-400 to-fuchsia-500", glow: "shadow-[0_0_40px_-14px_rgba(167,139,250,0.55)]",
  },
  amber: {
    text: "text-amber-300", bgSoft: "bg-amber-500/10", border: "border-amber-500/25",
    borderHover: "hover:border-amber-400/60", solid: "bg-amber-400",
    gradient: "from-amber-400 to-orange-500", glow: "shadow-[0_0_40px_-14px_rgba(251,191,36,0.55)]",
  },
  rose: {
    text: "text-rose-300", bgSoft: "bg-rose-500/10", border: "border-rose-500/25",
    borderHover: "hover:border-rose-400/60", solid: "bg-rose-400",
    gradient: "from-rose-400 to-pink-500", glow: "shadow-[0_0_40px_-14px_rgba(251,113,133,0.55)]",
  },
  indigo: {
    text: "text-indigo-300", bgSoft: "bg-indigo-500/10", border: "border-indigo-500/25",
    borderHover: "hover:border-indigo-400/60", solid: "bg-indigo-400",
    gradient: "from-indigo-400 to-blue-500", glow: "shadow-[0_0_40px_-14px_rgba(129,140,248,0.55)]",
  },
} satisfies Record<string, Accent>;

export const SECTION = {
  dashboard: {
    href: "/", label: "Overview", title: "Overview",
    description: "Corpus, services and recent analyses at a glance.",
    icon: LayoutDashboard, accent: ACCENTS.cyan,
  },
  analyze: {
    href: "/analyze", label: "Analysis", title: "Case Analysis",
    description: "Run the Historian, Diagnostician and Critic pipeline on a case and follow its reasoning live.",
    icon: Stethoscope, accent: ACCENTS.emerald,
  },
  cases: {
    href: "/cases", label: "Cases", title: "Case Explorer",
    description: "Browse indexed MedChain cases, their text chunks and knowledge-graph entities.",
    icon: FolderOpen, accent: ACCENTS.sky,
  },
  graph: {
    href: "/knowledge-graph", label: "Knowledge Graph", title: "Knowledge Graph",
    description: "Symptoms, confirmed and differential diagnoses and treatments stored in Neo4j.",
    icon: Network, accent: ACCENTS.violet,
  },
  tools: {
    href: "/tools", label: "Clinical Tools", title: "Clinical Tools",
    description: "Lab interpretation, drug interaction checks and medical reference search.",
    icon: FlaskConical, accent: ACCENTS.amber,
  },
  pipeline: {
    href: "/pipeline", label: "Pipeline", title: "Pipeline",
    description: "How a case travels through ChronoMed: data preparation, the agent loop, the LLM calls and where everything is stored.",
    icon: Workflow, accent: ACCENTS.indigo,
  },
  system: {
    href: "/system", label: "System & Safety", title: "System & Safety",
    description: "Service health, model configuration, pipeline, guardrails and MCP tools.",
    icon: ShieldCheck, accent: ACCENTS.rose,
  },
} satisfies Record<string, Section>;

export const SECTION_LIST: Section[] = [
  SECTION.dashboard, SECTION.analyze, SECTION.cases, SECTION.graph, SECTION.tools,
  SECTION.pipeline, SECTION.system,
];

export function getSection(pathname: string): Section {
  const match = SECTION_LIST.filter((s) => s.href !== "/" && pathname.startsWith(s.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  return match ?? SECTION.dashboard;
}