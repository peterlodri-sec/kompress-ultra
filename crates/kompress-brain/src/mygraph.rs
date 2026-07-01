use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MyNode {
    pub id: Option<String>,
    #[serde(rename = "type")]
    pub node_type: Option<String>,
    pub label: Option<String>,
    pub body: Option<String>,
    pub confidence: Option<String>,
    pub created_at: Option<String>,
    pub photo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MyEdge {
    pub src: String,
    pub dst: String,
    #[serde(rename = "type")]
    pub edge_type: Option<String>,
    pub confidence: Option<String>,
    pub excerpt: Option<String>,
    pub source_id: Option<String>,
    pub created_at: Option<String>,
    pub last_seen: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MyGraph {
    pub nodes: HashMap<String, MyNode>,
    pub edges: Vec<MyEdge>,
}
