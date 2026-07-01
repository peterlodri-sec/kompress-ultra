use anyhow::Result;
use std::path::Path;

use crate::layer::is_imaginary;
use crate::mygraph::MyGraph;

/// BrainGraph — thin wrapper around MyGraph with the API the CLI expects.
pub struct BrainGraph {
    inner: MyGraph,
}

impl BrainGraph {
    pub fn load(path: &Path) -> Result<Self> {
        let text = std::fs::read_to_string(path)?;
        let inner: MyGraph = serde_json::from_str(&text)?;
        Ok(Self { inner })
    }

    pub fn nodes(&self) -> Vec<&crate::mygraph::MyNode> {
        self.inner.nodes.values().collect()
    }

    pub fn edges(&self) -> &[crate::mygraph::MyEdge] {
        &self.inner.edges
    }
}

impl crate::mygraph::MyNode {
    pub fn is_imaginary(&self) -> bool {
        self.node_type
            .as_deref()
            .is_some_and(is_imaginary)
    }
}
