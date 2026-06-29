export type AgentType = "coder" | "researcher" | "reviewer" | "orchestrator";

export type CompressionLevelName = "verbatim" | "lite" | "ultra" | "brain-backed";

export interface KompressUltraOptions {
  relevanceThreshold?: number;
  maxMessagesKept?: number;
  milvusUrl?: string;
  mempalaceDb?: string;
  pollIntervalMs?: number;
  adaptiveThreshold?: boolean;
  droppedMessageDigest?: boolean;
  sliceAwareBoost?: boolean;
  displayPruneStatus?: boolean;
  transparencyMode?: boolean;
  agentType?: AgentType;
  aggression?: number;
}

export const DEFAULT_OPTIONS: Required<KompressUltraOptions> = {
  relevanceThreshold: 0.65,
  maxMessagesKept: 35,
  milvusUrl: "http://localhost:19530",
  mempalaceDb: "mempalace.db",
  pollIntervalMs: 60000,
  adaptiveThreshold: true,
  droppedMessageDigest: true,
  sliceAwareBoost: true,
  displayPruneStatus: true,
  transparencyMode: true,
  agentType: "coder",
  aggression: 0.8,
};

export function validateOptions(options: Partial<KompressUltraOptions>): Required<KompressUltraOptions> {
  const merged = { ...DEFAULT_OPTIONS, ...options };

  if (typeof merged.relevanceThreshold !== "number" || merged.relevanceThreshold < 0 || merged.relevanceThreshold > 1) {
    throw new Error("relevanceThreshold must be a number between 0 and 1");
  }
  if (typeof merged.maxMessagesKept !== "number" || merged.maxMessagesKept < 1) {
    throw new Error("maxMessagesKept must be a positive integer");
  }
  if (typeof merged.aggression !== "number" || merged.aggression < 0 || merged.aggression > 1) {
    throw new Error("aggression must be a number between 0 and 1");
  }
  if (typeof merged.pollIntervalMs !== "number" || merged.pollIntervalMs < 0) {
    throw new Error("pollIntervalMs must be a non-negative number");
  }
  const validAgentTypes: AgentType[] = ["coder", "researcher", "reviewer", "orchestrator"];
  if (!validAgentTypes.includes(merged.agentType)) {
    throw new Error(`agentType must be one of: ${validAgentTypes.join(", ")}`);
  }

  return merged;
}

export interface Message {
  role: string;
  content: string;
  type?: string;
  [key: string]: unknown;
}

export interface SystemContext {
  messages: Message[];
  systemPrompt?: string;
  taskGoal?: string;
  sliceId?: string;
  [key: string]: unknown;
}

export interface BrainState {
  status: string;
  patterns_total: number;
  findings_total: number;
  units_processed: number;
  last_data_at_ms: number;
  poll_count: number;
  interval_ms: number;
}

export interface KompressStats {
  model: string;
  pruned: number;
  kept: number;
  total: number;
  threshold: number;
  density: number;
  history: number[];
  tokensPruned: number;
  tokensKept: number;
}

export interface MessageScore {
  relevance: number;
  recency: number;
  structural: number;
  total: number;
  protected: boolean;
}

export interface AgentTokenBudget {
  agent_type: AgentType;
  max_context_tokens: number;
  compression_aggressiveness: number;
  brain_injection_budget: number;
}

export interface CompressInput {
  messages: Message[];
  agentType?: AgentType;
  aggression?: number;
  taskGoal?: string;
  sliceId?: string;
}

export interface CompressResult {
  kept: Message[];
  dropped: Message[];
  stats: KompressStats;
  circulated: number;
}

export interface RewriteResult {
  original: string;
  rewritten: string;
  level: CompressionLevelName;
  originalTokens: number;
  rewrittenTokens: number;
  savingsPct: number;
}

export interface ScoredMessage {
  message: Message;
  score: MessageScore;
  tokens: number;
}
