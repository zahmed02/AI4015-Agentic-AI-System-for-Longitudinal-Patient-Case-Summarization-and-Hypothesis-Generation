"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, Loader2, Minus, Play, Plus } from "lucide-react";
import { Panel } from "@/components/common/panel";
import { Button } from "@/components/ui/button";
import { SECTION } from "@/lib/sections";
import { cleanCaseTitle } from "@/lib/format";
import type { AnalysisRequest, CaseInfo } from "@/lib/types";

const schema = z.object({
  objective: z
    .string()
    .trim()
    .min(3, "Describe the clinical question (at least 3 characters).")
    .max(500, "Keep the objective under 500 characters."),
  case_id: z.string(),
  max_iterations: z.number().int().min(1).max(6),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  cases: CaseInfo[];
  casesLoading: boolean;
  caseFromUrl: string;
  busy: boolean;
  error: string | null;
  onSubmit: (values: AnalysisRequest) => void;
}

export function AnalysisForm({ cases, casesLoading, caseFromUrl, busy, error, onSubmit }: Props) {
  const {
    register, handleSubmit, setValue, control, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { objective: "", case_id: caseFromUrl, max_iterations: 2 },
  });

  // useWatch keeps these values reactive without the unmemoizable watch() function.
  const objective = useWatch({ control, name: "objective" });
  const iterations = useWatch({ control, name: "max_iterations" });

  // The case list loads asynchronously. Setting the dropdown before its options exist leaves
  // the form value and the visible choice out of sync, so the URL case is applied only once
  // that case is actually listed.
  const urlCaseListed = !!caseFromUrl && cases.some((c) => c.case_id === caseFromUrl);
  useEffect(() => {
    if (urlCaseListed) setValue("case_id", caseFromUrl);
  }, [urlCaseListed, caseFromUrl, setValue]);

  const accent = SECTION.analyze.accent;

  return (
    <Panel title="New analysis" description="Choose a case and describe what you want to understand." icon={SECTION.analyze.icon} accent={accent}>
      <form
        className="space-y-5"
        onSubmit={handleSubmit((v) =>
          onSubmit({ objective: v.objective, case_id: v.case_id || null, max_iterations: v.max_iterations }),
        )}
      >
        <div>
          <label htmlFor="case_id" className="mb-1.5 block text-xs font-medium text-muted-foreground">Case</label>
          <div className="relative">
            <select
              id="case_id"
              disabled={busy || casesLoading}
              {...register("case_id")}
              className="h-10 w-full appearance-none rounded-lg border border-border bg-background px-3 pr-9 text-sm outline-none transition-colors focus:border-emerald-400/60 disabled:opacity-60"
            >
              <option value="">All indexed cases (global search)</option>
              {cases.map((c) => (
                <option key={c.case_id} value={c.case_id}>
                  {c.case_id} · {c.specialty} · {cleanCaseTitle(c.title)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground" />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="objective" className="text-xs font-medium text-muted-foreground">Clinical objective</label>
            <span className="font-mono text-[11px] text-muted-foreground">{objective.length}/500</span>
          </div>
          <textarea
            id="objective"
            rows={5}
            disabled={busy}
            {...register("objective")}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-emerald-400/60 disabled:opacity-60"
            placeholder="Describe the presenting problem or question for this case"
          />
          {errors.objective && <p className="mt-1.5 text-xs text-red-400">{errors.objective.message}</p>}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Maximum revision rounds</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center overflow-hidden rounded-lg border border-border">
              <button type="button" disabled={busy || iterations <= 1} onClick={() => setValue("max_iterations", iterations - 1)}
                aria-label="Fewer rounds" className="flex size-9 items-center justify-center text-muted-foreground hover:bg-secondary disabled:opacity-40">
                <Minus className="size-4" />
              </button>
              <span className="w-10 text-center font-mono text-sm">{iterations}</span>
              <button type="button" disabled={busy || iterations >= 6} onClick={() => setValue("max_iterations", iterations + 1)}
                aria-label="More rounds" className="flex size-9 items-center justify-center text-muted-foreground hover:bg-secondary disabled:opacity-40">
                <Plus className="size-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Each extra round adds a Diagnostician and a Critic call.</p>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        <Button type="submit" disabled={busy} className="h-10 w-full gap-2 bg-emerald-500 text-emerald-950 hover:bg-emerald-400">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {busy ? "Analysis running" : "Run analysis"}
        </Button>
      </form>
    </Panel>
  );
}