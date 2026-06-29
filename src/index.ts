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
} from "./types.js";
export { DEFAULT_OPTIONS } from "./types.js";
