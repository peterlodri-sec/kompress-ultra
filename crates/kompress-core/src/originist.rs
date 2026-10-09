//! Originist — generation count and repair-risk for regenerated content.
//!
//! Critical-token machinery (Safety Floors, λ=3.0) treats survival as binary.
//! A fact regenerated across Rewrite → Compose cycles is a different epistemic
//! object than a never-touched original, even when byte-identical *now*.
//!
//! Originist tracks generation (cycles since last verbatim original) and folds
//! that into loss / effective score.
//!
//! generation 0 = still matches last known original  
//! generation n = rewritten / recomposed n times since last verbatim match

use crate::loss::{asymmetric_loss, LAMBDA};
use crate::types::ContextUnit;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Extra risk per generation for critical content (capped).
pub const GENERATION_RISK_STEP: f64 = 0.12;
/// Maximum generation-derived risk contribution.
pub const GENERATION_RISK_CAP: f64 = 0.6;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provenance {
    pub id: String,
    pub original_hash: String,
    pub current_hash: String,
    pub generation: u32,
    pub is_critical: bool,
}

#[derive(Debug, Clone)]
pub struct Originist {
    by_id: HashMap<String, Provenance>,
    pub lambda: f64,
    pub risk_step: f64,
    pub risk_cap: f64,
}

impl Originist {
    pub fn new() -> Self {
        Self {
            by_id: HashMap::new(),
            lambda: LAMBDA,
            risk_step: GENERATION_RISK_STEP,
            risk_cap: GENERATION_RISK_CAP,
        }
    }

    /// Register unit content. `as_original` resets generation to 0.
    pub fn tag(&mut self, id: impl Into<String>, content: &str, is_critical: bool, as_original: bool) -> Provenance {
        let id = id.into();
        let hash = simple_hash(content);
        if as_original || !self.by_id.contains_key(&id) {
            let p = Provenance {
                id: id.clone(),
                original_hash: hash.clone(),
                current_hash: hash,
                generation: 0,
                is_critical,
            };
            self.by_id.insert(id, p.clone());
            return p;
        }

        let existing = self.by_id.get(&id).unwrap().clone();
        let content_changed = hash != existing.current_hash;
        let generation = next_generation(
            existing.generation,
            &existing.original_hash,
            &hash,
            content_changed,
        );
        let p = Provenance {
            id: id.clone(),
            original_hash: existing.original_hash,
            current_hash: hash,
            generation,
            is_critical,
        };
        self.by_id.insert(id, p.clone());
        p
    }

    /// Tag from a `ContextUnit` (uses unit.id / content / is_critical_syntactic).
    pub fn tag_unit(&mut self, unit: &ContextUnit, as_original: bool) -> Provenance {
        self.tag(&unit.id, &unit.content, unit.is_critical_syntactic, as_original)
    }

    /// Record a rewrite cycle for an existing id.
    pub fn record_rewrite(&mut self, id: &str, new_content: &str, is_critical: Option<bool>) -> Provenance {
        let critical = is_critical
            .or_else(|| self.by_id.get(id).map(|p| p.is_critical))
            .unwrap_or(false);
        self.tag(id, new_content, critical, false)
    }

    pub fn get(&self, id: &str) -> Option<&Provenance> {
        self.by_id.get(id)
    }

    pub fn generation(&self, id: &str) -> u32 {
        self.by_id.get(id).map(|p| p.generation).unwrap_or(0)
    }

    pub fn size(&self) -> usize {
        self.by_id.len()
    }

    pub fn risk(&self, id: &str) -> f64 {
        match self.by_id.get(id) {
            Some(p) => generation_risk(p.generation, p.is_critical, self.risk_step, self.risk_cap),
            None => 0.0,
        }
    }

    pub fn adjusted_score(&self, id: &str, score: f64) -> f64 {
        match self.by_id.get(id) {
            Some(p) => origin_adjusted_score(
                score,
                p.generation,
                p.is_critical,
                self.risk_step,
                self.risk_cap,
            ),
            None => score,
        }
    }

    pub fn loss(&self, id: &str, score: f64, threshold: f64) -> f64 {
        let (generation, is_critical) = self
            .by_id
            .get(id)
            .map(|p| (p.generation, p.is_critical))
            .unwrap_or((0, false));
        asymmetric_loss_with_origin(
            score,
            threshold,
            generation,
            is_critical,
            self.lambda,
            self.risk_step,
            self.risk_cap,
        )
    }

    pub fn clear(&mut self) {
        self.by_id.clear();
    }
}

impl Default for Originist {
    fn default() -> Self {
        Self::new()
    }
}

/// Repair-risk in [0, risk_cap] from generation count.
pub fn generation_risk(generation: u32, is_critical: bool, risk_step: f64, risk_cap: f64) -> f64 {
    if generation == 0 {
        return 0.0;
    }
    let step = if is_critical { risk_step } else { risk_step * 0.5 };
    (generation as f64 * step).min(risk_cap)
}

pub fn trust_weight(generation: u32, is_critical: bool, risk_step: f64, risk_cap: f64) -> f64 {
    1.0 - generation_risk(generation, is_critical, risk_step, risk_cap)
}

pub fn origin_adjusted_score(
    score: f64,
    generation: u32,
    is_critical: bool,
    risk_step: f64,
    risk_cap: f64,
) -> f64 {
    let trust = trust_weight(generation, is_critical, risk_step, risk_cap);
    (score * trust).clamp(0.0, 1.0)
}

/// Asymmetric loss with origin generation. Extra multiplier on the drop side
/// when generation > 0 (losing thrice-repaired critical content costs more).
pub fn asymmetric_loss_with_origin(
    score: f64,
    threshold: f64,
    generation: u32,
    is_critical: bool,
    lambda: f64,
    risk_step: f64,
    risk_cap: f64,
) -> f64 {
    let base = asymmetric_loss(score, threshold, lambda);
    if score >= threshold || generation == 0 {
        return base;
    }
    let risk = generation_risk(generation, is_critical, risk_step, risk_cap);
    base * (1.0 + risk * lambda)
}

pub fn next_generation(
    previous: u32,
    original_hash: &str,
    new_content_hash: &str,
    content_changed: bool,
) -> u32 {
    if !content_changed {
        return previous;
    }
    if new_content_hash == original_hash {
        return 0;
    }
    previous.saturating_add(1)
}

fn simple_hash(s: &str) -> String {
    let mut h: i32 = 0;
    for b in s.bytes() {
        h = h.wrapping_shl(5).wrapping_sub(h).wrapping_add(b as i32);
    }
    format!("h-{:x}", h.unsigned_abs())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fresh_tag_is_generation_zero() {
        let mut o = Originist::new();
        let p = o.tag("a", "hello world", true, true);
        assert_eq!(p.generation, 0);
        assert_eq!(o.risk("a"), 0.0);
    }

    #[test]
    fn rewrite_bumps_generation() {
        let mut o = Originist::new();
        o.tag("a", "original fact about /usr/bin/cargo", true, true);
        let p = o.record_rewrite("a", "original fact about cargo", None);
        assert_eq!(p.generation, 1);
        assert!(o.risk("a") > 0.0);
    }

    #[test]
    fn noop_rewrite_keeps_generation() {
        let mut o = Originist::new();
        o.tag("a", "same", false, true);
        let p = o.record_rewrite("a", "same", None);
        assert_eq!(p.generation, 0);
    }

    #[test]
    fn reanchor_resets() {
        let mut o = Originist::new();
        o.tag("a", "v1", true, true);
        o.record_rewrite("a", "v2", None);
        o.record_rewrite("a", "v3", None);
        assert_eq!(o.generation("a"), 2);
        let p = o.tag("a", "v3", true, true);
        assert_eq!(p.generation, 0);
    }

    #[test]
    fn drop_side_loss_grows_with_generation() {
        let score = 0.1;
        let threshold = 0.35;
        let g0 = asymmetric_loss_with_origin(score, threshold, 0, true, LAMBDA, GENERATION_RISK_STEP, GENERATION_RISK_CAP);
        let g3 = asymmetric_loss_with_origin(score, threshold, 3, true, LAMBDA, GENERATION_RISK_STEP, GENERATION_RISK_CAP);
        assert!(g3 > g0, "g3={g3} should exceed g0={g0}");
        // Keep-side (score above threshold) unchanged by generation
        let keep0 = asymmetric_loss_with_origin(0.8, threshold, 0, true, LAMBDA, GENERATION_RISK_STEP, GENERATION_RISK_CAP);
        let keep3 = asymmetric_loss_with_origin(0.8, threshold, 3, true, LAMBDA, GENERATION_RISK_STEP, GENERATION_RISK_CAP);
        assert!((keep0 - keep3).abs() < 1e-12);
    }

    #[test]
    fn adjusted_score_reduces_trust() {
        let s = origin_adjusted_score(1.0, 3, true, GENERATION_RISK_STEP, GENERATION_RISK_CAP);
        assert!(s < 1.0);
        assert!(s > 0.0);
    }
}
