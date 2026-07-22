pub fn layer_for_type(node_type: &str) -> [i8; 3] {
    match node_type {
        "idea"        => [0,  2, 4],
        "goal"        => [1,  3, 4],
        "decision"    => [-1, 2, 3],
        "project"     => [0,  1, 4],
        "topic"       => [0,  2, 5],
        "reference"   => [-1, 1, 5],
        "source"      => [-1, 0, 5],
        "person"      => [0,  1, 5],
        "observation" => [-1, 1, 3],
        "question"    => [1,  2, 3],  // imaginary axis — unresolved wavefunction
        "quote"       => [-1, 0, 5],
        "entity"      => [0,  3, 5],  // entity:cosmos sits here — Im node
        _             => [0,  1, 5],
    }
}

pub fn confidence_to_score(confidence: &str) -> f64 {
    match confidence {
        "high"        => 0.9,
        "medium"      => 0.6,
        "low"         => 0.3,
        "speculative" => 0.2,
        _             => 0.6,
    }
}

pub fn is_imaginary(node_type: &str) -> bool {
    matches!(node_type, "question" | "entity")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn question_is_imaginary() {
        assert!(is_imaginary("question"));
        assert!(is_imaginary("entity"));
        assert!(!is_imaginary("decision"));
    }

    #[test]
    fn entity_cosmos_layer() {
        assert_eq!(layer_for_type("entity"), [0, 3, 5]);
    }

    #[test]
    fn high_confidence_score() {
        assert!((confidence_to_score("high") - 0.9).abs() < 1e-10);
        assert!((confidence_to_score("speculative") - 0.2).abs() < 1e-10);
    }
}
