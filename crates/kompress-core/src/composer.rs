use crate::types::ContextUnit;
use anyhow::Result;

pub struct Composer {
    pub base_score: f64,
}

impl Composer {
    pub fn new() -> Self {
        Self { base_score: 0.5 }
    }

    pub fn compose(&self, raw_inputs: Vec<String>) -> Result<Vec<ContextUnit>> {
        let units = raw_inputs
            .into_iter()
            .enumerate()
            .map(|(i, content)| {
                let token_count = content.split_whitespace().count();
                ContextUnit {
                    id: format!("unit-{i}"),
                    score: self.base_score,
                    layer: [0, 1, 2],
                    is_critical_syntactic: crate::loss::is_critical_syntactic(&content),
                    token_count,
                    content,
                }
            })
            .collect();
        Ok(units)
    }
}

impl Default for Composer {
    fn default() -> Self {
        Self::new()
    }
}
