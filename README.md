# kompress-ultra

> 4-role living context layer: **Composer**, **Pruner**, **Rewriter**, **Circulator**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

## Overview

`kompress-ultra` is a context-management middleware for AI agent frameworks. It compresses verbose chat histories, compiler logs, and tool outputs in real-time, achieving:

- **~78% token savings** on typical agent conversations
- **~75% latency reduction** by reducing context window size
- **0.993 exact-keep rate** on critical reasoning tokens (numbers, paths, error codes)

The system operates as four coordinated roles:

| Role | Function |
|------|----------|
| **Composer** | Injects learned patterns from memory into system prompts |
| **Pruner** | Scores messages by relevance, recency, and structural importance |
| **Rewriter** | Compresses kept messages by age (Verbatim → Lite → Ultra) |
| **Circulator** | Enqueues pruned content to vector memory for future retrieval |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    System Prompt                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Composer   │  │   Pruner    │  │   Rewriter  │    │
│  │  (patterns)  │  │  (scoring)  │  │ (compress)  │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                │                │             │
│         └────────────────┼────────────────┘             │
│                          ▼                              │
│                   ┌─────────────┐                       │
│                   │ Circulator  │                       │
│                   │  (memory)   │                       │
│                   └─────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

## Installation

```bash
# From npm (coming soon)
npm install kompress-ultra

# From source
git clone https://github.com/peterlodri-sec/kompress-ultra.git
cd kompress-ultra
bun install
```

## Usage

### As an OpenCode Plugin

The plugin wraps the core library and integrates with OpenCode's hook system:

```typescript
// .opencode/plugin/kompress-ultra.ts
import kompressUltra from "kompress-ultra";

export default (input, options) => {
  return kompressUltra(input, {
    relevanceThreshold: 0.65,
    maxMessagesKept: 35,
    milvusUrl: "http://localhost:19530",
  });
};
```

### As a Standalone Library

```typescript
import {
  scoreMessage,
  isProtected,
  compressMessage,
  CompressionLevel,
  adaptiveThreshold,
  computeDensity,
} from "kompress-ultra";

// Score a message for relevance
const score = await scoreMessage(msg, index, total, taskGoal);

// Check if a message is protected (user, code, error, last 5)
if (isProtected(msg, index, total)) {
  // Never prune protected messages
}

// Compress by age
const compressed = compressMessage(msg.content, CompressionLevel.Ultra);
```

## How It Works

### 1. Message Scoring (Pruner)

Each message receives a composite score:

```
total = relevance × 0.4 + recency × 0.3 + structural × 0.3
```

- **Relevance**: Vector similarity to task goal (via Milvus)
- **Recency**: Ebbinghaus decay (half-life = 5 messages)
- **Structural**: Boost for user messages, code blocks, errors

### 2. Safety Floors

Protected messages are never pruned:
- Last 5 messages (KV cache prefix)
- User messages
- Messages containing code blocks
- Error messages

### 3. Adaptive Threshold

The pruning threshold adapts to conversation density:

```typescript
threshold = 0.15 - density × 0.4  // clamped to [0.4, 0.8]
```

Dense conversations (many recent messages) get higher thresholds, preserving more context.

### 4. Token Budget Escalation

Per-agent token budgets control compression aggressiveness:

| Agent | Max Tokens | Aggressiveness |
|-------|-----------|----------------|
| coder | 100k | 0.8 |
| researcher | 128k | 0.4 |
| reviewer | 64k | 0.6 |
| orchestrator | 128k | 0.5 |

### 5. Circuit Breaker

If Milvus/embedding services fail 3 times, the circuit opens for 60 seconds. During this time, the system falls back to heuristic scoring.

## Configuration

```typescript
interface KompressUltraOptions {
  relevanceThreshold?: number;    // 0-1, default 0.65
  maxMessagesKept?: number;       // default 35
  milvusUrl?: string;             // default "http://localhost:19530"
  mempalaceDb?: string;           // default "mempalace.db"
  pollIntervalMs?: number;        // default 60000
  adaptiveThreshold?: boolean;    // default true
  droppedMessageDigest?: boolean; // default true
  sliceAwareBoost?: boolean;      // default true
  transparencyMode?: boolean;     // default true
}
```

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Build
bun run build
```

## Research

This package implements the compression strategy described in:

- **Paper**: [Asymmetric Loss Modulation Resolves the Voting Ensemble Paradox](https://kompress.vaked.dev/paper/main.pdf)
- **Proposal**: [kompress-ultra for Headroom](https://proposal.vaked.dev)
- **Model**: [PeetPedro/kompress-v8](https://huggingface.co/PeetPedro/kompress-v8)

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.

---

Built by [peterlodri-sec](https://github.com/peterlodri-sec) · Part of the [ultrameshai](https://github.com/peterlodri-sec/ultrameshai) ecosystem
