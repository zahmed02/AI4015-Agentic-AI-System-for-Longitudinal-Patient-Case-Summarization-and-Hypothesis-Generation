"use client";

import { motion } from "framer-motion";
import { ENTITY_STYLES, type EntityKey } from "@/lib/entities";
import { truncate } from "@/lib/format";
import type { GraphEntities } from "@/lib/types";

const W = 900;
const H = 640;
const CX = W / 2;
const CY = H / 2;
const PILL_H = 30;
const GAP = 8;
const HEAD = 34;
const PAD = 12;

const panelHeight = (n: number) => HEAD + PAD + Math.max(n, 1) * (PILL_H + GAP) - GAP + PAD;

interface Group {
  key: EntityKey;
  items: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  edge: { x1: number; y1: number; x2: number; y2: number };
  maxChars: number;
}

function layout(graph: GraphEntities): Group[] {
  const side = 262;
  const wide = 350;
  const lists: Record<EntityKey, string[]> = {
    symptoms: graph.symptoms,
    confirmed: graph.confirmed_diagnoses,
    differential: graph.differential_diagnoses,
    treatments: graph.treatments,
  };
  const hs = panelHeight(lists.symptoms.length);
  const ht = panelHeight(lists.treatments.length);
  const hc = panelHeight(lists.confirmed.length);
  const hd = panelHeight(lists.differential.length);

  return [
    { key: "symptoms", items: lists.symptoms, x: 8, y: CY - hs / 2, w: side, h: hs, maxChars: 37,
      edge: { x1: CX - 34, y1: CY, x2: 8 + side, y2: CY } },
    { key: "treatments", items: lists.treatments, x: W - 8 - side, y: CY - ht / 2, w: side, h: ht, maxChars: 37,
      edge: { x1: CX + 34, y1: CY, x2: W - 8 - side, y2: CY } },
    { key: "confirmed", items: lists.confirmed, x: (W - wide) / 2, y: 248 - hc, w: wide, h: hc, maxChars: 50,
      edge: { x1: CX, y1: CY - 34, x2: CX, y2: 248 } },
    { key: "differential", items: lists.differential, x: (W - wide) / 2, y: H - 248, w: wide, h: hd, maxChars: 50,
      edge: { x1: CX, y1: CY + 34, x2: CX, y2: H - 248 } },
  ];
}

export function GraphCanvas({ caseId, graph }: { caseId: string; graph: GraphEntities }) {
  const groups = layout(graph);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Knowledge graph for case ${caseId}`}>
      <g key={caseId}>
        {groups.map((g, gi) => {
          const style = ENTITY_STYLES[g.key];
          const horizontal = g.edge.y1 === g.edge.y2;
          const mx = (g.edge.x1 + g.edge.x2) / 2;
          const my = (g.edge.y1 + g.edge.y2) / 2;
          return (
            <g key={g.key}>
              <motion.line
                x1={g.edge.x1} y1={g.edge.y1} x2={g.edge.x2} y2={g.edge.y2}
                stroke={style.hex} strokeWidth={1.5} strokeOpacity={0.6}
                strokeDasharray={g.key === "differential" ? "5 4" : undefined}
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.1 + gi * 0.08 }}
              />
              <text
                x={horizontal ? mx : mx + 8} y={horizontal ? my - 8 : my + 4}
                textAnchor={horizontal ? "middle" : "start"}
                fontSize={9.5} fontFamily="var(--font-geist-mono), monospace"
                fill={style.hex} fillOpacity={0.9}
              >
                {style.relation}
              </text>

              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + gi * 0.08 }}>
                <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={14} fill="#0a1320" fillOpacity={0.9}
                  stroke={style.hex} strokeOpacity={0.35} />
                <text x={g.x + PAD + 2} y={g.y + 22} fontSize={11.5} fontWeight={600}
                  fill={style.hex} letterSpacing={0.6}>
                  {style.label.toUpperCase()} · {g.items.length}
                </text>
                {g.items.length === 0 && (
                  <text x={g.x + PAD + 2} y={g.y + HEAD + PAD + 18} fontSize={11} fill="#8197ad" fontStyle="italic">
                    None recorded
                  </text>
                )}
                {g.items.map((item, i) => {
                  const py = g.y + HEAD + PAD + i * (PILL_H + GAP);
                  return (
                    <motion.g key={`${item}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: 0.35 + gi * 0.08 + i * 0.05 }}>
                      <title>{item}</title>
                      <rect x={g.x + PAD} y={py} width={g.w - PAD * 2} height={PILL_H} rx={8}
                        fill={style.hex} fillOpacity={0.12} stroke={style.hex} strokeOpacity={0.35} />
                      <text x={g.x + PAD + 10} y={py + 19} fontSize={12} fill="#e4eef6">
                        {truncate(item, g.maxChars)}
                      </text>
                    </motion.g>
                  );
                })}
              </motion.g>
            </g>
          );
        })}

        <motion.circle cx={CX} cy={CY} r={40} fill="none" stroke="#22d3ee" strokeOpacity={0.25}
          animate={{ r: [40, 50, 40], strokeOpacity: [0.3, 0.05, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} />
        <circle cx={CX} cy={CY} r={34} fill="#0a1320" stroke="#22d3ee" strokeWidth={2} />
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize={9.5} letterSpacing={1.2} fill="#8197ad">CASE</text>
        <text x={CX} y={CY + 16} textAnchor="middle" fontSize={18} fontWeight={700} fill="#67e8f9">{caseId}</text>
      </g>
    </svg>
  );
}