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
        || if content
            .split('.')
            .count()
            .eq(&4) { content.split('.').all(|p| p.parse::<u8>().is_ok()) } else { false }
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

    #[test]
    fn table_driven_asymmetric_loss() {
        // Table-driven test: (score, threshold, lambda) -> expected_loss
        let test_cases = vec![
            (0.0, 0.35, 3.0, 1.05),      // below threshold: 3.0 * (0.35 - 0.0) = 1.05
            (0.35, 0.35, 3.0, 0.0),      // exactly at threshold
            (1.0, 0.35, 3.0, 0.65),      // above threshold: 1.0 - 0.35 = 0.65
            (0.2, 0.5, 2.0, 0.6),        // below threshold: 2.0 * (0.5 - 0.2) = 0.6
            (0.8, 0.5, 2.0, 0.3),        // above threshold: 0.8 - 0.5 = 0.3
        ];

        for (score, threshold, lambda, expected) in test_cases {
            let loss = asymmetric_loss(score, threshold, lambda);
            assert!(
                (loss - expected).abs() < 1e-10,
                "asymmetric_loss({}, {}, {}) = {}, expected {}",
                score,
                threshold,
                lambda,
                loss,
                expected
            );
        }
    }

    #[test]
    fn target_ratio_matches_frac_1_pi() {
        // Verify TARGET_RATIO matches FRAC_1_PI to 15 decimal places
        let expected = std::f64::consts::FRAC_1_PI;
        assert_eq!(TARGET_RATIO, expected);

        // Additional check: 15 decimal places
        let target_rounded = (TARGET_RATIO * 1e15).round() / 1e15;
        let expected_rounded = (expected * 1e15).round() / 1e15;
        assert!(
            (target_rounded - expected_rounded).abs() < 1e-15,
            "TARGET_RATIO = {}, FRAC_1_PI = {}",
            TARGET_RATIO,
            expected
        );
    }

    #[test]
    fn is_critical_syntactic_comprehensive() {
        // File paths with slashes
        assert!(is_critical_syntactic("/usr/bin/cargo"));

        // Regular text without special patterns
        assert!(!is_critical_syntactic("hello world"));

        // Rust-style namespacing
        assert!(is_critical_syntactic("abc::def"));

        // 64-char hex string (SHA-256-like hash)
        let hex_hash = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
        assert_eq!(hex_hash.len(), 64);
        assert!(is_critical_syntactic(hex_hash));

        // IPv4 address
        assert!(is_critical_syntactic("192.168.1.1"));

        // Non-IPv4 dot-separated string
        assert!(!is_critical_syntactic("not an ip"));

        // Dot-separated with non-numeric parts
        assert!(!is_critical_syntactic("version.1.2.3"));

        // Path with multiple slashes
        assert!(is_critical_syntactic("/home/user/project/src/main.rs"));

        // Short path (length <= 3) should not match slash pattern alone
        assert!(!is_critical_syntactic("/ab"));

        // Another namespace variant
        assert!(is_critical_syntactic("foo::bar::baz"));
    }

    #[test]
    fn effective_score_clamps_at_one() {
        // Test that boosting doesn't exceed 1.0
        let critical_content = "/usr/bin/cargo";
        let high_score = 0.8;
        let result = effective_score(high_score, critical_content);

        // 0.8 + 0.3 boost = 1.1, but should clamp to 1.0
        assert!(
            result <= 1.0,
            "effective_score should clamp at 1.0, got {}",
            result
        );
        assert!((result - 1.0).abs() < 1e-10, "expected 1.0, got {}", result);
    }

    #[test]
    fn effective_score_no_boost_without_critical() {
        // Non-critical content should not receive boost
        let regular_content = "hello world";
        let score = 0.5;
        let result = effective_score(score, regular_content);
        assert_eq!(result, score);
    }
}
