"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { ExternalLink, FlaskConical, Globe, Loader2, Pill, Plus, Search, X } from "lucide-react";
import { api } from "@/lib/api";
import { SECTION } from "@/lib/sections";
import { domainOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { Panel } from "@/components/common/panel";
import { SegmentedTabs, type TabItem } from "@/components/common/segmented-tabs";
import { Button } from "@/components/ui/button";

type ToolId = "labs" | "drugs" | "search";
const accent = SECTION.tools.accent;

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-amber-400/60";

const LAB_STATUS = {
  HIGH: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  LOW: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  normal: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
} as const;

const SEVERITY: Record<string, string> = {
  contraindicated: "border-red-500/50 bg-red-500/10 text-red-300",
  major: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  moderate: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

function MutationError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
      {error instanceof Error ? error.message : "The request failed."}
    </p>
  );
}

function LabTool() {
  const [text, setText] = useState("");
  const mutation = useMutation({ mutationFn: api.labs });
  const data = mutation.data;

  return (
    <Panel title="Lab interpreter" description="Flags values outside adult reference ranges (ALT, AST, bilirubin, creatinine, WBC, hemoglobin, platelets, glucose, sodium, potassium, albumin)" icon={FlaskConical} accent={accent}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(text); }} className="space-y-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          aria-label="Lab results text"
          placeholder="Paste lab results, for example: ALT: 120 U/L, creatinine 1.1"
          className={cn(inputClass, "resize-none py-2.5")}
        />
        <Button type="submit" disabled={!text.trim() || mutation.isPending} className="gap-2 bg-amber-500 text-amber-950 hover:bg-amber-400">
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
          Interpret values
        </Button>
      </form>
      <MutationError error={mutation.error} />

      {data && (
        <div className="mt-6">
          {data.findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recognized lab values were found in that text.</p>
          ) : (
            <>
              <p className="mb-3 text-sm">
                <span className="font-mono text-amber-300">{data.abnormal_count}</span> of {data.findings.length} recognized values are outside the reference range.
              </p>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr><th className="px-4 py-2.5">Lab</th><th className="px-4 py-2.5">Value</th><th className="px-4 py-2.5">Reference</th><th className="px-4 py-2.5">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.findings.map((f, i) => (
                      <motion.tr key={`${f.lab}-${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                        <td className="px-4 py-2.5 font-medium uppercase">{f.lab}</td>
                        <td className="px-4 py-2.5 font-mono">{f.value} <span className="text-xs text-muted-foreground">{f.unit}</span></td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{f.reference_range}</td>
                        <td className="px-4 py-2.5"><span className={cn("rounded-md border px-2 py-0.5 text-xs font-medium", LAB_STATUS[f.status])}>{f.status}</span></td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

function DrugTool() {
  const [meds, setMeds] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const mutation = useMutation({ mutationFn: api.drugs });
  const data = mutation.data;

  const add = () => {
    const name = draft.trim().replace(/,$/, "");
    if (!name || meds.length >= 12 || meds.some((m) => m.toLowerCase() === name.toLowerCase())) return setDraft("");
    setMeds([...meds, name]);
    setDraft("");
  };

  return (
    <Panel title="Drug interaction checker" description="Checks every pair in the list against a curated table, then NIH RxNav" icon={Pill} accent={accent}>
      <div className="space-y-4">
        <div className="flex gap-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
            aria-label="Medication name"
            placeholder="Type a medication and press Enter"
            className={cn(inputClass, "h-10")}
          />
          <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()} className="gap-2"><Plus className="size-4" /> Add</Button>
        </div>

        <div className="flex min-h-9 flex-wrap gap-2">
          <AnimatePresence>
            {meds.map((m) => (
              <motion.span key={m} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 py-1 pl-3 pr-1.5 text-sm text-amber-100">
                {m}
                <button type="button" aria-label={`Remove ${m}`} onClick={() => setMeds(meds.filter((x) => x !== m))} className="rounded p-0.5 hover:bg-amber-500/20"><X className="size-3.5" /></button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>

        <Button type="button" onClick={() => mutation.mutate(meds)} disabled={meds.length < 2 || mutation.isPending} className="gap-2 bg-amber-500 text-amber-950 hover:bg-amber-400">
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Pill className="size-4" />}
          Check interactions
        </Button>
        {meds.length < 2 && <p className="text-xs text-muted-foreground">Add at least two medications.</p>}
      </div>
      <MutationError error={mutation.error} />

      {data && (
        <div className="mt-6 space-y-2">
          <p className="mb-3 text-sm"><span className="font-mono text-amber-300">{data.flagged_count}</span> of {data.pairs.length} pairs have a known interaction.</p>
          {data.pairs.map((p, i) => (
            <motion.div key={`${p.drug_a}-${p.drug_b}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className={cn("rounded-xl border p-4", p.interaction_found ? "border-border bg-background/50" : "border-border/60 bg-background/30")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{p.drug_a} + {p.drug_b}</p>
                {p.interaction_found ? (
                  <span className={cn("rounded-md border px-2 py-0.5 text-xs font-medium uppercase", SEVERITY[p.severity ?? ""] ?? "border-slate-500/40 bg-slate-500/10 text-slate-300")}>{p.severity}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">No known interaction</span>
                )}
              </div>
              {p.description && <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>}
              {p.interaction_found && <p className="mt-1 text-[11px] text-muted-foreground">Source: {p.source}</p>}
            </motion.div>
          ))}
          <p className="pt-2 text-xs text-muted-foreground">{data.disclaimer}</p>
        </div>
      )}
    </Panel>
  );
}

function SearchTool() {
  const [query, setQuery] = useState("");
  const mutation = useMutation({ mutationFn: api.webSearch });
  const data = mutation.data;

  return (
    <Panel title="Medical reference search" description="General web search for guideline and reference information. Never use it for patient data." icon={Globe} accent={accent}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(query.trim()); }} className="flex gap-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search query" placeholder="Search a medical topic" className={cn(inputClass, "h-10")} />
        <Button type="submit" disabled={query.trim().length < 2 || mutation.isPending} className="gap-2 bg-amber-500 text-amber-950 hover:bg-amber-400">
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Search
        </Button>
      </form>
      <MutationError error={mutation.error} />

      {data && (
        <div className="mt-6 space-y-3">
          {data.results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No results came back. The search service may be unreachable from this machine.</p>
          ) : (
            data.results.map((r, i) => (
              <motion.a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="block rounded-xl border border-border bg-background/50 p-4 transition-colors hover:border-amber-400/50">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-amber-200">{r.title}</p>
                  <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                </div>
                <p className="mt-1 text-xs text-emerald-300/80">{domainOf(r.url)}</p>
                <p className="mt-2 text-sm text-muted-foreground">{r.snippet}</p>
              </motion.a>
            ))
          )}
        </div>
      )}
    </Panel>
  );
}

export default function ToolsPage() {
  const [tool, setTool] = useState<ToolId>("labs");
  const tabs: TabItem<ToolId>[] = [
    { id: "labs", label: "Lab interpreter", icon: FlaskConical },
    { id: "drugs", label: "Drug interactions", icon: Pill },
    { id: "search", label: "Reference search", icon: Globe },
  ];

  return (
    <>
      <PageHeader section={SECTION.tools} />
      <div className="mb-5"><SegmentedTabs tabs={tabs} active={tool} onChange={setTool} accent={accent} layoutId="tools-tab" /></div>
      <AnimatePresence mode="wait">
        <motion.div key={tool} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
          {tool === "labs" && <LabTool />}
          {tool === "drugs" && <DrugTool />}
          {tool === "search" && <SearchTool />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}