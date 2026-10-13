"use client";

import { Fragment } from "react";
import { motion } from "framer-motion";
import { Database, Monitor, Stethoscope, Workflow, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Panel } from "@/components/common/panel";
import { AgentLoop } from "@/components/pipeline/agent-loop";
import { LlmSection } from "@/components/pipeline/llm-section";
import { OfflineSteps } from "@/components/pipeline/offline-steps";
import { FlowConnector, FlowConnectorH, TagChip } from "@/components/pipeline/shared";
import { StorageMap } from "@/components/pipeline/storage-map";
import { ACCENTS, SECTION } from "@/lib/sections";
import { COLORS, TAGS, type ColorKey, type Tag } from "@/lib/pipeline-data";

const LANES: { n: string; title: string; when: string; color: ColorKey; icon: LucideIcon; steps: string[] }[] = [
  { n: "1", title: "Prepare the knowledge", when: "Offline, once per case", color: "sky", icon: Database,
    steps: ["MedChain dataset", "Translate", "Chunk", "Embed", "ChromaDB", "Knowledge graph"] },
  { n: "2", title: "Reason about a case", when: "Online, on every request", color: "emerald", icon: Stethoscope,
    steps: ["Guardrails", "Job runner", "Historian", "Diagnostician", "Critic", "Report"] },
  { n: "3", title: "Present and keep", when: "In your browser", color: "violet", icon: Monitor,
    steps: ["Live reasoning trace", "Result tabs", "Saved history"] },
];

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Key</span>
      {(Object.keys(TAGS) as Tag[]).map((t) => (
        <span key={t} className="inline-flex items-center gap-2">
          <TagChip tag={t} />
          {TAGS[t].long}
        </span>
      ))}
    </div>
  );
}

function BigPicture() {
  return (
    <Panel accent={ACCENTS.indigo} bodyClassName="p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight">The whole project in three moves</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Knowledge is built once, reasoning happens on every request, and the browser shows and keeps the result.
          The sections below open each move up in detail.
        </p>
      </div>
      <div className="flex flex-col items-stretch gap-2 lg:flex-row">
        {LANES.map((lane, i) => {
          const Icon = lane.icon;
          const c = COLORS[lane.color];
          return (
            <Fragment key={lane.n}>
              <motion.div
                className="flex-1 rounded-2xl border bg-background/50 p-5"
                style={{ borderColor: `${c}55` }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0, boxShadow: [`0 0 14px -6px ${c}00`, `0 0 40px -10px ${c}aa`, `0 0 14px -6px ${c}00`] }}
                transition={{
                  opacity: { delay: i * 0.1 },
                  y: { delay: i * 0.1 },
                  boxShadow: { duration: 3.6, repeat: Infinity, delay: i * 1.2 },
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl border"
                    style={{ borderColor: `${c}66`, background: `${c}1a` }}>
                    <Icon className="size-5" style={{ color: c }} />
                  </span>
                  <div>
                    <p className="text-xs font-mono" style={{ color: c }}>Move {lane.n}</p>
                    <h3 className="text-base font-semibold leading-tight">{lane.title}</h3>
                    <p className="text-xs text-muted-foreground">{lane.when}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {lane.steps.map((s, si) => (
                    <motion.span
                      key={s}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.15 + si * 0.05 }}
                      className="rounded-lg border px-2.5 py-1 text-xs"
                      style={{ borderColor: `${c}44`, background: `${c}12`, color: "#e4eef6" }}
                    >
                      {s}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
              {i < LANES.length - 1 && (
                <>
                  <div className="hidden items-center justify-center px-1 lg:flex">
                    <FlowConnectorH color={c} />
                  </div>
                  <div className="flex justify-center lg:hidden">
                    <FlowConnector color={c} className="pl-0" />
                  </div>
                </>
              )}
            </Fragment>
          );
        })}
      </div>
    </Panel>
  );
}

export default function PipelinePage() {
  return (
    <>
      <PageHeader section={SECTION.pipeline} />
      <div className="space-y-6">
        <Legend />
        <BigPicture />
        <Panel
          title="Phase 1: Data preparation"
          description="Offline. Runs once per case and never during an analysis. Click a step to see what it reads, writes and costs."
          icon={Database}
          accent={ACCENTS.sky}
        >
          <OfflineSteps />
        </Panel>
        <Panel
          title="Phase 2: One analysis run"
          description="Online. Starts in your browser, loops between the agents and the Critic, and ends with a report."
          icon={Workflow}
          accent={ACCENTS.emerald}
        >
          <AgentLoop />
        </Panel>
        <LlmSection />
        <StorageMap />
      </div>
    </>
  );
}