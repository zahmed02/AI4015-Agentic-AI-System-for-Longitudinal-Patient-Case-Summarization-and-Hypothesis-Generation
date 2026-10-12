import type { LucideIcon } from "lucide-react";
import { Inbox, ServerCrash } from "lucide-react";
import type { ReactNode } from "react";
import { API_BASE, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function ErrorState({
  error, onRetry, title = "Could not load data",
}: { error: unknown; onRetry?: () => void; title?: string }) {
  const unreachable = !(error instanceof ApiError);
  const message = error instanceof ApiError ? error.message : "The backend did not respond.";
  return (
    <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
      <div className="flex items-start gap-3">
        <ServerCrash className="mt-0.5 size-5 shrink-0 text-red-400" />
        <div className="min-w-0">
          <p className="font-medium text-red-200">{title}</p>
          <p className="mt-1 text-sm text-red-200/80">{message}</p>
          {unreachable && (
            <p className="mt-2 text-xs text-red-200/70">
              Expected the API at <code className="font-mono">{API_BASE}</code>. Start it from the project
              root with <code className="font-mono">uvicorn src.api.main:app --port 8000</code>.
            </p>
          )}
          {onRetry && (
            <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox, title, description, action,
}: { icon?: LucideIcon; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-secondary/50">
        <Icon className="size-6 text-muted-foreground" />
      </span>
      <p className="mt-4 text-sm font-semibold">{title}</p>
      {description && <div className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}