# Rahul Rangarao

**Analytics → AI Engineering** · North Brunswick, NJ
rahulmohanrangarao@gmail.com · [linkedin.com/in/rahul-mohan](https://www.linkedin.com/in/rahul-mohan/) · [github.com/rahulmranga](https://github.com/rahulmranga) · [rahulrangarao.dev](https://rahulrangarao.dev)

---

## Summary

Analytics professional at Bristol Myers Squibb with an end-to-end data skill set, transitioning into AI engineering on the strength of shipped, production-quality open source. Author of **knowledge-worker**, a published PyPI package that gives AI assistants durable, provenance-backed memory: a local-first knowledge graph with graph analytics, LLM-backed ingest, and a hard provenance invariant. Generalist by nature: comfortable owning a problem from data ingestion through modeling, tooling, and the report on a stakeholder's desk.

## Open Source

### knowledge-worker — Author & Maintainer
*Local-first personal knowledge graph for durable AI memory* · [PyPI](https://pypi.org/project/knowledge-worker/) · [GitHub](https://github.com/rahulmranga/knowledge-worker) · May 2026 – present

- Designed and shipped a provenance-first knowledge graph engine: every durable claim must carry a source document and literal excerpt before entering the graph, enforced by deterministic validation.
- Built the full CLI surface (`mykg`): ingest, query, path-finding, review/merge, context export, deep-dive pre-ingest workspaces, and an offline HTML graph visualizer.
- Implemented a graph-analytics audit layer (PageRank, betweenness, k-core, community detection, weak-claim queues) so users can see what their AI memory actually knows, and where it is thin.
- Architected open-web storage: canonical JSON-LD, append-only JSONL history, and Turtle/RDF interchange, with zero runtime dependencies in the core (Python stdlib only); LLM backends (Anthropic, OpenAI, Ollama) and RDF export ship as optional extras.
- Established a 9-benchmark public test suite guarding provenance, audit coverage, recall, privacy boundaries, and context compactness; GitHub Actions CI across Python 3.10–3.13.
- Published to PyPI (v0.8.0); ~500 downloads/month and growing, adopted for real cross-session AI workflows including my own daily knowledge graph.

### Related builds
- **kompress-ultra** · context-management middleware experiments for AI agent frameworks: live-data TUI dashboards, knowledge-graph visualizations, GitHub Pages deploy pipeline.
- **AG-UI protocol** · open protocol work for agent/UI interoperability.

## Experience

### Bristol Myers Squibb — Analytics Professional
*[exact title(s)]* · New Brunswick NJ / Austin TX / Bengaluru India · *[dates]*

- Delivered end-to-end analysis, from data ingestion to stakeholder-ready reporting, within a single day; recognized with the **Impact Award** (Sept 2021).
- Recognized with a **SPOT Award** (Aug 2020) for stakeholder communication and building business context around analytics deliverables.
- *[2–3 bullets on your biggest BMS projects: the data platforms you worked on, scale of data, teams served, tools (Snowflake per your cert), and any ML/LLM work you have done internally]*

## Education

**The University of Texas at Austin** · *[degree/program]* · 2022 – 2023
**[Undergraduate institution]** · *[degree]* · 2014 – 2018

## Skills

**Languages & Data:** Python, SQL, Snowflake, data warehousing, JSON-LD / RDF / linked data
**AI Engineering:** LLM API integration (Anthropic, OpenAI, Ollama), agent context management, retrieval & memory systems, prompt/context engineering
**Graph & Analysis:** knowledge graphs, PageRank / betweenness / k-core / community detection, provenance modeling
**Engineering Practice:** CLI tooling, Python packaging (PyPI), GitHub Actions CI, benchmark-driven testing, local-first architecture

## Certifications & Awards

- Hands On Essentials: Data Warehouse — Snowflake, Oct 2022
- Impact Award (2021) · SPOT Award (2020) — Bristol Myers Squibb
- Programming for Everybody (Python) — Coursera, 2016

## Languages

English · Kannada · Hindi
