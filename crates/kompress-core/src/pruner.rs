use crate::loss::{asymmetric_loss, effective_score, DEFAULT_THRESHOLD, LAMBDA};
use crate::types::ContextUnit;
use anyhow::Result;

pub struct Pruner {
    pub threshold: f64,
    pub lambda: f64,
}

impl Pruner {
    pub fn new() -> Self {
        Self {
            threshold: DEFAULT_THRESHOLD,
            lambda: LAMBDA,
        }
    }

    pub fn prune(&self, units: Vec<ContextUnit>) -> Result<Vec<ContextUnit>> {
        Ok(units
            .into_iter()
            .filter(|u| {
                let score = effective_score(u.score, &u.content);
                let loss = asymmetric_loss(score, self.threshold, self.lambda);
                score > self.threshold || loss < self.lambda * self.threshold
            })
            .collect())
    }
}

impl Default for Pruner {
    fn default() -> Self {
        Self::new()
    }
}
