export { isCircuitOpen, recordSuccess, recordFailure, getCircuitState } from "./circuit-breaker.js";
export { isProtected, ebbinghausDecay, structuralBoost, scoreMessage, scoreMessageSync } from "./scoring.js";
export { classifyMessage, enqueueCirculator, flushCirculatorAsync, getCirculatorQueueLength, drainCirculatorQueue } from "./circulator.js";
export { embedText, scoreMessageMilvus, queryMilvusSimilarity, fetchHonchoPatterns, writeDroppedDigest } from "./embedding.js";
export { readBrainState, buildBrainLine } from "./brain.js";
export { estimateTokens, escalateForBudget, getBudget, totalTokens, DEFAULT_BUDGETS } from "./token-budget.js";
export { computeDensity, adaptiveThreshold, buildKompressDisplay, writeCompactionStats } from "./compression.js";
export { compressMessage, CompressionLevel } from "./rewriter.js";
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
