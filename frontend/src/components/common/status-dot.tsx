import { cn } from "@/lib/utils";

export type StatusState = "ok" | "down" | "unknown";

export function StatusDot({ label, state }: { label: string; state: StatusState }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={`${label}: ${state}`}>
      <span className="relative flex size-2">
        {state === "ok" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/60" />}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            state === "ok" && "bg-emerald-400",
            state === "down" && "bg-red-500",
            state === "unknown" && "bg-slate-500",
          )}
        />
      </span>
      {label}
    </span>
  );
}