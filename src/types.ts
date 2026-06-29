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
};

export interface Message {
  role: string;
  content: string;
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
  agent_type: string;
  max_context_tokens: number;
  compression_aggressiveness: number;
  brain_injection_budget: number;
}
