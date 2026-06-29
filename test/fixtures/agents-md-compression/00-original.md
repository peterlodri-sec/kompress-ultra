# AGENTS.md — `peterlodri-sec` workspace root

This directory is **not a single repo**. It is a workspace/aggregator holding
~70 independent projects, each its own git repo with its own remote. The root
itself is not versioned (`.gitignore` only excludes `_cold-archive/`).

Every top-level subdirectory should be treated as a self-contained project
that has its own `AGENTS.md` / `CLAUDE.md` and tooling. **Always `cd` into the
target project before running build/test/git** — commands do not compose
across project boundaries here.

> **Before editing any Nix file**, look up the live API in context7 first
> (`query-docs` for nixpkgs / home-manager / nix-darwin / sops-nix / disko /
> flake-parts). nixpkgs-unstable churns; do not write from memory.

---

## Primary nix fleet (the "in-scope" repos)

The original purpose of this workspace is the NixOS/nix-darwin fleet. Two
repos are "in scope" per `.claude/system-prompt.md`; the rest are satellite
projects that live alongside.

| Repo | What it is | Flake inputs of note |
|------|------------|----------------------|
| `nix-base/` | Fleet flake-managing 3 Hetzner hosts + 1 Mac + ~30 services | nixos-unstable · flake-parts · nix-darwin · sops-nix · home-manager · stylix · disko · microvm |
| `nixos-runners/` | Self-hosted GitHub Actions runners (`runner-01` x86_64, `runner-02` aarch64) | nixos-25.05 · disko |

Satellites that share the `nix-base-*` prefix (`nix-base-deploy`,
`nix-base-hermes`, `nix-base-cx53-*`, `nix-base-aperture`, `nix-base-oracle`,
`nix-base-bux`, `nix-base-desktop`, `nix-base-dev-cx53`, `nix-base-cheatsheet`,
`nix-base/psh-deploy-sync`) are **mirrors / deploy variants of nix-base
targets**, not independent flakes. The rule is:
**edit `nix-base/` first, then sync** to the satellite. Do not patch a
satellite in place and expect it to flow back — the source of truth is
`nix-base/`. Each mirror ships its own `AGENTS.md`; read it only to learn the
sync target/path, not to find divergent conventions.

### nix-base fleet hosts

| Host | Role | Platform | Note |
|------|------|----------|------|
| `dev-cx53` | Build/deploy host, honcho, dev workstation | NixOS x86_64 (CX53 hel1) | Tailnet only |
| `public-services-host` | Mastodon, Forgejo, Vaultwarden, public services | NixOS x86_64 (CX33 fsn1) | Public SSH + :80/:443 |
| `hetzner` | GitHub runners, Nixery, ARM64 workloads | NixOS aarch64 (CAX31 fsn1) | Tailnet only |
| `mbp` | nix-darwin workstation (M3) | aarch64-darwin | Not remote-managed |
| `vaultwarden-pi`, `macbook-air` | Additional host dirs | — | See host `default.nix` |

### nix-base deploy commands

> **`nh` (nushell-powered `nh`) is the canonical entrypoint for all fleet
> operations.** Prefer `nh os switch` / `nh home switch` over raw
> `nixos-rebuild` or `nix build`. The `nixos-rebuild *` / `nix-darwin *`
> entries in `.claude/settings.json` are escape-hatches, not the primary path.

```bash
# One-shot provision new Hetzner VM
nix run github:nix-community/nixos-anywhere -- \
  --build-on-remote --flake .#<hostname> root@<ip>

# Ongoing updates from Mac (builds on dev-cx53, switches target)
nh os switch .#dev-cx53 \
  --build-host dev-cx53.tail2870dc.ts.net \
  --target-host dev-cx53.tail2870dc.ts.net

nh os switch .#public-services-host \
  --build-host dev-cx53.tail2870dc.ts.net \
  --target-host root@167.233.105.32
```

home-manager / dotfile deploy uses `tasks.py` (task runner) — short-by-short
builds `#homeConfigurations.dev.activationPackage`. Run from inside `nix-base/`.
Python tasks are always invoked via `uv` (project standard for Python):

```bash
uv run task deploy_dotfiles   # build + activate home-manager (Mac path)
uv run task hm_switch          # `nh home switch` path (dev-cx53)
```

### Critical nix-base conventions (non-obvious)

- **Module namespace**: all custom options live under `peterlodri.<name>`,
  never bare top-level. Adding bare options breaks evaluation.
- **Secrets**: sops-nix + per-host age key at `/var/lib/sops-nix/key.txt`
  (staged at install, never committed). `.sops.yaml` holds creation rules +
  age recipients. **Never commit credentials to `.nix` files.**
- **Darwin sops gap is OPEN**: `tokenSecretPath` and `barkKeySecretPath` on
  `mbp` need a launchd loader because sops-nix does not natively activate
  on darwin. Flag this before touching any secret delivery on `mbp`.
- **Pinned security nixpkgs**: `nix-base` keeps a separate
  `nixpkgs-patched` input pinned at a specific commit solely for the
  Mastodon CVE fix on `public-services-host`. Do not let it drift onto the
  rest of the fleet; drop it once the main pin advances past Mastodon 4.5.11.
- **Private flake inputs**: `cloak-fetch` and `fieldfeed` point
  at private sources. PUBLIC consumers must override them to `stubs/*`:
  ```bash
  nix flake show \
    --override-input cloak-fetch path:./stubs/cloak-fetch \
    --override-input fieldfeed   path:./stubs/fieldfeed
  ```
  Real `fieldfeed` also needs a `github.com` nix access-token (read access to
  `peterlodri-sec/fieldfeed`) in `~/.config/nix/access-tokens.conf` — never
  commit it.
- **Stream annotations**: when leaving TODOs that cross the open work
  streams, annotate `# Stream N lands here:` (streams 2/3/5 per system prompt).
- **Formatter**: `nixpkgs-fmt` (`formatter = pkgs.nixpkgs-fmt` in the flake).
  Run before committing Nix.
- **Extra binary caches** (declared in `nix-base/flake.nix`):
  `microvm.cachix.org` and `attic.xuyh0120.win/lantian` with the listed public
  keys. `microvm.cachix.org` matters for `microvm.nix` builds.

### nix-base layout cheat-sheet

```
hosts/<name>/{default,disko,sops}.nix   host config, disk, sops rules
hosts/<name>/*.nix                      per-host service modules
modules/                                reusable NixOS modules under peterlodri.*
pkgs/                                   local package derivations
secrets/                                sops-encrypted secrets (per host/service)
apps/{gh-app-broker,pr-dashboard,swe-agent,browser-pool,pool-widget}
                                          Python services (FastAPI/aiohttp)
scripts/{bootstrap.sh,deploy-dev-cx53.sh,smoke-inbox-relay.sh,...}
ci/                                     canary + ovh-ci.sh
tasks.py                                task runner (deploy_dotfiles, hm_switch, run_agent_sandbox, ...)
```

### Work streams (nix-base)

The fleet's open work is tracked as numbered **streams**. Numbers are **not
stable** — they get renumbered as work rolls off. The current set lives in
`.claude/system-prompt.md`; if that file lists streams, treat them as the
authoritative open work. As of writing:

| Stream | Target host | Work |
|--------|--------------|------|
| 2 | `hetzner` | postgresql + pgvector, github-runners, agentfield-spider-agent container |
| 3 | `mbp` | rag-stack launchd, ollama (local-openrouter), observability-trio, home-manager |
| 5 | `hetzner` | honcho-server container (`LLM_PROVIDER_URL` → Mac Ollama via Tailscale) |

Conventions:
- Implement streams **in order** unless directed otherwise.
- When a TODO crosses a stream boundary, annotate it `# Stream N lands here:`
  so the next agent knows which stream owns the follow-up.
- If you open a new stream or close one, update `.claude/system-prompt.md`
  *and* this table — the two should stay in sync.

---

## Workspace-level tooling (root only)

### Launching an agent session

The workspace is **agent-runtime-agnostic**. The bootstrap entrypoint that
ships here targets Claude Code:

```bash
.claude/launch.sh                       # default: sonnet, xhigh effort
.claude/launch.sh --model opus          # opus for deep architecture work
.claude/launch.sh --model haiku         # haiku for fast edits
.claude/launch.sh --effort high        # drop effort for repetitive tasks
.claude/launch.sh --name "stream-2"    # named session
```

`launch.sh` runs `claude --dangerously-skip-permissions --no-chrome
--strict-mcp-config --mcp-config .mcp.json --append-system-prompt
$(cat .claude/system-prompt.md) ...`. `--strict-mcp-config` means **only** the
servers in `.mcp.json` load — global `~/.claude.json` MCP servers are
suppressed. This is intentional: the workspace intentionally narrows its
tool surface.

The operator's day-to-day dev runtimes are **Crush, opencode, and whale**
(usually custom builds of each). `launch.sh` is the Claude bootstrap only —
do not read it as "the canonical way agents must enter this workspace".
Whichever runtime is in use, the *bootstrap contract* is the same: load
`.claude/system-prompt.md`, honour `.mcp.json` strictly, respect the
`.claude/settings.json` `deny` list.

### `.mcp.json` servers

| Server | Purpose / when to use |
|--------|----------------------|
| `context7` | nix ecosystem docs (nixpkgs, nix-darwin, home-manager, sops-nix, flake-parts, disko). `query-docs` before writing any nix API. |
| `brave-search` | web search for NixOS options / package availability when context7 has nothing. `brave_local_search` is **denied** in `.claude/settings.json`. |
| `honcho` | long-term memory MCP `recall` + `search` only; run via `uv run --script adhoc-runbooks/runbooks/scripts/honcho/honcho-mcp.py`, `HONCHO_USER_PEER=lodripeter`. `log_turn` is **denied**. |

> **Codebase graph intelligence is being migrated to
> [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp).**
> The previous repowise MCP entries (root and per-subproject) were a dev
> mistake and have been fully retired. Treat *any* `REPOWISE:START` block
> inside subproject `AGENTS.md` files as stale — ignore its tool-coupling
> instructions and verify against source.
>
> codebase-memory-mcp is **not yet wired into root `.mcp.json`** (planned).
> Until it is, an agent reaching for graph-style queries (callers, ownership,
> decision archaeology) should fall back to plain source reading, grep, and
> the LSP tools — not repowise. When the migration lands, prefer
> codebase-memory-mcp's tools over grepping large subprojects.

### `.claude/settings.json` (root session config)

- `effortLevel: xhigh`, `alwaysThinkingEnabled: true`
- `permissions.defaultMode: bypassPermissions`, but with a hard `deny` list:
  `mcp__brave-search__brave_local_search`, `mcp__honcho__log_turn`
- `allow` shortcuts include `Bash(nix *)`, `Bash(nixos-rebuild *)`,
  `Bash(nix-darwin *)`, `Bash(home-manager *)`, `Bash(sops *)`, `Bash(age *)`,
  `Bash(ssh hetzner *)`, `Bash(repowise *)`, and the
  `claude --dangerously-skip-permissions` launch patterns.
- `plansDirectory: .claude/plans` — persisted plan files live there.

### `.claude/system-prompt.md`

The appended system prompt that scopes an agent to the nix fleet. Read it
when you need the authoritative "in-scope repos" / "open streams" list and
hard rules. It is the single source of truth for which repos an orchestrated
session is supposed to focus on.

### Root-level helper scripts

| File | What it does |
|------|--------------|
| `bench-quick.sh` | Stale. Formerly benchmarked a now-archived project; exports live `MORPH_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` as plaintext. Keys are scoped to a private repo + ephemeral targets, rotation is planned. **Do not extend the plaintext-key pattern** to new scripts, and do not paste this file's contents into chat. |
| `dump_context.sh [files...]` | Writes `_ai_context.md` with a `tree -L 4` (ignoring node_modules/target/.git/.venv/__pycache__/backups), `git diff`, and the contents of any files passed as args. Drop-in "give the LLM context" helper. |
| `install-ghostty.sh` | Installs/configures the Ghostty terminal. Not project-related; operator convenience. |
| `repo-obsidian-sync.py` | Syncs repo content into the Obsidian vault. |
| `pr` | A flat file (notebook-style scratch), not a directory. |

### Workspace-local state (do not commit)

| Path | Contents |
|------|----------|
| `.remember/logs/` | Daily memory-log entries (`memory-YYYY-MM-DD.log`). Append-only cross-session memory. |
| `.remember/tmp/` | Scratch. |
| `.repowise/wiki.db` | Stale repowise SQLite index. Retired; see MCP note above. |
| `.crush/` | Crush agent runtime state (`crush.db`, `init`, `logs`). |
| `.claude/plans/` | Persistent plan files referenced by `plansDirectory`. |
| `.versions` | Auto-generated by `orch-session-start`. If it says "unknown", re-run `orch-session-start` to regenerate. |
| `_cold-archive/` | Archived. `.gitignore`'d at root. Leave alone. |

### Symlinks / outsourced paths

- `projects-wiki` → `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/projects-wiki`
  (Obsidian vault, iCloud-synced). Edits here propagate to the Obsidian vault.
- Top-level ops notes (`cf-security-fixes.md`, `kickoff-bypass.md`,
  `portail.toml.history`) are scratchpad runbooks/config history, not source.

---

## Cross-cutting hard rules

These apply to *anything* under this workspace unless a subproject's own
`AGENTS.md` supersedes them.

1. **Never version-control secrets.** Secrets live in sops (`secrets/`,
   `.sops.yaml`) for the nix fleet, or per-subproject credential stores. The
   `bench-quick.sh` plaintext keys are an accepted exception (private repo +
   ephemeral targets, rotation planned) — **do not extend the pattern** to
   new scripts.
2. **`bypassPermissions` ≠ reckless.** Session config bypasses prompts but
   the `deny` list and subproject guardrails still bind. Do not disable
   hooks silently even under bypass (per `kickoff-bypass.md`).
3. **Project boundaries are real.** `cd` in before any build/test/git. A
   command that works at root for one project will not work for another.
4. **Verify against source, not summaries.** Codebase-graph indices in
   subprojects are stale (repowise retired; codebase-memory-mcp migration
   in progress). Always confirm file contents before editing.
5. **Formatter before commit.** Nix: `nixpkgs-fmt`. Match the formatter
   declared in each subproject's flake/package config.
6. **Don't touch `_cold-archive/`.**
7. **Document stream boundaries** (`# Stream N lands here:`) when leaving
   TODOs that span nix-base's open streams. Stream numbers are **not
   stable** — see the Work streams table and keep it in sync with
   `.claude/system-prompt.md`.
8. **Python via `uv`.** Any Python in this workspace is invoked through `uv`
   (`uv run ...`, `uv run --script ...`). Do not call bare `python`/`pip`.
9. **`nh` is the fleet entrypoint.** Prefer `nh os switch` / `nh home switch`
   over raw `nixos-rebuild` / `nix-darwin` / `nix build`.

---

## Where to look when you're lost

- **"What is this workspace, what am I supposed to do?"** → `.claude/system-prompt.md`
- **"How do I deploy this host?"** → `nix-base/README.md`, `nix-base/docs/deploy.md`, `nix-base/tasks.py`
- **"What services run where?"** → `nix-base/docs/services.md`
- **"Which work streams are open?"** → Work streams table above ↔ `.claude/system-prompt.md`
- **"Codebase graph query?"** → codebase-memory-mcp (planned); until then, grep + source + LSP
- **"How are secrets wired?"** → `nix-base/.sops.yaml`, `nix-base/secrets/`, host `sops.nix`
- **"How do I run an op runbook?"** → `adhoc-runbooks/runbooks/` (rpi-homelab, optimized-kernel-build, honcho-self-host)
- **"What MCP does this session have?"** → `.mcp.json` (strict; global MCP suppressed)
- **"What am I allowed to run?"** → `.claude/settings.json` (`allow`/`deny`)
- **"What was decided previously?"** → `.remember/logs/memory-*.log` or `honcho` MCP `recall`