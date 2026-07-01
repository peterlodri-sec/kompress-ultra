use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub id: String,
    pub label: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub layer: [i8; 3],
    pub metadata: HashMap<String, String>,
    pub score: f64,
    pub created_at_ms: i64,
    pub last_active_ms: i64,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(rename = "type")]
    pub edge_type: String,
    pub label: String,
    pub weight: f64,
    pub conductivity: f64,
    pub direction: String,
    pub created_at_ms: i64,
    pub last_traversed_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainSnapshot {
    pub version: String,
    pub schema: String,
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
    pub meta: HashMap<String, String>,
    pub checksum_sha256: String,
    pub taken_at_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextUnit {
    pub id: String,
    pub content: String,
    pub score: f64,
    pub layer: [i8; 3],
    pub token_count: usize,
    pub is_critical_syntactic: bool,
}
