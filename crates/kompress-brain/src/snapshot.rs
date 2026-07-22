use crate::{
    layer::{confidence_to_score, layer_for_type},
    mygraph::MyGraph,
};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct BrainNode {
    pub id: String,
    pub label: String,
    pub node_type: String,
    pub layer: [i8; 3],
    pub score: f64,
    pub metadata: HashMap<String, String>,
    pub created_at_ms: i64,
    pub state: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct BrainEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub edge_type: String,
    pub weight: f64,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Snapshot {
    pub version: String,
    pub schema: String,
    pub nodes: Vec<BrainNode>,
    pub edges: Vec<BrainEdge>,
    pub meta: HashMap<String, String>,
    pub checksum_sha256: String,
    pub taken_at_ms: i64,
}

pub fn convert(graph: &MyGraph) -> Snapshot {
    let nodes: Vec<BrainNode> = graph
        .nodes
        .iter()
        .map(|(id, n)| {
            let parts: Vec<&str> = id.splitn(2, ':').collect();
            let node_type = parts[0].to_string();
            let layer = layer_for_type(&node_type);
            let score = confidence_to_score(n.confidence.as_deref().unwrap_or("medium"));
            let mut metadata = HashMap::new();
            if let Some(body) = &n.body {
                metadata.insert("body_snippet".to_string(), body.chars().take(200).collect());
            }
            BrainNode {
                id: id.clone(),
                label: n.label.clone().unwrap_or_else(|| id.clone()),
                node_type,
                layer,
                score,
                metadata,
                created_at_ms: 0,
                state: "active".to_string(),
            }
        })
        .collect();

    let edges: Vec<BrainEdge> = graph
        .edges
        .iter()
        .enumerate()
        .map(|(i, e)| {
            let weight = confidence_to_score(e.confidence.as_deref().unwrap_or("medium"));
            BrainEdge {
                id: format!("e-{i}"),
                source: e.src.clone(),
                target: e.dst.clone(),
                edge_type: e.edge_type.clone().unwrap_or_else(|| "RELATES_TO".to_string()),
                weight,
            }
        })
        .collect();

    let payload = serde_json::json!({ "nodes": nodes.len(), "edges": edges.len() }).to_string();
    let hash_bytes = Sha256::digest(payload.as_bytes());
    let checksum: String = hash_bytes.iter().map(|b| format!("{:02x}", b)).collect();
    let taken_at_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    let mut meta = HashMap::new();
    meta.insert("source".to_string(), "kompress-brain".to_string());
    meta.insert("nodes".to_string(), nodes.len().to_string());
    meta.insert("edges".to_string(), edges.len().to_string());

    Snapshot {
        version: "v1".to_string(),
        schema: "brain-graph-v1".to_string(),
        nodes,
        edges,
        meta,
        checksum_sha256: checksum,
        taken_at_ms,
    }
}
