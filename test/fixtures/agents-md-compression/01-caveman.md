# AGENTS.md — `peterlodri-sec` workspace root

Not single repo. Workspace/aggregator holding ~70 independent projects, each own git repo + own remote. Root not versioned (`.gitignore` excludes `_cold-archive/`).

Treat every top-level subdir as self-contained project with own `AGENTS.md` / `CLAUDE.md` + tooling. **`cd` into target project before build/test/git** — commands don't compose across project boundaries.

> **Before editing Nix file**, look up live API in context7 first (`query-docs` for nixpkgs / home-manager / nix-darwin / sops-nix / disko / flake-parts). nixpkgs-unstable churns; don't write from memory.

---

## Primary nix fleet (in-scope repos)

Original purpose: NixOS/nix-darwin fleet. Two repos in scope per `.claude/system-prompt.md`; rest = satellite projects alongside.

| Repo | What it is | Flake inputs of note |
|------|------------|----------------------|
| `nix-base/` | Fleet flake-managing 3 Hetzner hosts + 1 Mac + ~30 services | nixos-unstable · flake-parts · nix-darwin · sops-nix · home-manager · stylix · disko · microvm |
| `nixos-runners/` | Self-hosted GitHub Actions runners (`runner-01` x86_64, `runner-02` aarch64) | nixos-25.05 · disko |

Satellites sharing `nix-base-*` prefix (`nix-base-deploy`, `nix-base-hermes`, `nix-base-cx53-*`, `nix-base-aperture`, `nix-base-oracle`, `nix-base-bux`, `nix-base-desktop`, `nix-base-dev-cx53`, `nix-base-cheatsheet`, `nix-base/psh-deploy-sync`) = **mirrors / deploy variants of nix-base targets**, not independent flakes. Rule: **edit `nix-base/` first, then sync** to satellite. Don't patch satellite in place expecting flow back — source of truth = `nix-base/`. Each mirror ships own `AGENTS.md`; read only to learn sync target/path, not divergent conventions.

### nix-base fleet hosts

| Host | Role | Platform | Note |
|------|------|----------|------|
| `dev-cx53` | Build/deploy host, honcho, dev workstation | NixOS x86_64 (CX53 hel1) | Tailnet only |
| `public-services-host` | Mastodon, Forgejo, Vaultwarden, public services | NixOS x86_64 (CX33 fsn1) | Public SSH + :80/:443 |
| `hetzner` | GitHub runners, Nixery, ARM64 workloads | NixOS aarch64 (CAX31 fsn1) | Tailnet only |
| `mbp` | nix-darwin workstation (M3) | aarch64-darwin | Not remote-managed |
| `vaultwarden-pi`, `macbook-air` | Additional host dirs | — | See host `default.nix` |

### nix-base deploy commands

> **`nh` (nushell-powered `nh`) = canonical entrypoint for all fleet operations.** Prefer `nh os switch` / `nh home switch` over raw `nixos-rebuild` / `nix build`. `nixos-rebuild *` / `nix-darwin *` entries in `.claude/settings.json` = escape-hatches, not primary path.

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

home-manager / dotfile deploy uses `tasks.py` (task runner) — builds `#homeConfigurations.dev.activationPackage`. Run from inside `nix-base/`. Python via `uv` (project standard):

```bash
uv run task deploy_dotfiles   # build + activate home-manager (Mac path)
uv run task hm_switch          # `nh home switch` path (dev-cx53)
```

### Critical nix-base conventions (non-obvious)

- **Module namespace**: custom options live under `peterlodri.<name>`, never bare top-level. Bare options break evaluation.
- **Secrets**: sops-nix + per-host age key at `/var/lib/sops-nix/key.txt` (staged at install, never committed). `.sops.yaml` holds creation rules + age recipients. **Never commit credentials to `.nix` files.**
- **Darwin sops gap OPEN**: `tokenSecretPath` + `barkKeySecretPath` on `mbp` need launchd loader — sops-nix doesn't natively activate on darwin. Flag before touching secret delivery on `mbp`.
- **Pinned security nixpkgs**: `nix-base` keeps separate `nixpkgs-patched` input pinned at specific commit for Mastodon CVE fix on `public-services-host`. Don't let it drift onto rest of fleet; drop once main pin advances past Mastodon 4.5.11.
- **Private flake inputs**: `cloak-fetch` + `fieldfeed` point at private sources. PUBLIC consumers override to `stubs/*`:
  ```bash
  nix flake show \
    --override-input cloak-fetch path:./stubs/cloak-fetch \
    --override-input fieldfeed   path:./stubs/fieldfeed
  ```
  Real `fieldfeed` needs `github.com` nix access-token (read access to `peterlodri-sec/fieldfeed`) in `~/.config/nix/access-tokens.conf` — never commit it.
- **Stream annotations**: leaving TODOs crossing open work streams → annotate `# Stream N lands here:` (streams 2/3/5 per system prompt).
- **Formatter**: `nixpkgs-fmt` (`formatter = pkgs.nixpkgs-fmt` in flake). Run before committing Nix.
- **Extra binary caches** (declared in `nix-base/flake.nix`): `microvm.cachix.org` + `attic.xuyh0120.win/lantian` with listed public keys. `microvm.cachix.org` matters for `microvm.nix` builds.

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

Fleet open work tracked as numbered **streams**. Numbers **not stable** — renumbered as work rolls off. Current set lives in `.claude/system-prompt.md`; if that file lists streams, treat as authoritative open work. As of writing:

| Stream | Target host | Work |
|--------|--------------|------|
| 2 | `hetzner` | postgresql + pgvector, github-runners, agentfield-spider-agent container |
| 3 | `mbp` | rag-stack launchd, ollama (local-openrouter), observability-trio, home-manager |
| 5 | `hetzner` | honcho-server container (`LLM_PROVIDER_URL` → Mac Ollama via Tailscale) |

Conventions:
- Implement streams **in order** unless directed otherwise.
- TODO crossing stream boundary → annotate `# Stream N lands here:` so next agent knows which stream owns follow-up.
- Opening/closing stream → update `.claude/system-prompt.md` *and* this table — keep in sync.

---

## Workspace-level tooling (root only)

### Launching an agent session

Workspace **agent-runtime-agnostic**. Bootstrap entrypoint shipped here targets Claude Code:

```bash
.claude/launch.sh                       # default: sonnet, xhigh effort
.claude/launch.sh --model opus          # opus for deep architecture work
.claude/launch.sh --model haiku         # haiku for fast edits
.claude/launch.sh --effort high        # drop effort for repetitive tasks
.claude/launch.sh --name "stream-2"    # named session
```

`launch.sh` runs `claude --dangerously-skip-permissions --no-chrome --strict-mcp-config --mcp-config .mcp.json --append-system-prompt $(cat .claude/system-prompt.md) ...`. `--strict-mcp-config` means **only** servers in `.mcp.json` load — global `~/.claude.json` MCP servers suppressed. Intentional: workspace narrows tool surface.

Operator day-to-day dev runtimes = **Crush, opencode, whale** (usually custom builds). `launch.sh` = Claude bootstrap only — not "canonical way agents must enter workspace". Whichever runtime in use, *bootstrap contract* same: load `.claude/system-prompt.md`, honour `.mcp.json` strictly, respect `.claude/settings.json` `deny` list.

### `.mcp.json` servers

| Server | Purpose / when to use |
|--------|----------------------|
| `context7` | nix ecosystem docs (nixpkgs, nix-darwin, home-manager, sops-nix, flake-parts, disko). `query-docs` before writing any nix API. |
| `brave-search` | web search for NixOS options / package availability when context7 has nothing. `brave_local_search` **denied** in `.claude/settings.json`. |
| `honcho` | long-term memory MCP `recall` + `search` only; run via `uv run --script adhoc-runbooks/runbooks/scripts/honcho/honcho-mcp.py`, `HONCHO_USER_PEER=lodripeter`. `log_turn` **denied**. |

> **Codebase graph intelligence migrating to [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp).** Previous repowise MCP entries (root + per-subproject) = dev mistake, fully retired. Treat *any* `REPOWISE:START` block inside subproject `AGENTS.md` files as stale — ignore tool-coupling instructions, verify against source.
>
> codebase-memory-mcp **not yet wired into root `.mcp.json`** (planned). Until then, agent reaching for graph-style queries (callers, ownership, decision archaeology) → fall back to plain source reading, grep, LSP tools — not repowise. When migration lands, prefer codebase-memory-mcp tools over grepping large subprojects.

### `.claude/settings.json` (root session config)

- `effortLevel: xhigh`, `alwaysThinkingEnabled: true`
- `permissions.defaultMode: bypassPermissions`, hard `deny` list: `mcp__brave-search__brave_local_search`, `mcp__honcho__log_turn`
- `allow` shortcuts: `Bash(nix *)`, `Bash(nixos-rebuild *)`, `Bash(nix-darwin *)`, `Bash(home-manager *)`, `Bash(sops *)`, `Bash(age *)`, `Bash(ssh hetzner *)`, `Bash(repowise *)`, `claude --dangerously-skip-permissions` launch patterns.
- `plansDirectory: .claude/plans` — persisted plan files live there.

### `.claude/system-prompt.md`

Appended system prompt scoping agent to nix fleet. Read when need authoritative "in-scope repos" / "open streams" list + hard rules. Single source of truth for which repos orchestrated session focuses on.

### Root-level helper scripts

| File | What it does |
|------|--------------|
| `bench-quick.sh` | Stale. Formerly benchmarked now-archived project; exports live `MORPH_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` as plaintext. Keys scoped to private repo + ephemeral targets, rotation planned. **Do not extend plaintext-key pattern** to new scripts, don't paste file contents into chat. |
| `dump_context.sh [files...]` | Writes `_ai_context.md` with `tree -L 4` (ignoring node_modules/target/.git/.venv/__pycache__/backups), `git diff`, contents of files passed as args. Drop-in LLM context helper. |
| `install-ghostty.sh` | Installs/configures Ghostty terminal. Not project-related; operator convenience. |
| `repo-obsidian-sync.py` | Syncs repo content into Obsidian vault. |
| `pr` | Flat file (notebook-style scratch), not directory. |

### Workspace-local state (do not commit)

| Path | Contents |
|------|----------|
| `.remember/logs/` | Daily memory-log entries (`memory-YYYY-MM-DD.log`). Append-only cross-session memory. |
| `.remember/tmp/` | Scratch. |
| `.repowise/wiki.db` | Stale repowise SQLite index. Retired; see MCP note above. |
| `.crush/` | Crush agent runtime state (`crush.db`, `init`, `logs`). |
| `.claude/plans/` | Persistent plan files referenced by `plansDirectory`. |
| `.versions` | Auto-generated by `orch-session-start`. Says "unknown" → re-run `orch-session-start` to regenerate. |
| `_cold-archive/` | Archived. `.gitignore`'d at root. Leave alone. |

### Symlinks / outsourced paths

- `projects-wiki` → `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/projects-wiki` (Obsidian vault, iCloud-synced). Edits here propagate to Obsidian vault.
- Top-level ops notes (`cf-security-fixes.md`, `kickoff-bypass.md`, `portail.toml.history`) = scratchpad runbooks/config history, not source.

---

## Cross-cutting hard rules

Apply to *anything* under workspace unless subproject's own `AGENTS.md` supersedes.

1. **Never version-control secrets.** Secrets in sops (`secrets/`, `.sops.yaml`) for nix fleet, or per-subproject credential stores. `bench-quick.sh` plaintext keys = accepted exception (private repo + ephemeral targets, rotation planned) — **don't extend pattern** to new scripts.
2. **`bypassPermissions` ≠ reckless.** Session config bypasses prompts but `deny` list + subproject guardrails still bind. Don't disable hooks silently even under bypass (per `kickoff-bypass.md`).
3. **Project boundaries real.** `cd` in before any build/test/git. Command working at root for one project won't work for another.
4. **Verify against source, not summaries.** Codebase-graph indices in subprojects stale (repowise retired; codebase-memory-mcp migration in progress). Confirm file contents before editing.
5. **Formatter before commit.** Nix: `nixpkgs-fmt`. Match formatter declared in each subproject's flake/package config.
6. **Don't touch `_cold-archive/`.**
7. **Document stream boundaries** (`# Stream N lands here:`) when leaving TODOs spanning nix-base's open streams. Stream numbers **not stable** — see Work streams table, keep in sync with `.claude/system-prompt.md`.
8. **Python via `uv`.** Any Python in workspace invoked through `uv` (`uv run ...`, `uv run --script ...`). Don't call bare `python`/`pip`.
9. **`nh` = fleet entrypoint.** Prefer `nh os switch` / `nh home switch` over raw `nixos-rebuild` / `nix-darwin` / `nix build`.

---

## Where to look when lost

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