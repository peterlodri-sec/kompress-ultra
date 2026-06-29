# Hetzner Fleet Inventory

**Date**: 2026-06-29  
**Project**: `lego-api` (hcloud context)  
**Total monthly cost**: ~€91.4/mo excl. VAT (~€1,097/yr)  

---

## Machines

### 1. `hetzner-server-new` — Dev Workstation
| Field | Value |
|-------|-------|
| IP | `89.167.80.207` |
| Type | CX53 (8 vCPU, 16GB) |
| Location | Helsinki (hel1-dc2) |
| Cost | €19.7/mo |
| Image | NixOS |
| SSH keys | `root@hetzner-server-new`, `gh-runner@hetzner-server-new` |
| Firewall | None |
| Backups | None |
| **Status** | ✅ Skip (dev-cx53 equivalent) |

---

### 2. `public-services-host` — Public Services
| Field | Value |
|-------|-------|
| IP | `167.233.105.32` |
| Type | CX43 (4 vCPU, 16GB) |
| Location | Falkenstein (fsn1-dc14) |
| Cost | **€12.4/mo** |
| Image | NixOS |
| SSH keys | fleet key |
| Firewall | None |
| Backups | None |
| **Services** | Mastodon, Forgejo, Vaultwarden, listmonk, openbao, uptime-kuma, ntfy |
| **Optimization** | 🟢 Candidate for CDN origin consolidation |

---

### 3. `cdn-origin-nbg1` — CDN Origin
| Field | Value |
|-------|-------|
| IP | `167.233.35.194` |
| Type | CX23 (2 vCPU, 4GB) |
| Location | Nuremberg (nbg1-dc3) |
| Cost | **€4.5/mo** |
| Image | NixOS |
| SSH keys | fleet key |
| Firewall | None |
| Backups | None |
| **Optimization** | 🟡 Consolidate into `public-services-host` to save €4.5/mo |

---

### 4. `agent-node-01` — Agent Orchestration
| Field | Value |
|-------|-------|
| IP | `178.105.184.32` |
| Type | CPX22 (4 vCPU, 8GB) |
| Location | Nuremberg (nbg1-dc3) |
| Cost | **€13.1/mo** |
| Image | NixOS |
| SSH keys | fleet key |
| Firewall | None |
| Backups | None |
| **Purpose** | Runs agent workloads (ultrameshai agents, honcho, etc.) |
| **Optimization** | 🟢 Apply firewall, verify agent workloads running |

---

### 5. `bench-node` — Benchmark
| Field | Value |
|-------|-------|
| IP | `178.105.245.135` |
| Type | **CPX42 (8 vCPU, 32GB)** |
| Location | Falkenstein (fsn1-dc14) |
| Cost | **€23.8/mo** ← most expensive |
| Image | NixOS |
| SSH keys | fleet key |
| Firewall | None |
| Backups | None |
| **Optimization** | 🔴 Underutilized — should run: heavy CI, model inference, Milvus secondary |

---

### 6. `runner-01` / `crabcc-ccx33-nbg1`
| Field | Value |
|-------|-------|
| IP | `46.225.127.20` |
| Type | CCX33 (8 vCPU, 32GB) |
| Location | Nuremberg |
| **Status** | ⏭️ GitHub Runner — excluded |

---

### 7. `runner-02`
| Field | Value |
|-------|-------|
| IP | `178.104.47.201` |
| Type | CAX11 (ARM, 2 vCPU, 4GB) |
| Location | Nuremberg |
| **Status** | ⏭️ GitHub Runner (ARM) — excluded |

---

### 8. `ubuntu-4gb-hil-1` — 🔴 ORPHAN
| Field | Value |
|-------|-------|
| IP | `5.78.122.125` |
| Type | CPX21 (3 vCPU, 4GB) |
| Location | Hillsboro (Helsinki) |
| Cost | **€7.5/mo** |
| Image | Ubuntu 26.04 |
| SSH keys | **NONE** — cannot be accessed |
| Created | 2026-06-16 |
| Labels | `purpose=unknown-orphan` |
| **Action** | 🔴 Delete or rescue |

---

### 9. `ubuntu-4gb-nbg1-1` — 🔴 ORPHAN
| Field | Value |
|-------|-------|
| IP | `167.233.148.20` |
| Type | CX23 (2 vCPU, 4GB) |
| Location | Nuremberg |
| Cost | **€4.5/mo** |
| Image | Ubuntu 26.04 |
| SSH keys | **NONE** — cannot be accessed |
| Created | 2026-06-16 |
| Labels | `purpose=unknown-orphan` |
| **Action** | 🔴 Delete or rescue |

---

### 10. `ubuntu-2gb-sin-1` — 🔴 ORPHAN
| Field | Value |
|-------|-------|
| IP | `5.223.79.65` |
| Type | CPX12 (2 vCPU, 4GB) |
| Location | Singapore |
| Cost | **€5.9/mo** |
| Image | Ubuntu 26.04 |
| SSH keys | **NONE** — cannot be accessed |
| Created | 2026-06-16 |
| Labels | `purpose=unknown-orphan` |
| **Action** | 🔴 Delete or rescue |

---

## Cost Optimization Summary

| Optimization | Saving | Effort | Impact |
|-------------|--------|--------|--------|
| Delete 3 Ubuntu orphans | **€17.9/mo** (€215/yr) | Low | No services lost |
| Consolidate CDN → psh | **€4.5/mo** (€54/yr) | Medium | Requires config migration |
| Right-size bench-node | **€0–€10/mo** | Medium | If underutilized, downsize |
| Firewall all machines | €0 (free) | Low | Security improvement |
| **Total potential** | **€22.4/mo (€269/yr)** | | |

---

## Firewall Status

| Machine | Firewall | Public Ports | Risk |
|---------|----------|-------------|------|
| public-services-host | None | :80, :443 | 🟡 Exposed but needed |
| agent-node-01 | None | :22, :443 | 🔴 Exposed, no protection |
| bench-node | None | :22 | 🟡 SSH exposed |
| cdn-origin-nbg1 | None | :443 | 🟢 Static content only |
| Hetzner runners | None | :22 (tailnet) | 🟢 Tailnet-only |
| Ubuntu orphans | None | :22? | 🔴 Unknown state |

---

## Quick Commands

```bash
# List all servers
hcloud server list

# Get price estimate for a server
hcloud server describe <name> -o json | python3 -c "import json,sys; s=json.load(sys.stdin); print(s['name'], s['server_type']['name'])"

# Delete orphan (if verified unused)
hcloud server delete ubuntu-4gb-hil-1
hcloud server delete ubuntu-4gb-nbg1-1
hcloud server delete ubuntu-2gb-sin-1

# Rescue orphan (set root password + SSH key)
hcloud server enable-rescue ubuntu-4gb-hil-1 --ssh-key peter.lodri@instructure.com

# Apply firewall to server
hcloud firewall apply-to-server honcho-fw --server agent-node-01

# SSH via fleet key
ssh -i ~/.ssh/id_ed25519_hetzner_v2 root@<ip>
```
