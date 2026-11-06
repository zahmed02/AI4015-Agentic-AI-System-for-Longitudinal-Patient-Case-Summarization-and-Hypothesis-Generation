# Agentic AI System for Longitudinal Patient Case Summarization & Hypothesis Generation

# Course: AI4015 Agentic Artificial Intelligence

A full-stack AI application designed to demonstrate how multiple specialized agents can collaborate to solve complex clinical reasoning tasks. Unlike a standard chatbot, ChronoMed uses a stateful, self-correcting loop to summarize longitudinal patient histories, propose differential diagnoses, and critically evaluate its own reasoning against retrieved evidence.

## Architecture & Agent Workflow

The system is built on **LangGraph** and uses a three-agent pipeline that loops until consensus is reached (or a maximum iteration limit is hit):

1. **The Historian:** Retrieves relevant clinical text chunks from ChromaDB and structured entities from Neo4j to build a clean, chronological patient timeline.
2. **The Diagnostician:** Analyzes the timeline to propose exactly three differential diagnoses, complete with confidence scores, evidence citations, and clinical reasoning.
3. **The Critic:** Reviews the Diagnostician's output. It checks for unsupported claims, contradictions with the source text, and missing data. If issues are found, it routes the state back to the Historian (for wider retrieval) or the Diagnostician (for better reasoning).

## Key Features

* **Hybrid Retrieval (RAG + GraphRAG):** Combines semantic vector search (ChromaDB) with structured knowledge graph relationships (Neo4j).
* **Clinical Graph Integrity:** The knowledge graph strictly separates confirmed diagnoses (`HAS_CONFIRMED_DIAGNOSIS`) from conditions that were considered but ruled out (`CONSIDERED_DIAGNOSIS`), preventing the AI from treating ruled-out diseases as facts.
* **Live Progress Streaming:** Uses a background job runner and Server-Sent Events (SSE) so the frontend can display the agents thinking in real-time, rather than waiting 3-5 minutes for a blocking API call.
* **Deterministic Guardrails:** Rule-based safety gates reject prompt injections, empty objectives, and unauthorized prescribing questions before they ever reach the LLM.
* **Interactive Frontend:** A dark-themed Next.js dashboard with pages for live analysis, corpus exploration, graph visualization, and system health.

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend / API** | Python 3.13, FastAPI, Uvicorn |
| **Agent Orchestration** | LangGraph, LangChain |
| **LLMs (Free Tier)** | Gemini 1.5 Flash (Primary), Groq GPT-OSS-120B (Fallback) |
| **Vector Store** | ChromaDB, `sentence-transformers/all-MiniLM-L6-v2` |
| **Knowledge Graph** | Neo4j (via Docker) |
| **Frontend** | Next.js 15 (App Router), React, TailwindCSS, shadcn/ui |
| **Data Fetching** | TanStack Query, TypeScript, Zod |
| **Data Source** | MedChain Dataset (Hugging Face) |

## Project Structure

```text
AI4015-Agentic-AI-Project/
├── data/                  # Raw MedChain dataset, ChromaDB, translation cache
├── docs/                  # Architecture diagrams and evaluation notes
├── frontend/              # Next.js web application
├── scripts/               # CLI runners (ingestion, KG building, evaluation)
├── src/                   # Python backend
│   ├── agents/            # LangGraph nodes (Historian, Diagnostician, Critic)
│   ├── api/               # FastAPI routes, background job runner
│   ├── graph/             # StateGraph workflow definition
│   ├── ingestion/         # Loading, translation, chunking, KG extraction
│   ├── prompts/           # System prompts for each agent
│   ├── retrieval/         # Vector store and Graph retriever wrappers
│   ├── tools/             # Lab calculator, drug interactions, web search
│   └── utils/             # Guardrails, config, logger
├── tests/                 # Pytest suite for deterministic logic
├── docker-compose.yml     # Spins up Neo4j
└── requirements.txt       # Python dependencies
```

## Getting Started

### 1. Backend Setup

Requires Python 3.11+. Ensure you have a `.env` file with your `GEMINI_API_KEY` and `GROQ_API_KEY`.

```bash
# Start Neo4j
docker compose up -d

# Install dependencies
pip install -r requirements.txt

# Run the API server
uvicorn src.api.main:app --reload --port 8000
```

### 2. Data Preparation (Optional)

If you need to rebuild the databases from scratch:

```bash
# Download the dataset
python scripts/download_dataset.py

# Ingest, translate, and embed cases
python scripts/ingest_batch.py --limit 100

# Extract entities into the Neo4j knowledge graph
python scripts/build_kg.py
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000` to view the dashboard.

## Evaluation

The system includes unit tests for all deterministic logic (parsing, guardrails, routing) and an offline RAGAS evaluation script.

```bash
# Run fast tests (no LLM quota burned)
pytest -m "not slow"

# Run RAGAS evaluation
python src/evaluation/ragas_eval.py
```

## Limitations

* **Free Tier Limits:** The translation and reasoning models rely on free API tiers. Ingestion speed is throttled to respect rate limits.
* **Not for Clinical Use:** ChronoMed is an experimental research project. All outputs include a disclaimer and must not be used for real-world medical decision-making.
