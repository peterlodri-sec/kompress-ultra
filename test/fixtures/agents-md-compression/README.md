## AGENTS.md compression: caveman-compress vs kompress-ultra

Fixture: a 290-line real `AGENTS.md` (workspace root doc, mixed prose + code
fences + tables). Compressed two ways, then measured.

### Method

- `00-original.md` — source, unmodified.
- `01-caveman.md` — hand-applied **caveman-compress** rules
  (`~/.agents/skills/caveman-compress/SKILL.md`). The skill's CLI shells out to
  the Anthropic API; the workspace's `.claude.json` had no usable key for that
  path, so the LLM-compression step was applied by the same model the CLI
  would invoke, following the skill's published Remove/Preserve/Compress
  rules verbatim. Code fences, URLs, inline code, tables kept intact.
- `02-kompress-ultra.md` — `CompressionLevel.Ultra` via
  `bun run scripts/run-ultra.mjs`, i.e. the real library function in
  `src/rewriter.ts`.

### Results

| Artifact             | Bytes  | Lines | Δ bytes vs original |
|----------------------|--------|-------|---------------------|
| `00-original.md`     | 15,502 | 290   | —                   |
| `01-caveman.md`      | 14,450 | 203   | −6.8 %              |
| `02-kompress-ultra.md` | 13,998 | 99    | −9.7 %              |

### Observations

- **caveman-compress** preserves markdown structure (headings, tables,
  bullets, code fences) and only shortens prose. Readable end-to-end; safe to
  ship as a memory file. Savings modest because most volume is structural.
- **kompress-ultra (Ultra)** strips more filler and collapses sentence
  boundaries, but mangles inline code spacing
  (`AGENTS. md`, `. gitignore`, `. claude/settings. json`) and flattens the
  markdown structure — headings, blockquotes, and table rows get glued onto
  single lines. The regex pipeline in `rewriter.ts` operates on raw character
  streams without a markdown-aware guard, so `inline code` survives the
  `__CODE_BLOCK_` protection (only fenced blocks are protected) but the
  surrounding prose reformatting injects spaces inside backticks.
- Neither tool lost fenced code blocks — `__CODE_BLOCK_n__` round-trips
  cleanly in kompress-ultra.

### Recommendation

- For **memory files** (CLAUDE.md / AGENTS.md), prefer `caveman-compress`:
  structure-preserving, safe, readable.
- For **tool-output / chat-history pruning** (the kompress-ultra design
  target), the Ultra level is fine — structural mangling is irrelevant when
  the goal is token budget, not document fidelity.
- A markdown-aware pre-pass (protect inline code spans the same way fenced
  blocks are protected) would let kompress-ultra reach caveman-grade
  document fidelity. Left as a follow-up.