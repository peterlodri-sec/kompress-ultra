export { isCircuitOpen, recordSuccess, recordFailure, getCircuitState } from "./circuit-breaker.js";
export { isProtected, ebbinghausDecay, structuralBoost, scoreMessage } from "./scoring.js";
export { classifyMessage, enqueueCirculator, flushCirculatorAsync } from "./circulator.js";
export { embedText, scoreMessageMilvus, queryMilvusSimilarity, fetchHonchoPatterns, writeDroppedDigest } from "./embedding.js";
export { readBrainState, buildBrainLine } from "./brain.js";
export { estimateTokens, escalateForBudget, DEFAULT_BUDGETS } from "./token-budget.js";
export { computeDensity, adaptiveThreshold, buildKompressDisplay, writeCompactionStats } from "./compression.js";
export { compressMessage, CompressionLevel } from "./rewriter.js";
export type {
  KompressUltraOptions,
  Message,
  SystemContext,
  BrainState,
  KompressStats,
  MessageScore,
  AgentTokenBudget,
} from "./types.js";
export { DEFAULT_OPTIONS } from "./types.js";
