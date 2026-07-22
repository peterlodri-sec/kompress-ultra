use crate::types::ContextUnit;
use anyhow::Result;

const MAX_TOKENS: usize = 60;

const FILLER: &[&str] = &[
    "basically", "essentially", "actually", "just", "very", "really",
    "quite", "simply", "obviously", "clearly", "of course", "you know",
];

pub struct Rewriter {
    pub max_tokens: usize,
}

impl Rewriter {
    pub fn new() -> Self {
        Self { max_tokens: MAX_TOKENS }
    }

    pub fn rewrite(&self, units: Vec<ContextUnit>) -> Result<Vec<ContextUnit>> {
        Ok(units.into_iter().map(|mut u| {
            let mut text = u.content.clone();
            for filler in FILLER {
                text = text.replace(&format!(" {filler} "), " ");
            }
            let words: Vec<&str> = text.split_whitespace().collect();
            if words.len() > self.max_tokens {
                text = words[..self.max_tokens].join(" ") + "…";
            }
            u.token_count = text.split_whitespace().count();
            u.content = text;
            u
        }).collect())
    }
}

impl Default for Rewriter {
    fn default() -> Self {
        Self::new()
    }
}
