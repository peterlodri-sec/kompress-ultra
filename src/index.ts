// ── Core pipeline ──────────────────────────────────────────────────
export { isProtected, ebbinghausDecay, structuralBoost, scoreMessage, scoreMessageSync } from "./scoring.js";
export { compressMessage, CompressionLevel } from "./rewriter.js";
export { computeDensity, adaptiveThreshold, buildKompressDisplay } from "./compression.js";
export { estimateTokens, escalateForBudget, getBudget, totalTokens, DEFAULT_BUDGETS, setTokenEstimator } from "./token-budget.js";
export type { TokenEstimator } from "./token-budget.js";
export { KompressError, CompressionError, EmbeddingError, ConfigError, CircuitOpenError } from "./errors.js";
export { validateOptions, DEFAULT_OPTIONS } from "./types.js";

// ── State management ───────────────────────────────────────────────
export { CircuitBreaker, createCircuitBreaker } from "./circuit-breaker.js";
export type { CircuitBreakerState, CircuitBreakerOptions } from "./circuit-breaker.js";
export { Circulator, createCirculator } from "./circulator.js";
export type { CirculatorEntry, CirculatorInput, CirculatorOptions } from "./circulator.js";
export { LocalStore, createLocalStore, queryMemory } from "./local-store.js";

// ── Embedding & brain graph ────────────────────────────────────────
export { hashEmbedding, cosineSimilarity } from "./hash.js";
export { embedText, scoreMessageLocal, queryLocalSimilarity, fetchPatterns, writeDroppedContent } from "./embedding.js";
export { readBrainState, buildBrainLine } from "./brain.js";
export { embedNode, embedEdge, syncNodeToStore, syncEdgeToStore, searchSimilarNodes, searchSimilarEdges } from "./brain-embeddings.js";
export { EdgeRouter } from "./edge-router.js";
export type { RoutingResult } from "./edge-router.js";
export { heal, summarize } from "./topology-healer.js";
export type { HealingReport } from "./topology-healer.js";

// ── Shared types ───────────────────────────────────────────────────
export type {
  KompressUltraOptions,
  AgentType,
  CompressionLevelName,
  Message,
  SystemContext,
  BrainState,
  KompressStats,
  MessageScore,
  AgentTokenBudget,
  CompressInput,
  CompressResult,
  RewriteResult,
  ScoredMessage,
  Node,
  Edge,
  BrainSnapshot,
} from "./types.js";

// ── Deprecated singleton wrappers (kept for backward compat) ───────
export { isCircuitOpen, recordSuccess, recordFailure, getCircuitState } from "./circuit-breaker.js";
export { classifyMessage, enqueueCirculator, flushCirculatorAsync, getCirculatorQueueLength, drainCirculatorQueue } from "./circulator.js";
export { addToStore, searchStore, searchStoreFiltered, persistStore, loadStore, storeSize, clearStore } from "./local-store.js";
