import {
  Brain, Braces, ClipboardCheck, Cpu, Database, Download, FileText, GitBranch, HardDrive,
  Languages, ListChecks, MessageSquare, Monitor, Network, Save, Scale, Scissors, ScrollText,
  Server, ShieldCheck, Sparkles, Stethoscope, Timer, type LucideIcon,
} from "lucide-react";

/* ───────── shared vocabulary ───────── */

export type Tag = "llm" | "local" | "writes" | "reads" | "check";

export const TAGS: Record<Tag, { short: string; long: string; className: string }> = {
  llm: { short: "LLM call", long: "Spends tokens on the language model", className: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300" },
  local: { short: "Local", long: "Runs on your computer, costs no tokens", className: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  writes: { short: "Writes", long: "Saves data to disk or memory", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  reads: { short: "Reads", long: "Reads saved data", className: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  check: { short: "Safety", long: "Rule-based safety check", className: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
};

export const COLORS = {
  cyan: "#22d3ee",
  emerald: "#34d399",
  sky: "#38bdf8",
  amber: "#fbbf24",
  violet: "#a78bfa",
  rose: "#fb7185",
  fuchsia: "#e879f9",
} as const;
export type ColorKey = keyof typeof COLORS;

export interface Row {
  label: string;
  value: string;
}

/* ───────── Phase 1: data preparation (offline) ───────── */

export interface OfflineStep {
  id: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  color: ColorKey;
  tags: Tag[];
  where: string;
  handoff: string;
  rows: Row[];
}

export const OFFLINE_STEPS: OfflineStep[] = [
  {
    id: "dataset",
    title: "MedChain dataset",
    summary: "The raw clinical cases. They are downloaded once from Hugging Face and never changed.",
    icon: Download,
    color: "cyan",
    tags: ["writes"],
    where: "scripts/download_dataset.py",
    handoff: "merged_cases.json with 12,163 case records",
    rows: [
      { label: "Source", value: "Hugging Face dataset ljwztc/MedChain. It is public, so no token is needed." },
      { label: "Saved to", value: "data/raw/MedChain/merged_cases.json" },
      { label: "Used by the pipeline", value: "Only merged_cases.json. The images and image reports in the same download are not used." },
      { label: "Reference code", value: "The MedChain GitHub code is cloned into external/MedChain for reference and is not imported." },
    ],
  },
  {
    id: "load",
    title: "Load, flatten and label",
    summary: "Cases are read one at a time. The loader remembers where it stopped, so a run can be stopped and resumed.",
    icon: ListChecks,
    color: "sky",
    tags: ["reads", "writes", "local"],
    where: "src/ingestion/loader.py, progress_tracker.py",
    handoff: "Chinese case text with an English specialty",
    rows: [
      { label: "Reads", value: "One case (title and record) at a time, starting from the saved position." },
      { label: "Flattens", value: "Nested JSON becomes headed text: sections turn into ## headings and lists into bullet points." },
      { label: "Specialty", value: "The Chinese department tag is mapped to English with a hand-built table made from the department names found in the data." },
      { label: "Progress file", value: "data/processed/ingest_progress.json is rewritten after every case (next index, successes, failed cases). It is replaced atomically, so stopping with Ctrl+C loses nothing." },
      { label: "Failures", value: "Failed cases are retried first on the next run. Three failures in a row stop the run cleanly, which usually means a rate limit." },
    ],
  },
  {
    id: "translate",
    title: "Translate to English",
    summary: "Each case is translated from Chinese to English. Every result is cached, so a case is never translated twice.",
    icon: Languages,
    color: "fuchsia",
    tags: ["llm", "writes"],
    where: "src/ingestion/translator.py",
    handoff: "English text, with the original Chinese kept in metadata",
    rows: [
      { label: "Prompt", value: "Act as a medical translator, use standard English terms, and keep dates, drug names, doses, lab values and the headings exactly." },
      { label: "Model order", value: "Groq openai/gpt-oss-120b (3 tries), then Groq openai/gpt-oss-20b (2 tries), then Gemini (1 try)." },
      { label: "Limits", value: "Input is cut at 8,000 characters, at most 15 requests per minute, and Groq output is capped at 8,000 tokens." },
      { label: "Cache", value: "data/processed/translation_cache.jsonl, one line per translation, keyed by a SHA-256 hash of the text. It is checked before every call." },
      { label: "Token use", value: "One call for each case that is not in the cache. Cached cases cost nothing." },
      { label: "Metadata kept", value: "case_id, title, English specialty and the original Chinese text (original_text)." },
    ],
  },
  {
    id: "chunk",
    title: "Chunk the text",
    summary: "The English text is cut into overlapping pieces so search can find the right part of a case.",
    icon: Scissors,
    color: "amber",
    tags: ["local"],
    where: "src/ingestion/chunker.py",
    handoff: "Chunks such as 48_c0, 48_c1 and so on",
    rows: [
      { label: "Splitter", value: "A recursive character splitter. It prefers to cut at ## headings, then blank lines, line breaks, sentence ends and spaces." },
      { label: "Size", value: "1,000 characters per chunk with 150 characters of overlap, and at most 30 chunks per case." },
      { label: "Naming", value: "Each chunk is named after its case, for example 48_c0 to 48_c5. Case id, title, specialty and chunk position travel with it." },
      { label: "Token use", value: "None. This runs on your computer." },
    ],
  },
  {
    id: "embed",
    title: "Embed",
    summary: "Each chunk becomes a list of numbers that captures its meaning, so similar text lands close together.",
    icon: Cpu,
    color: "violet",
    tags: ["local"],
    where: "src/retrieval/vector_store.py",
    handoff: "One vector per chunk",
    rows: [
      { label: "Model", value: "sentence-transformers/all-MiniLM-L6-v2, running on the CPU. No API key and no token cost." },
      { label: "Output", value: "384 numbers per chunk, normalized." },
      { label: "Loading", value: "The model loads once per server process and is warmed up when the API starts." },
    ],
  },
  {
    id: "index",
    title: "Index in ChromaDB",
    summary: "Chunks and their vectors are saved in a local vector database. This is what the Historian searches at analysis time.",
    icon: Database,
    color: "sky",
    tags: ["writes"],
    where: "src/retrieval/vector_store.py (index_chunks)",
    handoff: "Separate script, run on demand: the knowledge graph",
    rows: [
      { label: "Saved to", value: "data/knowledge_base/chroma, collection patient_records." },
      { label: "Append only", value: "New chunks are added to the collection. Indexing the same case twice would create duplicates, which is why ingestion tracks its progress." },
      { label: "Read by", value: "The Historian on every analysis, plus the Cases and Overview pages." },
    ],
  },
  {
    id: "graph",
    title: "Knowledge graph",
    summary: "A separate script, run on demand. It reads each case again and stores its main facts as a graph in Neo4j.",
    icon: Network,
    color: "violet",
    tags: ["llm", "writes"],
    where: "src/ingestion/kg_builder.py, scripts/build_kg.py",
    handoff: "",
    rows: [
      { label: "Starts from", value: "The same translated text, taken from the translation cache, so it costs no translation calls." },
      { label: "Prompt", value: "Extract symptoms, confirmed diagnoses, differential diagnoses (considered but not confirmed) and treatments, at most 5 of each, as strict JSON." },
      { label: "Limits", value: "Input is cut at 4,000 characters. One LLM call per case. Cases already in the graph are skipped." },
      { label: "Saved to", value: "Neo4j (Docker container, files in data/neo4j) with MERGE, so reruns are safe." },
      { label: "Relations", value: "HAS_SYMPTOM, HAS_CONFIRMED_DIAGNOSIS, CONSIDERED_DIAGNOSIS and RECEIVED_TREATMENT." },
      { label: "Coverage", value: "Only the cases you build are in the graph. Analysis still works without it." },
    ],
  },
];

/* ───────── Phase 2: one analysis run (online) ───────── */

export type NodeId =
  | "request" | "guardrails" | "job" | "historian" | "diagnostician"
  | "critic" | "router" | "report" | "chroma" | "neo4j";

export type EdgeId = "e1" | "e2" | "e3" | "e4" | "e5" | "e6" | "e7" | "e8" | "e9" | "reject" | "r1" | "r2";

export interface OnlineNode {
  label: string;
  sub: string;
  icon: LucideIcon;
  color: ColorKey;
  tags: Tag[];
  where: string;
  summary: string;
  rows: Row[];
}

export const ONLINE_NODES: Record<NodeId, OnlineNode> = {
  request: {
    label: "Your request", sub: "Browser form", icon: MessageSquare, color: "cyan", tags: [],
    where: "frontend/src/components/analyze/analysis-form.tsx",
    summary: "Everything starts in your browser, on the Analysis page.",
    rows: [
      { label: "Case", value: "Optional. Choosing one limits the search to that case." },
      { label: "Objective", value: "3 to 500 characters, checked in the form before anything is sent." },
      { label: "Revision rounds", value: "1 to 6, default 2." },
      { label: "Sent as", value: "POST /analyze/start" },
    ],
  },
  guardrails: {
    label: "Guardrails", sub: "Plain code, no LLM", icon: ShieldCheck, color: "rose", tags: ["check", "local"],
    where: "src/utils/guardrails.py",
    summary: "Rule-based checks that run before any model is called.",
    rows: [
      { label: "Rejects", value: "Empty text, more than 500 characters, instruction-override attempts (4 patterns) and personal dosing or prescribing questions (3 patterns)." },
      { label: "On failure", value: "HTTP 400 with the reason, shown under the form. No model is called." },
      { label: "Cost", value: "No LLM and no tokens." },
    ],
  },
  job: {
    label: "Job runner", sub: "Background thread", icon: Timer, color: "amber", tags: ["local", "writes"],
    where: "src/api/jobs.py",
    summary: "Long analyses run in the background so the browser never waits on one request.",
    rows: [
      { label: "Starts", value: "A background thread, and returns a job id at once." },
      { label: "Records", value: "One event each time an agent finishes. This is the live reasoning trace." },
      { label: "Polled", value: "By the browser every 2 seconds." },
      { label: "Stored", value: "In server memory, up to 50 jobs. A server restart clears them." },
    ],
  },
  historian: {
    label: "Historian", sub: "Search + timeline", icon: ScrollText, color: "sky", tags: ["reads", "llm", "writes"],
    where: "src/agents/historian_agent.py",
    summary: "Finds the relevant case text and turns it into a structured clinical timeline.",
    rows: [
      { label: "Reads", value: "The objective, the optional case id and, on a retry, the Critic feedback." },
      { label: "Searches", value: "ChromaDB for the 8 closest chunks, filtered to the case when one is chosen." },
      { label: "Adds", value: "That case's Neo4j entities when available, with confirmed and considered diagnoses labelled." },
      { label: "LLM call", value: "1. Builds a timeline with 7 fixed headings and writes Not documented instead of guessing." },
      { label: "Writes to state", value: "retrieved_chunks and clinical_timeline." },
      { label: "On a retry", value: "Looks at 16 chunks, drops the case filter and reads the Critic feedback." },
    ],
  },
  diagnostician: {
    label: "Diagnostician", sub: "3 ranked diagnoses", icon: Stethoscope, color: "emerald", tags: ["llm", "writes"],
    where: "src/agents/diagnostician_agent.py",
    summary: "Reads only the timeline and proposes three ranked differential diagnoses.",
    rows: [
      { label: "Reads", value: "The timeline, plus the Critic feedback and issues on a revision." },
      { label: "LLM call", value: "1. Returns exactly 3 differential diagnoses as JSON." },
      { label: "Each diagnosis has", value: "A confidence from 0 to 1, evidence, reasoning and citations (timeline section names)." },
      { label: "Then", value: "They are sorted by confidence." },
      { label: "Writes to state", value: "hypotheses." },
      { label: "Skips", value: "If there is no usable timeline." },
    ],
  },
  critic: {
    label: "Critic", sub: "Verdict + feedback", icon: Scale, color: "amber", tags: ["llm", "writes"],
    where: "src/agents/critic_agent.py",
    summary: "Checks every claim against the evidence and decides whether the work can stand.",
    rows: [
      { label: "Reads", value: "The timeline, the hypotheses and the retrieved excerpts." },
      { label: "LLM call", value: "1. Checks four things: unsupported claims, contradictions, missing data and overconfidence." },
      { label: "Returns", value: "Approved or not, the issues, feedback and a revision target." },
      { label: "Counts", value: "One review round each time it runs." },
      { label: "Last round", value: "Still reviewed. Leftover issues are kept and the report says the iteration limit was reached." },
    ],
  },
  router: {
    label: "Router", sub: "Plain code", icon: GitBranch, color: "violet", tags: ["local"],
    where: "src/graph/workflow.py (route_after_critic)",
    summary: "A small function that reads the Critic verdict and picks the next step.",
    rows: [
      { label: "Approved", value: "Go to the report." },
      { label: "Rounds used up", value: "Go to the report, with the open issues kept." },
      { label: "Target Historian", value: "Retrieval was too thin. Go back to the Historian." },
      { label: "Target Diagnostician", value: "Reasoning or evidence was weak. Go back to the Diagnostician." },
      { label: "Cost", value: "Plain code, no LLM." },
    ],
  },
  report: {
    label: "Report", sub: "Result + disclaimer", icon: ClipboardCheck, color: "cyan", tags: ["local", "writes"],
    where: "src/api/main.py",
    summary: "The final answer that the browser receives.",
    rows: [
      { label: "Status", value: "Approved, Iteration limit reached or Not converged." },
      { label: "Contains", value: "Hypotheses, evidence previews (first 300 characters of each chunk), the timeline and the Critic issues." },
      { label: "Safety", value: "The clinical disclaimer is appended to the timeline." },
      { label: "Then", value: "The browser shows the result tabs and saves the run in local history (last 15)." },
    ],
  },
  chroma: {
    label: "ChromaDB", sub: "Vector DB", icon: Database, color: "sky", tags: ["reads"],
    where: "data/knowledge_base/chroma",
    summary: "The vector database the Historian searches.",
    rows: [
      { label: "Holds", value: "Chunks and vectors for every indexed case." },
      { label: "Searched with", value: "The objective, embedded the same way as the chunks." },
      { label: "Returns", value: "The closest chunks with a distance score. Lower means closer." },
    ],
  },
  neo4j: {
    label: "Neo4j", sub: "Graph DB", icon: Network, color: "violet", tags: ["reads"],
    where: "src/retrieval/graph_retriever.py",
    summary: "The knowledge graph that adds structured facts for a case.",
    rows: [
      { label: "Holds", value: "Symptoms, confirmed and considered diagnoses and treatments, per case." },
      { label: "Used for", value: "Extra context for the Historian, only when the case is in the graph." },
      { label: "If it is down", value: "It is skipped quietly and the analysis continues with vector search only." },
    ],
  },
};

export interface LoopStep {
  focus: NodeId;
  nodes: NodeId[];
  edges: EdgeId[];
  caption: string;
}

export const STEPS: LoopStep[] = [
  { focus: "request", nodes: ["request"], edges: [],
    caption: "Everything starts in your browser. You choose a case (or search all cases), describe the question and set how many revision rounds are allowed." },
  { focus: "guardrails", nodes: ["request", "guardrails"], edges: ["e1", "reject"],
    caption: "Plain-code safety checks run first. Empty, oversized, instruction-override and personal dosing questions are stopped here with a clear message. No model is called." },
  { focus: "job", nodes: ["guardrails", "job"], edges: ["e2"],
    caption: "A background job starts and returns an id straight away. The browser polls it every 2 seconds and shows each agent step as it finishes." },
  { focus: "historian", nodes: ["job", "historian", "chroma", "neo4j"], edges: ["e3", "r1", "r2"],
    caption: "The Historian searches ChromaDB for the closest case excerpts and adds the case entities from Neo4j. One LLM call turns them into a structured timeline." },
  { focus: "diagnostician", nodes: ["historian", "diagnostician"], edges: ["e4"],
    caption: "The Diagnostician reads only the timeline and proposes three ranked diagnoses with evidence and citations. One LLM call." },
  { focus: "critic", nodes: ["diagnostician", "critic"], edges: ["e5"],
    caption: "The Critic checks every claim against the timeline and the retrieved excerpts. One LLM call returns a verdict and a revision target." },
  { focus: "router", nodes: ["critic", "router"], edges: ["e6"],
    caption: "A small piece of code reads the verdict and decides what happens next. Approved, or out of rounds, ends the loop. Otherwise the work is sent back." },
  { focus: "diagnostician", nodes: ["router", "diagnostician"], edges: ["e8"],
    caption: "Reasoning or evidence was weak, so the Diagnostician runs again, this time with the Critic feedback and issues." },
  { focus: "historian", nodes: ["router", "historian"], edges: ["e9"],
    caption: "Retrieval was too thin, so the Historian runs again. It looks at 16 chunks, drops the case filter and reads the Critic feedback." },
  { focus: "report", nodes: ["router", "report"], edges: ["e7"],
    caption: "Once approved, or when the rounds run out, the report is built, the disclaimer is added and the browser shows and saves it." },
];

/* ───────── LLM calls and tokens ───────── */

export interface CallStage {
  id: "prompt" | "provider" | "reasoning" | "parse" | "state";
  title: string;
  owner: "Local" | "Provider";
  icon: LucideIcon;
  text: string;
}

export const CALL_STAGES: CallStage[] = [
  { id: "prompt", title: "Assemble the prompt", owner: "Local", icon: FileText,
    text: "A fixed system prompt for the role, plus the objective and the context for this step: excerpts, the timeline or the Critic feedback. Temperature is 0, so answers are as repeatable as the provider allows." },
  { id: "provider", title: "Call the model", owner: "Provider", icon: Sparkles,
    text: "The primary model answers first. If it fails (rate limit or server error) the same prompt goes to the fallback model automatically." },
  { id: "reasoning", title: "Model reasoning", owner: "Provider", icon: Brain,
    text: "This happens inside the provider. ChronoMed does not request or store reasoning traces, so only the final text comes back." },
  { id: "parse", title: "Normalize and parse", owner: "Local", icon: Braces,
    text: "Groq and Gemini return text in different shapes, so both are flattened to plain text. For JSON replies, code fences are stripped, the JSON is cut out and every field is checked. A reply that cannot be parsed never gets guessed: the Diagnostician keeps its previous answer and the Critic stops the loop." },
  { id: "state", title: "Write to the shared state", owner: "Local", icon: Save,
    text: "The timeline, hypotheses or verdict is merged into the shared state, and the job records an event that the browser shows in the reasoning trace." },
];

export interface Touchpoint {
  step: string;
  phase: "Preparation" | "Analysis";
  when: string;
  calls: string;
  input: string;
  models: string;
}

export const TOUCHPOINTS: Touchpoint[] = [
  { step: "Translation", phase: "Preparation", when: "Each case that is not yet in the cache", calls: "1",
    input: "Up to 8,000 characters of Chinese case text", models: "Groq gpt-oss-120b, then gpt-oss-20b, then Gemini" },
  { step: "Graph extraction", phase: "Preparation", when: "Each case you add to the graph", calls: "1",
    input: "Up to 4,000 characters of English case text", models: "Primary model, with fallback" },
  { step: "Historian", phase: "Analysis", when: "The first pass, and again whenever the Critic sends work back to it", calls: "1 per pass",
    input: "Up to 8 chunks of at most 1,000 characters (16 on a retry), plus graph entities when available", models: "Primary model, with fallback" },
  { step: "Diagnostician", phase: "Analysis", when: "Every pass", calls: "1 per pass",
    input: "The timeline, plus the Critic feedback and issues on a revision", models: "Primary model, with fallback" },
  { step: "Critic", phase: "Analysis", when: "Every review round, including the last one", calls: "1 per round",
    input: "The timeline, the three diagnoses and all retrieved chunks", models: "Primary model, with fallback" },
];

export const NO_TOKEN_STEPS = [
  "Guardrails",
  "Chunking",
  "Embeddings and search",
  "Routing after the Critic",
  "Output parsing",
  "Lab, drug and web tools",
];

/* ───────── Where data lives ───────── */

export interface Store {
  id: "raw" | "progress" | "cache" | "chroma" | "neo4j" | "jobs" | "browser";
  name: string;
  path: string;
  icon: LucideIcon;
  color: ColorKey;
  writtenBy: string;
  when: string;
  readBy: string;
}

export const STORES: Store[] = [
  { id: "raw", name: "MedChain files", path: "data/raw/MedChain", icon: HardDrive, color: "cyan",
    writtenBy: "scripts/download_dataset.py", when: "Once, when you download the dataset", readBy: "The loader, which reads merged_cases.json" },
  { id: "progress", name: "Ingestion progress", path: "data/processed/ingest_progress.json", icon: ListChecks, color: "sky",
    writtenBy: "progress_tracker.py", when: "After every case, replaced atomically", readBy: "The loader on the next run, and the batch status command" },
  { id: "cache", name: "Translation cache", path: "data/processed/translation_cache.jsonl", icon: FileText, color: "fuchsia",
    writtenBy: "translator.py", when: "One line appended after each new translation", readBy: "The translator before every call, and the graph builder" },
  { id: "chroma", name: "ChromaDB", path: "data/knowledge_base/chroma", icon: Database, color: "sky",
    writtenBy: "vector_store.index_chunks", when: "After a batch of cases is translated and chunked", readBy: "The Historian on every analysis, plus the Cases and Overview pages" },
  { id: "neo4j", name: "Neo4j knowledge graph", path: "Docker volume at data/neo4j", icon: Network, color: "violet",
    writtenBy: "kg_builder.py through scripts/build_kg.py", when: "On demand, one case at a time", readBy: "The Historian, the Knowledge Graph page, entity search and the case popup" },
  { id: "jobs", name: "Job store", path: "API server memory", icon: Server, color: "amber",
    writtenBy: "src/api/jobs.py", when: "When a job starts and after each agent finishes", readBy: "The browser, by polling every 2 seconds. Only 50 jobs are kept and a server restart clears them" },
  { id: "browser", name: "Browser storage", path: "localStorage in your browser", icon: Monitor, color: "emerald",
    writtenBy: "The frontend", when: "When an analysis starts (active job id) and completes (last 15 saved)", readBy: "Overview, the history popup, and resuming a running job after a refresh" },
];