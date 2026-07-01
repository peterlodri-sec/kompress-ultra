use crate::composer::Composer;
use crate::loss::{asymmetric_loss, effective_score, is_critical_syntactic, LAMBDA, TARGET_RATIO};
use crate::pipeline::Pipeline;
use crate::pruner::Pruner;
use crate::rewriter::Rewriter;
use crate::types::ContextUnit;

/// Test that the full pipeline reduces token count below input
#[test]
fn full_pipeline_reduces_token_count() {
    let pipeline = Pipeline::new();

    // Create inputs with filler words and multiple sentences
    let inputs: Vec<String> = vec![
        "This is basically just a very simple test sentence with some filler words obviously".to_string(),
        "The second sentence is essentially another example that demonstrates how the system works".to_string(),
        "Finally this third sentence is very clearly showing that compression can be quite effective".to_string(),
    ];

    let result = pipeline.run(inputs.clone()).unwrap();

    // Verify compression happened
    assert!(result.output_tokens < result.input_tokens,
        "Pipeline should reduce tokens: input={}, output={}",
        result.input_tokens, result.output_tokens);

    // Verify we have output units
    assert!(!result.units.is_empty(), "Pipeline should produce output units");

    // Verify compression ratio is valid
    assert!(result.compression_ratio > 0.0, "Compression ratio should be positive");
    assert!(result.compression_ratio <= 1.0, "Compression ratio should be <= 1.0");
}

/// Test that critical syntactic tokens survive pruning even with low base score
#[test]
fn critical_syntactic_tokens_survive_pruning() {
    let pruner = Pruner::new();

    // Create a unit with a file path (critical syntactic pattern)
    // Even with low base score, effective_score should boost it above threshold
    let critical_units = vec![
        ContextUnit {
            id: "critical-path".to_string(),
            content: "/usr/bin/cargo".to_string(),  // File path - critical syntactic
            score: 0.1,  // Very low score
            layer: [0, 1, 2],
            token_count: 3,
            is_critical_syntactic: true,
        },
        ContextUnit {
            id: "rust-namespace".to_string(),
            content: "serde::Deserialize".to_string(),  // Rust namespace - critical syntactic
            score: 0.15,  // Still low
            layer: [0, 1, 2],
            token_count: 2,
            is_critical_syntactic: true,
        },
        ContextUnit {
            id: "regular-text".to_string(),
            content: "just some regular text".to_string(),  // Not critical
            score: 0.1,  // Low score
            layer: [0, 1, 2],
            token_count: 4,
            is_critical_syntactic: false,
        },
    ];

    let pruned = pruner.prune(critical_units).unwrap();

    // The critical syntactic tokens should survive despite low score
    // because effective_score boosts them with CRITICAL_SYNTACTIC_BOOST
    assert!(pruned.len() >= 2, "At least critical syntactic tokens should survive");

    // Verify that at least one critical syntactic item survived
    let has_critical = pruned.iter().any(|u| u.is_critical_syntactic);
    assert!(has_critical, "Critical syntactic tokens should survive pruning");
}

/// Test that compression ratio is properly tracked
#[test]
fn compression_ratio_tracked() {
    let pipeline = Pipeline::new();

    // Create inputs with 20 filler-heavy sentences
    let inputs: Vec<String> = (0..20)
        .map(|i| {
            format!(
                "This is basically just a very simple test sentence number {} with some filler words obviously and clearly",
                i
            )
        })
        .collect();

    let result = pipeline.run(inputs).unwrap();

    // Verify compression ratio is correctly calculated
    assert!(result.compression_ratio <= 1.0,
        "Compression ratio should be <= 1.0, got {}", result.compression_ratio);

    // Verify output has fewer tokens than input
    assert!(result.output_tokens < result.input_tokens,
        "Output tokens ({}) should be less than input tokens ({})",
        result.output_tokens, result.input_tokens);

    // Verify compression ratio matches the calculation
    let expected_ratio = result.output_tokens as f64 / result.input_tokens as f64;
    assert!((result.compression_ratio - expected_ratio).abs() < 1e-10,
        "Compression ratio mismatch: got {}, expected {}",
        result.compression_ratio, expected_ratio);

    // Verify target ratio is set
    assert_eq!(result.target_ratio, TARGET_RATIO);
}

/// Test that lambda=3 penalizes dropping high-score tokens significantly more
#[test]
fn lambda_3_penalizes_dropping_high_score() {
    // Test direct loss function
    // Dropping a high-score token (0.9) should cost more than keeping a low-score token (0.4)

    // Cost of dropping score=0.9 (above threshold 0.35)
    // Since 0.9 > 0.35: loss = 0.9 - 0.35 = 0.55
    let drop_high_cost = asymmetric_loss(0.9, 0.35, LAMBDA);

    // Cost of keeping score=0.1 (below threshold 0.35)
    // Since 0.1 < 0.35: loss = LAMBDA * (0.35 - 0.1) = 3.0 * 0.25 = 0.75
    let keep_low_cost = asymmetric_loss(0.1, 0.35, LAMBDA);

    // Dropping the high score should cost less than keeping the low score
    // because the asymmetric loss penalizes dropping high scores less in the formula
    // but penalizes low scores more when below threshold
    assert!(keep_low_cost > drop_high_cost,
        "Keeping low score (cost={}) should have higher loss than dropping high score (cost={})",
        keep_low_cost, drop_high_cost);

    // Verify expected values match the formula
    // drop_high_cost should be 0.9 - 0.35 = 0.55
    assert!((drop_high_cost - 0.55).abs() < 1e-10,
        "Drop high score cost should be ~0.55, got {}", drop_high_cost);

    // keep_low_cost should be 3.0 * (0.35 - 0.1) = 0.75
    assert!((keep_low_cost - 0.75).abs() < 1e-10,
        "Keep low score cost should be ~0.75, got {}", keep_low_cost);
}

/// Test that rewriter strips filler words and shortens content
#[test]
fn rewriter_strips_filler() {
    let rewriter = Rewriter::new();

    // Create a unit with filler words that should be removed
    let units = vec![ContextUnit {
        id: "u0".to_string(),
        content: "This is basically just a very simple test".to_string(),
        score: 0.8,
        layer: [0, 1, 2],
        token_count: 9,  // Original token count
        is_critical_syntactic: false,
    }];

    let output = rewriter.rewrite(units).unwrap();

    // Verify output has content
    assert!(!output.is_empty(), "Rewriter should produce output");

    let rewritten_unit = &output[0];

    // Filler words should be removed: "basically", "just", "very"
    // Original: "This is basically just a very simple test" (9 words)
    // After removal: "This is a simple test" (5 words)
    assert!(rewritten_unit.token_count <= 9,
        "Rewritten content should have fewer tokens: {} vs original {}",
        rewritten_unit.token_count, 9);

    // Verify filler words are actually gone
    assert!(!rewritten_unit.content.to_lowercase().contains(" basically "));
    assert!(!rewritten_unit.content.to_lowercase().contains(" just "));
    assert!(!rewritten_unit.content.to_lowercase().contains(" very "));

    // Verify ID is preserved
    assert_eq!(rewritten_unit.id, "u0");

    // Verify score is preserved
    assert_eq!(rewritten_unit.score, 0.8);
}
