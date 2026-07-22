use crate::{
    circulator::Circulator,
    composer::Composer,
    loss::TARGET_RATIO,
    pruner::Pruner,
    rewriter::Rewriter,
    types::ContextUnit,
};
use anyhow::Result;

pub struct Pipeline {
    composer: Composer,
    pruner: Pruner,
    rewriter: Rewriter,
    circulator: Circulator,
}

pub struct PipelineResult {
    pub units: Vec<ContextUnit>,
    pub input_tokens: usize,
    pub output_tokens: usize,
    pub compression_ratio: f64,
    pub target_ratio: f64,
}

impl Pipeline {
    pub fn new() -> Self {
        Self {
            composer: Composer::new(),
            pruner: Pruner::new(),
            rewriter: Rewriter::new(),
            circulator: Circulator::new(),
        }
    }

    pub fn run(&self, inputs: Vec<String>) -> Result<PipelineResult> {
        let input_tokens: usize = inputs.iter().map(|s| s.split_whitespace().count()).sum();
        let composed = self.composer.compose(inputs)?;
        let pruned = self.pruner.prune(composed)?;
        let rewritten = self.rewriter.rewrite(pruned)?;
        let output = self.circulator.circulate(rewritten)?;
        let output_tokens: usize = output.iter().map(|u| u.token_count).sum();
        let compression_ratio = Circulator::compression_ratio(input_tokens, output_tokens);
        Ok(PipelineResult {
            units: output,
            input_tokens,
            output_tokens,
            compression_ratio,
            target_ratio: TARGET_RATIO,
        })
    }
}

impl Default for Pipeline {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pipeline_compresses() {
        let pipeline = Pipeline::new();
        let inputs: Vec<String> = (0..10)
            .map(|i| format!("This is basically just a very simple test sentence number {i} with some filler words obviously"))
            .collect();
        let result = pipeline.run(inputs).unwrap();
        assert!(result.output_tokens <= result.input_tokens);
        assert!(!result.units.is_empty());
    }

    #[test]
    fn target_ratio_is_one_over_pi() {
        assert!((TARGET_RATIO - std::f64::consts::FRAC_1_PI).abs() < 1e-10);
    }
}
