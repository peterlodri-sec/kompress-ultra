use crate::types::ContextUnit;
use anyhow::Result;

pub struct Circulator;

impl Circulator {
    pub fn new() -> Self {
        Self
    }

    pub fn circulate(&self, units: Vec<ContextUnit>) -> Result<Vec<ContextUnit>> {
        Ok(units)
    }

    pub fn compression_ratio(input_tokens: usize, output_tokens: usize) -> f64 {
        if input_tokens == 0 { return 0.0; }
        output_tokens as f64 / input_tokens as f64
    }
}

impl Default for Circulator {
    fn default() -> Self {
        Self::new()
    }
}
