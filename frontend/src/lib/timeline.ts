export interface TimelineLine {
  text: string;
  bullet: boolean;
}

export interface TimelineSection {
  title: string;
  lines: TimelineLine[];
  documented: boolean;
}

const HEADINGS = [
  "Chief Complaint",
  "History of Present Illness",
  "Past Medical History",
  "Physical Examination",
  "Auxiliary Examinations",
  "Preliminary Diagnosis",
  "Treatment Given",
];

const normalize = (s: string) =>
  s.replace(/\*\*/g, "").replace(/^#+\s*/, "").replace(/:$/, "").trim().toLowerCase();

/** The API appends the clinical disclaimer after a "---" line. Split it off. */
export function splitDisclaimer(text: string) {
  const marker = "\n---\n";
  const idx = text.lastIndexOf(marker);
  if (idx === -1) return { body: text.trim(), disclaimer: "" };
  return { body: text.slice(0, idx).trim(), disclaimer: text.slice(idx + marker.length).trim() };
}

export function parseTimeline(body: string): TimelineSection[] {
  const sections: TimelineSection[] = [];
  let current: TimelineSection | null = null;

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const headingIndex = HEADINGS.findIndex((h) => h.toLowerCase() === normalize(line));
    if (headingIndex !== -1) {
      current = { title: HEADINGS[headingIndex], lines: [], documented: true };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { title: "Summary", lines: [], documented: true };
      sections.push(current);
    }
    current.lines.push({
      text: line.replace(/^[-*•]\s+/, ""),
      bullet: /^[-*•]\s+/.test(line),
    });
  }

  for (const s of sections) {
    s.documented = !(
      s.lines.length === 0 ||
      s.lines.every((l) => /^not documented\.?$/i.test(l.text.replace(/\*\*/g, "").trim()))
    );
  }
  return sections;
}