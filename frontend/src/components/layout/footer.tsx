import Link from "next/link";
import { Braces, Database, ExternalLink } from "lucide-react";
import { SECTION_LIST } from "@/lib/sections";
import { API_BASE } from "@/lib/api";

const REPO =
  "https://github.com/zahmed02/AI4015-Agentic-AI-System-for-Longitudinal-Patient-Case-Summarization-and-Hypothesis-Generation";
const DATASET = "https://github.com/ljwztc/MedChain";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-8 md:grid-cols-3">
        <div>
          <p className="text-sm font-semibold">ChronoMed</p>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Experimental research system. Outputs are not a diagnosis and must be reviewed by a
            licensed clinician before any clinical use.
          </p>
        </div>

        <nav aria-label="Footer navigation">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pages</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {SECTION_LIST.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="text-muted-foreground transition-colors hover:text-foreground">
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project</p>
          <ul className="space-y-2 text-sm">
            {[
              { href: REPO, label: "Source repository", icon: ExternalLink },
              { href: DATASET, label: "MedChain dataset", icon: Database },
              { href: `${API_BASE}/docs`, label: "API documentation", icon: Braces },
            ].map(({ href, label, icon: Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon className="size-3.5" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">AI4015 · Agentic AI course project</p>
        </div>
      </div>
    </footer>
  );
}