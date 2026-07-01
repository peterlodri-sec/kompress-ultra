// λ=3.0: asymmetric penalty — dropping a high-score token costs 3× more than keeping a low-score one.
// Structurally identical to stau suppressed radiative loss: the codec protects signal that
// would be destroyed by a standard symmetric loss channel.
pub const LAMBDA: f64 = 3.0;
pub const DEFAULT_THRESHOLD: f64 = 0.35;
pub const CRITICAL_SYNTACTIC_BOOST: f64 = 0.3;
pub const TARGET_RATIO: f64 = std::f64::consts::FRAC_1_PI; // ≈ 0.318

pub fn asymmetric_loss(score: f64, threshold: f64, lambda: f64) -> f64 {
    if score < threshold {
        lambda * (threshold - score)
    } else {
        score - threshold
    }
}

pub fn is_critical_syntactic(content: &str) -> bool {
    // file paths, hashes, IPs, code identifiers
    content.contains('/') && content.len() > 3
        || content.len() == 64 && content.chars().all(|c| c.is_ascii_hexdigit())
        || content.contains("::")
        || content
            .split('.')
            .count()
            .eq(&4)
            .then(|| content.split('.').all(|p| p.parse::<u8>().is_ok()))
            .unwrap_or(false)
}

pub fn effective_score(score: f64, content: &str) -> f64 {
    if is_critical_syntactic(content) {
        (score + CRITICAL_SYNTACTIC_BOOST).min(1.0)
    } else {
        score
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loss_below_threshold_is_penalized() {
        let loss = asymmetric_loss(0.1, 0.35, LAMBDA);
        assert!((loss - 0.75).abs() < 1e-10);
    }

    #[test]
    fn loss_above_threshold_is_linear() {
        let loss = asymmetric_loss(0.8, 0.35, LAMBDA);
        assert!((loss - 0.45).abs() < 1e-10);
    }

    #[test]
    fn lambda_asymmetry() {
        let drop_cost = asymmetric_loss(0.1, 0.35, LAMBDA);
        let keep_cost = asymmetric_loss(0.6, 0.35, LAMBDA);
        assert!(drop_cost > keep_cost * LAMBDA * 0.5);
    }

    #[test]
    fn critical_syntactic_boost() {
        let base = 0.3;
        let boosted = effective_score(base, "/usr/bin/cargo");
        assert!((boosted - 0.6).abs() < 1e-10);
    }
}
