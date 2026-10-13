"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TagChip } from "@/components/pipeline/shared";
import { useSystemStatus } from "@/lib/hooks";
import {
  COLORS, ONLINE_NODES, STEPS,
  type ColorKey, type EdgeId, type NodeId,
} from "@/lib/pipeline-data";
import { cn } from "@/lib/utils";

const GEO: Record<NodeId, { cx: number; cy: number; w: number; h: number }> = {
  request: { cx: 105, cy: 112, w: 160, h: 64 },
  guardrails: { cx: 350, cy: 112, w: 160, h: 64 },
  job: { cx: 595, cy: 112, w: 160, h: 64 },
  report: { cx: 805, cy: 112, w: 160, h: 64 },
  historian: { cx: 105, cy: 280, w: 160, h: 64 },
  diagnostician: { cx: 350, cy: 280, w: 160, h: 64 },
  critic: { cx: 595, cy: 280, w: 160, h: 64 },
  router: { cx: 805, cy: 280, w: 120, h: 52 },
  chroma: { cx: 60, cy: 470, w: 116, h: 48 },
  neo4j: { cx: 190, cy: 470, w: 116, h: 48 },
};

const EDGES: Record<EdgeId, { d: string; color: ColorKey }> = {
  e1: { d: "M185 112 H270", color: "cyan" },
  e2: { d: "M430 112 H515", color: "cyan" },
  e3: { d: "M595 144 V206 H105 V248", color: "cyan" },
  e4: { d: "M185 280 H270", color: "sky" },
  e5: { d: "M430 280 H515", color: "emerald" },
  e6: { d: "M675 280 H745", color: "amber" },
  e7: { d: "M805 254 V144", color: "cyan" },
  e8: { d: "M785 306 V372 H350 V312", color: "emerald" },
  e9: { d: "M830 306 V408 H150 V312", color: "sky" },
  reject: { d: "M350 80 V34", color: "rose" },
  r1: { d: "M60 446 V312", color: "sky" },
  r2: { d: "M190 446 V426 H105 V312", color: "violet" },
};

function Edge({ id, active }: { id: EdgeId; active: boolean }) {
  const reduce = useReducedMotion();
  const { d, color } = EDGES[id];
  const c = COLORS[color];
  return (
    <g>
      <path
        d={d} fill="none" stroke={c}
        strokeOpacity={active ? 0.5 : 0.2} strokeWidth={active ? 2 : 1.5}
        markerEnd={`url(#pl-arrow-${color})`}
      />
      <motion.path
        d={d} fill="none" stroke={c} strokeLinecap="round" strokeDasharray="6 14"
        strokeWidth={active ? 3 : 1.5} strokeOpacity={active ? 1 : 0.35}
        filter={active ? "url(#pl-glow)" : undefined}
        initial={{ strokeDashoffset: 0 }}
        animate={reduce ? undefined : { strokeDashoffset: -40 }}
        transition={{ duration: active ? 0.7 : 2.2, repeat: Infinity, ease: "linear" }}
      />
    </g>
  );
}

function SvgNode({ id, active, onSelect }: { id: NodeId; active: boolean; onSelect: (id: NodeId) => void }) {
  const g = GEO[id];
  const meta = ONLINE_NODES[id];
  const c = COLORS[meta.color];
  const Icon = meta.icon;
  const x = g.cx - g.w / 2;
  const y = g.cy - g.h / 2;
  return (
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={`${meta.label}: show details`}
      className="cursor-pointer outline-none"
      onClick={() => onSelect(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(id);
        }
      }}
      animate={{ opacity: active ? 1 : 0.6 }}
      transition={{ duration: 0.3 }}
    >
      <rect x={x} y={y} width={g.w} height={g.h} rx={14} fill="#0a1320" />
      <motion.rect
        x={x} y={y} width={g.w} height={g.h} rx={14} fill={c} stroke={c}
        strokeDasharray={id === "router" ? "5 4" : undefined}
        filter={active ? "url(#pl-glow)" : undefined}
        animate={{ fillOpacity: active ? 0.16 : 0.05, strokeOpacity: active ? 1 : 0.4, strokeWidth: active ? 2.5 : 1.25 }}
        transition={{ duration: 0.3 }}
      />
      <Icon x={x + 12} y={g.cy - 11} width={22} height={22} color={c} strokeWidth={1.8} />
      <text x={x + 44} y={g.cy - 2} fontSize={13} fontWeight={600} fill="#e4eef6">{meta.label}</text>
      <text x={x + 44} y={g.cy + 14} fontSize={10.5} fill="#8197ad">{meta.sub}</text>
    </motion.g>
  );
}

export function AgentLoop() {
  const reduce = useReducedMotion();
  const { data: status } = useSystemStatus();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [pin, setPin] = useState<NodeId | null>(null);

  const running = playing && !reduce;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2800);
    return () => clearInterval(id);
  }, [running]);

  const current = STEPS[step];
  const shownId: NodeId = pin ?? current.focus;
  const shown = ONLINE_NODES[shownId];
  const shownColor = COLORS[shown.color];
  const ShownIcon = shown.icon;
  const activeNodes = new Set<NodeId>(current.nodes);
  const activeEdges = new Set<EdgeId>(current.edges);

  const selectNode = (id: NodeId) => {
    setPlaying(false);
    const idx = STEPS.findIndex((s) => s.focus === id);
    if (idx >= 0) {
      setStep(idx);
      setPin(null);
    } else {
      setStep(3);
      setPin(id);
    }
  };
  const selectStep = (i: number) => {
    setPlaying(false);
    setStep(i);
    setPin(null);
  };
  const togglePlay = () => {
    if (!playing) setPin(null);
    setPlaying((p) => !p);
  };

  const bandLabel = status
    ? `LLM calls · ${status.llm.primary_model}, fallback ${status.llm.fallback_model} · temperature 0`
    : "LLM calls · primary model with automatic fallback · temperature 0";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {!reduce && (
          <Button variant="outline" size="sm" onClick={togglePlay} className="gap-2">
            {running ? <Pause className="size-4" /> : <Play className="size-4" />}
            {running ? "Pause" : "Play"}
          </Button>
        )}
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show step ${i + 1}`}
              onClick={() => selectStep(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === step && !pin ? "w-6 bg-emerald-400" : "w-2 bg-border hover:bg-muted-foreground",
              )}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          Step {step + 1} of {STEPS.length}. Click any box to read what it does.
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-background/40">
        <div className="min-w-[820px] p-3">
          <svg viewBox="0 0 1000 510" className="h-auto w-full" role="img" aria-label="Flow of one analysis run through the agents">
            <defs>
              {(Object.keys(COLORS) as ColorKey[]).map((k) => (
                <marker key={k} id={`pl-arrow-${k}`} viewBox="0 0 10 10" refX="8" refY="5"
                  markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto">
                  <path d="M0 0 L10 5 L0 10 z" fill={COLORS[k]} />
                </marker>
              ))}
              <filter id="pl-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <rect x={10} y={222} width={680} height={118} rx={20} fill={COLORS.fuchsia} fillOpacity={0.04}
              stroke={COLORS.fuchsia} strokeOpacity={0.35} strokeDasharray="4 5" />
            <text x={680} y={239} textAnchor="end" fontSize={10.5} fill={COLORS.fuchsia} fillOpacity={0.9}>{bandLabel}</text>

            {(Object.keys(EDGES) as EdgeId[]).map((id) => (
              <Edge key={id} id={id} active={activeEdges.has(id)} />
            ))}

            <text x={362} y={52} fontSize={11} fill={COLORS.rose}>Rejected: HTTP 400</text>
            <text x={815} y={205} fontSize={11} fill={COLORS.cyan}>Approved, or no rounds left</text>
            <text x={570} y={364} textAnchor="middle" fontSize={11} fill={COLORS.emerald}>Revise: reasoning or evidence is weak</text>
            <text x={490} y={400} textAnchor="middle" fontSize={11} fill={COLORS.sky}>Search wider: retrieval was too thin</text>

            {(Object.keys(GEO) as NodeId[]).map((id) => (
              <SvgNode key={id} id={id} active={activeNodes.has(id)} onSelect={selectNode} />
            ))}
          </svg>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        <span>Glowing box and bright dashes: the current step</span>
        <span>Shaded band: steps that call the LLM</span>
        <span>Dashed box: plain code, no LLM</span>
        <span>All three agents read and write one shared state</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${shownId}-${pin ? "pin" : step}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="mt-4 rounded-2xl border bg-background/50 p-5"
          style={{ borderColor: `${shownColor}55`, boxShadow: `0 0 40px -18px ${shownColor}` }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl border"
                style={{ borderColor: `${shownColor}66`, background: `${shownColor}1a` }}>
                <ShownIcon className="size-5" style={{ color: shownColor }} />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{pin ? "Selected" : `Step ${step + 1} of ${STEPS.length}`}</p>
                <h3 className="text-base font-semibold">{shown.label}</h3>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {shown.tags.map((t) => (
                <TagChip key={t} tag={t} />
              ))}
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-foreground/90">{pin ? shown.summary : current.caption}</p>
          <p className="mt-3 font-mono text-xs" style={{ color: shownColor }}>{shown.where}</p>
          <dl className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-[150px_minmax(0,1fr)]">
            {shown.rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{row.label}</dt>
                <dd className="text-sm leading-relaxed text-foreground/90">{row.value}</dd>
              </div>
            ))}
          </dl>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}