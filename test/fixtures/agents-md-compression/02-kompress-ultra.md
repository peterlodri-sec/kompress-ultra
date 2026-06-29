# AGENTS. md — `peterlodri-sec` workspace root directory **not single repo**. workspace/aggregator holding
~70 independent projects, each its own git repo its own remote. root
itself not versioned (`. gitignore` only excludes `_cold-archive/`). Every top-level subdirectory should be treated as self-contained project its own `AGENTS. md` / `CLAUDE. md` tooling. **Always `cd` into target project before running build/test/git** — commands not compose
across project boundaries here. > **Before editing any Nix file**, look up live API context7 first
> (`query-docs` nixpkgs / home-manager / nix-darwin / sops-nix / disko /
> flake-parts). nixpkgs-unstable churns; not write memory. --- ## Primary nix fleet ( " -scope" repos) original purpose workspace NixOS/nix-darwin fleet. Two
repos " scope" per `. claude/ -prompt. md`; rest satellite
projects live alongside. | Repo | What | Flake inputs note |
|------|------------|----------------------|
| `nix-base/` | Fleet flake-managing 3 Hetzner hosts + 1 Mac + ~30 services | nixos-unstable · flake-parts · nix-darwin · sops-nix · home-manager · stylix · disko · microvm |
| `nixos-runners/` | Self-hosted GitHub Actions runners (`runner-01` x86_64, `runner-02` aarch64) | nixos-25. 05 · disko | Satellites share `nix-base-*` prefix (`nix-base-deploy`,
`nix-base-hermes`, `nix-base-cx53-*`, `nix-base-aperture`, `nix-base-oracle`,
`nix-base-bux`, `nix-base-desktop`, `nix-base-dev-cx53`, `nix-base-cheatsheet`,
`nix-base/psh-deploy-sync`) **mirrors / deploy variants nix-base
targets**, not independent flakes. rule :
**edit `nix-base/` first, then sync** satellite. not patch satellite place expect flow back — source truth `nix-base/`. Each mirror ships its own `AGENTS. md`; read only learn sync target/path, not find divergent conventions. ### nix-base fleet hosts | Host | Role | Platform | Note |
|------|------|----------|------|
| `dev-cx53` | Build/deploy host, honcho, dev workstation | NixOS x86_64 (CX53 hel1) | Tailnet only |
| `public-services-host` | Mastodon, Forgejo, Vaultwarden, public services | NixOS x86_64 (CX33 fsn1) | Public SSH + :80/:443 |
| `hetzner` | GitHub runners, Nixery, ARM64 workloads | NixOS aarch64 (CAX31 fsn1) | Tailnet only |
| `mbp` | nix-darwin workstation (M3) | aarch64-darwin | Not remote-managed |
| `vaultwarden-pi`, `macbook-air` | Additional host dirs | — | See host `default. nix` | ### nix-base deploy commands > **`nh` (nushell-powered `nh`) canonical entrypoint all fleet
> operations. ** Prefer `nh os switch` / `nh home switch` over raw
> `nixos-rebuild` `nix build`. `nixos-rebuild *` / `nix-darwin *`
> entries `. claude/settings. json` escape-hatches, not primary path. ```bash
# One-shot provision new Hetzner VM
nix run github:nix-community/nixos-anywhere -- \ --build-on-remote --flake .#<hostname> root@<ip> # Ongoing updates from Mac (builds on dev-cx53, switches target)
nh os switch .#dev-cx53 \ --build-host dev-cx53.tail2870dc.ts.net \ --target-host dev-cx53.tail2870dc.ts.net nh os switch .#public-services-host \ --build-host dev-cx53.tail2870dc.ts.net \ --target-host root@167.233.105.32
``` home-manager / dotfile deploy uses `tasks. py` (task runner) — short-by-short
builds `#homeConfigurations. dev. activationPackage`. Run inside `nix-base/`. Python tasks always invoked via `uv` (project standard Python): ```bash
uv run task deploy_dotfiles # build + activate home-manager (Mac path)
uv run task hm_switch # `nh home switch` path (dev-cx53)
``` ### Critical nix-base conventions (non-obvious) - **Module namespace**: all custom options live under `peterlodri. <name>`, never bare top-level. Adding bare options breaks evaluation. - **Secrets**: sops-nix + per-host age key `/var/lib/sops-nix/key. txt` (staged install, never committed). `. sops. yaml` holds creation rules + age recipients. **Never commit credentials `. nix` files. **
- **Darwin sops gap OPEN**: `tokenSecretPath` `barkKeySecretPath` `mbp` need launchd loader because sops-nix not natively activate darwin. Flag before touching any secret delivery `mbp`. - **Pinned security nixpkgs**: `nix-base` keeps separate `nixpkgs-patched` input pinned specific commit solely Mastodon CVE fix `public-services-host`. not let drift onto rest fleet; drop once main pin advances past Mastodon 4. 5. 11. - **Private flake inputs**: `cloak-fetch` `fieldfeed` point private sources. PUBLIC consumers must override `stubs/*`: ```bash nix flake show \ --override-input cloak-fetch path:./stubs/cloak-fetch \ --override-input fieldfeed path:./stubs/fieldfeed ``` Real `fieldfeed` also needs `github. com` nix access-token (read access `peterlodri-sec/fieldfeed`) `~/. config/nix/access-tokens. conf` — never commit. - **Stream annotations**: when leaving TODOs cross open streams, annotate `# Stream N lands here:` (streams 2/3/5 per prompt). - **Formatter**: `nixpkgs-fmt` (`formatter = pkgs. nixpkgs-fmt` flake). Run before committing Nix. - **Extra binary caches** (declared `nix-base/flake. nix`): `microvm. cachix. org` `attic. xuyh0120. win/lantian` listed public keys. `microvm. cachix. org` matters `microvm. nix` builds. ### nix-base layout cheat-sheet ```
hosts/<name>/{default,disko,sops}.nix host config, disk, sops rules
hosts/<name>/*.nix per-host service modules
modules/ reusable NixOS modules under peterlodri.*
pkgs/ local package derivations
secrets/ sops-encrypted secrets (per host/service)
apps/{gh-app-broker,pr-dashboard,swe-agent,browser-pool,pool-widget} Python services (FastAPI/aiohttp)
scripts/{bootstrap.sh,deploy-dev-cx53.sh,smoke-inbox-relay.sh,...}
ci/ canary + ovh-ci.sh
tasks.py task runner (deploy_dotfiles, hm_switch, run_agent_sandbox, ...)
``` ### streams (nix-base) fleet's open tracked as numbered **streams**. Numbers **not
stable** — get renumbered as rolls off. current set lives `. claude/ -prompt. md`; if file lists streams, treat as authoritative open. As writing: | Stream | Target host | |
|--------|--------------|------|
| 2 | `hetzner` | postgresql + pgvector, github-runners, agentfield-spider-agent container |
| 3 | `mbp` | rag-stack launchd, ollama (local-openrouter), observability-trio, home-manager |
| 5 | `hetzner` | honcho-server container (`LLM_PROVIDER_URL` → Mac Ollama via Tailscale) | Conventions:
- Implement streams ** order** unless directed otherwise. - When TODO crosses stream boundary, annotate `# Stream N lands here:` so next agent knows which stream owns follow-up. - If you open new stream close one, update `. claude/ -prompt. md` * * table — two should stay sync. --- ## Workspace-level tooling (root only) ### Launching agent session workspace **agent-runtime-agnostic**. bootstrap entrypoint ships here targets Claude Code: ```bash
.claude/launch.sh # default: sonnet, xhigh effort
.claude/launch.sh --model opus # opus for deep architecture work
.claude/launch.sh --model haiku # haiku for fast edits
.claude/launch.sh --effort high # drop effort for repetitive tasks
.claude/launch.sh --name "stream-2" # named session
``` `launch. sh` runs `claude --dangerously-skip-permissions --no-chrome
--strict-mcp-config --mcp-config. mcp. json --append- -prompt
$(cat. claude/ -prompt. md). `. `--strict-mcp-config` means **only** servers `. mcp. json` load — global `~/. claude. json` MCP servers suppressed. intentional: workspace intentionally narrows its
tool surface. operator's day- -day dev runtimes **Crush, opencode, whale**
(usually custom builds each). `launch. sh` Claude bootstrap only — not read as " canonical way agents must enter workspace". Whichever runtime use, *bootstrap contract* same: load
`. claude/ -prompt. md`, honour `. mcp. json` strictly, respect `. claude/settings. json` `deny` list. ### `. mcp. json` servers | Server | Purpose / when use |
|--------|----------------------|
| `context7` | nix ecosystem docs (nixpkgs, nix-darwin, home-manager, sops-nix, flake-parts, disko). `query-docs` before writing any nix API. |
| `brave-search` | web search NixOS options / package availability when context7 nothing. `brave_local_search` **denied** `. claude/settings. json`. |
| `honcho` | long-term memory MCP `recall` + `search` only; run via `uv run --script adhoc-runbooks/runbooks/scripts/honcho/honcho-mcp. py`, `HONCHO_USER_PEER=lodripeter`. `log_turn` **denied**. | > **Codebase graph intelligence migrated > [DeusData/codebase-memory-mcp](https://github. com/DeusData/codebase-memory-mcp). **
> previous repowise MCP entries (root per-subproject) dev
> mistake have fully retired. Treat *any* `REPOWISE:START` block
> inside subproject `AGENTS. md` files as stale — ignore its tool-coupling
> instructions verify against source. >
> codebase-memory-mcp **not yet wired into root `. mcp. json`** (planned). > Until , agent reaching graph-style queries (callers, ownership,
> decision archaeology) should fall back plain source reading, grep, > LSP tools — not repowise. When migration lands, prefer
> codebase-memory-mcp's tools over grepping large subprojects. ### `. claude/settings. json` (root session config) - `effortLevel: xhigh`, `alwaysThinkingEnabled: true`
- `permissions. defaultMode: bypassPermissions`, hard `deny` list: `mcp__brave-search__brave_local_search`, `mcp__honcho__log_turn`
- `allow` shortcuts include `Bash(nix *)`, `Bash(nixos-rebuild *)`, `Bash(nix-darwin *)`, `Bash(home-manager *)`, `Bash(sops *)`, `Bash(age *)`, `Bash(ssh hetzner *)`, `Bash(repowise *)`, `claude --dangerously-skip-permissions` launch patterns. - `plansDirectory:. claude/plans` — persisted plan files live there. ### `. claude/ -prompt. md` appended prompt scopes agent nix fleet. Read when you need authoritative " -scope repos" / "open streams" list hard rules. single source truth which repos orchestrated
session supposed focus. ### Root-level helper scripts | File | What |
|------|--------------|
| `bench-quick. sh` | Stale. Formerly benchmarked -archived project; exports live `MORPH_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` as plaintext. Keys scoped private repo + ephemeral targets, rotation planned. ** not extend plaintext-key pattern** new scripts, not paste file's contents into chat. |
| `dump_context. sh [files. ]` | Writes `_ai_context. md` `tree -L 4` (ignoring node_modules/target/. git/. venv/__pycache__/backups), `git diff`, contents any files passed as args. Drop- "give LLM context" helper. |
| `install-ghostty. sh` | Installs/configures Ghostty terminal. Not project-related; operator convenience. |
| `repo-obsidian-sync. py` | Syncs repo content into Obsidian vault. |
| `pr` | flat file (notebook-style scratch), not directory. | ### Workspace-local state ( not commit) | Path | Contents |
|------|----------|
| `. remember/logs/` | Daily memory-log entries (`memory-YYYY-MM-DD. log`). Append-only cross-session memory. |
| `. remember/tmp/` | Scratch. |
| `. repowise/wiki. db` | Stale repowise SQLite index. Retired; see MCP note above. |
| `. crush/` | Crush agent runtime state (`crush. db`, `init`, `logs`). |
| `. claude/plans/` | Persistent plan files referenced by `plansDirectory`. |
| `. versions` | Auto-generated by `orch-session-start`. If says "unknown", re-run `orch-session-start` regenerate. |
| `_cold-archive/` | Archived. `. gitignore`'d root. Leave alone. | ### Symlinks / outsourced paths - `projects-wiki` → `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/projects-wiki` (Obsidian vault, iCloud-synced). Edits here propagate Obsidian vault. - Top-level ops notes (`cf-security-fixes. md`, `kickoff-bypass. md`, `portail. toml. history`) scratchpad runbooks/config history, not source. --- ## Cross-cutting hard rules apply *anything* under workspace unless subproject's own
`AGENTS. md` supersedes. 1. **Never version-control secrets. ** Secrets live sops (`secrets/`, `. sops. yaml`) nix fleet, per-subproject credential stores. `bench-quick. sh` plaintext keys accepted exception (private repo + ephemeral targets, rotation planned) — ** not extend pattern** new scripts. 2. **`bypassPermissions` ≠ reckless. ** Session config bypasses prompts `deny` list subproject guardrails bind. not disable hooks silently under bypass (per `kickoff-bypass. md`). 3. **Project boundaries real. ** `cd` before any build/test/git. command works root one project will not another. 4. **Verify against source, not summaries. ** Codebase-graph indices subprojects stale (repowise retired; codebase-memory-mcp migration progress). Always confirm file contents before editing. 5. **Formatter before commit. ** Nix: `nixpkgs-fmt`. Match formatter declared each subproject's flake/package config. 6. **Don't touch `_cold-archive/`. **
7. **Document stream boundaries** (`# Stream N lands here:`) when leaving TODOs span nix-base's open streams. Stream numbers **not stable** — see streams table keep sync `. claude/ -prompt. md`. 8. **Python via `uv`. ** Any Python workspace invoked through `uv` (`uv run. `, `uv run --script. `). not call bare `python`/`pip`. 9. **`nh` fleet entrypoint. ** Prefer `nh os switch` / `nh home switch` over raw `nixos-rebuild` / `nix-darwin` / `nix build`. --- ## Where look when you're lost - **"What workspace, what am I supposed. "** → `. claude/ -prompt. md`
- **"How I deploy host. "** → `nix-base/README. md`, `nix-base/docs/deploy. md`, `nix-base/tasks. py`
- **"What services run where. "** → `nix-base/docs/services. md`
- **"Which streams open. "** → streams table above ↔ `. claude/ -prompt. md`
- **"Codebase graph query. "** → codebase-memory-mcp (planned); until then, grep + source + LSP
- **"How secrets wired. "** → `nix-base/. sops. yaml`, `nix-base/secrets/`, host `sops. nix`
- **"How I run op runbook. "** → `adhoc-runbooks/runbooks/` (rpi-homelab, optimized-kernel-build, honcho-self-host)
- **"What MCP session have. "** → `. mcp. json` (strict; global MCP suppressed)
- **"What am I allowed run. "** → `. claude/settings. json` (`allow`/`deny`)
- **"What decided previously. "** → `. remember/logs/memory-*. log` `honcho` MCP `recall`