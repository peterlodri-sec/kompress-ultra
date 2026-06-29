export { isCircuitOpen, recordSuccess, recordFailure, getCircuitState, CircuitBreaker, createCircuitBreaker } from "./circuit-breaker.js";
export type { CircuitBreakerState, CircuitBreakerOptions } from "./circuit-breaker.js";
export { isProtected, ebbinghausDecay, structuralBoost, scoreMessage, scoreMessageSync } from "./scoring.js";
export { classifyMessage, enqueueCirculator, flushCirculatorAsync, getCirculatorQueueLength, drainCirculatorQueue, Circulator, createCirculator } from "./circulator.js";
export type { CirculatorEntry, CirculatorInput, CirculatorOptions } from "./circulator.js";
export { embedText, scoreMessageMilvus, queryMilvusSimilarity, fetchHonchoPatterns, writeDroppedDigest } from "./embedding.js";
export { readBrainState, buildBrainLine } from "./brain.js";
export { estimateTokens, escalateForBudget, getBudget, totalTokens, DEFAULT_BUDGETS, setTokenEstimator } from "./token-budget.js";
export type { TokenEstimator } from "./token-budget.js";
export { computeDensity, adaptiveThreshold, buildKompressDisplay, writeCompactionStats } from "./compression.js";
export { compressMessage, CompressionLevel } from "./rewriter.js";
export { KompressError, CompressionError, EmbeddingError, ConfigError, CircuitOpenError } from "./errors.js";
export { validateOptions } from "./types.js";
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
export { DEFAULT_OPTIONS } from "./types.js";
export { embedNode, embedEdge, syncNodeToMilvus, syncEdgeToMilvus, searchSimilarNodes, searchSimilarEdges } from "./brain-embeddings.js";
export { EdgeRouter } from "./edge-router.js";
export type { RoutingResult } from "./edge-router.js";
export { heal, summarize } from "./topology-healer.js";
export type { HealingReport } from "./topology-healer.js";
