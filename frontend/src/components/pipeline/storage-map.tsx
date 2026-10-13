"use client";

import { motion } from "framer-motion";
import { Boxes } from "lucide-react";
import { Panel } from "@/components/common/panel";
import { StatusDot } from "@/components/common/status-dot";
import { useSystemStatus } from "@/lib/hooks";
import { ACCENTS } from "@/lib/sections";
import { COLORS, STORES } from "@/lib/pipeline-data";

export function StorageMap() {
  const { data } = useSystemStatus();

  const live: Record<string, { text: string; ok: boolean } | null> = {
    chroma: data ? { text: `${data.chroma.chunks} chunks · ${data.chroma.cases} cases`, ok: data.chroma.ok } : null,
    neo4j: data
      ? {
          text: data.neo4j.ok ? `${data.neo4j.cases} cases · ${data.neo4j.relationships} relationships` : "not reachable right now",
          ok: data.neo4j.ok,
        }
      : null,
  };

  return (
    <Panel
      title="Where data is written and read"
      description="Every place the project keeps state, who writes it and who reads it"
      icon={Boxes}
      accent={ACCENTS.indigo}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {STORES.map((store, i) => {
          const Icon = store.icon;
          const color = COLORS[store.color];
          const status = live[store.id];
          return (
            <motion.div
              key={store.id}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ delay: (i % 3) * 0.06, duration: 0.35 }}
              whileHover={{ y: -3, boxShadow: `0 0 36px -12px ${color}` }}
              className="rounded-2xl border bg-background/50 p-4"
              style={{ borderColor: `${color}44` }}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border"
                  style={{ borderColor: `${color}66`, background: `${color}1a` }}>
                  <Icon className="size-5" style={{ color }} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{store.name}</p>
                  <p className="break-all font-mono text-[11px]" style={{ color }}>{store.path}</p>
                </div>
              </div>

              {status && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs">
                  <StatusDot label="" state={status.ok ? "ok" : "down"} />
                  <span className="font-mono">{status.text}</span>
                </div>
              )}

              <dl className="mt-3 space-y-2 text-xs">
                <div>
                  <dt className="font-medium uppercase tracking-wider text-muted-foreground">Written by</dt>
                  <dd className="mt-0.5 text-foreground/90">{store.writtenBy}</dd>
                </div>
                <div>
                  <dt className="font-medium uppercase tracking-wider text-muted-foreground">When</dt>
                  <dd className="mt-0.5 text-foreground/90">{store.when}</dd>
                </div>
                <div>
                  <dt className="font-medium uppercase tracking-wider text-muted-foreground">Read by</dt>
                  <dd className="mt-0.5 text-foreground/90">{store.readBy}</dd>
                </div>
              </dl>
            </motion.div>
          );
        })}
      </div>
    </Panel>
  );
}