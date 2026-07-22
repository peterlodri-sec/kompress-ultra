use crate::mygraph::MyGraph;
use anyhow::{Context, Result};
use std::path::{Path, PathBuf};

pub fn mygraph_default_path() -> PathBuf {
    dirs_next().join("Desktop/ideas/knowledge-worker-private/mygraph/mygraph.json")
}

pub fn brain_graph_path() -> PathBuf {
    home_dir().join(".brain/graph.json")
}

pub fn load_mygraph(path: &Path) -> Result<MyGraph> {
    let data = std::fs::read_to_string(path)
        .with_context(|| format!("reading mygraph at {}", path.display()))?;
    serde_json::from_str(&data).context("parsing mygraph.json")
}

pub fn load_brain_graph() -> Result<serde_json::Value> {
    let path = brain_graph_path();
    let data = std::fs::read_to_string(&path)
        .with_context(|| format!("reading brain graph at {}", path.display()))?;
    serde_json::from_str(&data).context("parsing brain graph JSON")
}

fn home_dir() -> PathBuf {
    std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/tmp"))
}

fn dirs_next() -> PathBuf {
    home_dir()
}
