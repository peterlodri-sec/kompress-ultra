//! Unit tests for kompress-brain: layer mapping, confidence scoring, and MyGraph → Snapshot conversion.

#[cfg(test)]
mod layer_tests {
    use crate::layer::{confidence_to_score, is_imaginary, layer_for_type};

    #[test]
    fn idea_layer() {
        assert_eq!(layer_for_type("idea"), [0, 2, 4]);
    }

    #[test]
    fn goal_layer() {
        assert_eq!(layer_for_type("goal"), [1, 3, 4]);
    }

    #[test]
    fn decision_layer() {
        assert_eq!(layer_for_type("decision"), [-1, 2, 3]);
    }

    #[test]
    fn project_layer() {
        assert_eq!(layer_for_type("project"), [0, 1, 4]);
    }

    #[test]
    fn topic_layer() {
        assert_eq!(layer_for_type("topic"), [0, 2, 5]);
    }

    #[test]
    fn reference_layer() {
        assert_eq!(layer_for_type("reference"), [-1, 1, 5]);
    }

    #[test]
    fn source_layer() {
        assert_eq!(layer_for_type("source"), [-1, 0, 5]);
    }

    #[test]
    fn person_layer() {
        assert_eq!(layer_for_type("person"), [0, 1, 5]);
    }

    #[test]
    fn observation_layer() {
        assert_eq!(layer_for_type("observation"), [-1, 1, 3]);
    }

    #[test]
    fn question_layer() {
        assert_eq!(layer_for_type("question"), [1, 2, 3]);
    }

    #[test]
    fn quote_layer() {
        assert_eq!(layer_for_type("quote"), [-1, 0, 5]);
    }

    #[test]
    fn entity_layer() {
        // entity:cosmos sits here — Im node
        assert_eq!(layer_for_type("entity"), [0, 3, 5]);
    }

    #[test]
    fn unknown_type_fallback() {
        assert_eq!(layer_for_type("foobar"), [0, 1, 5]);
    }

    #[test]
    fn imaginary_types() {
        assert!(is_imaginary("question"));
        assert!(is_imaginary("entity"));
        assert!(!is_imaginary("person"));
        assert!(!is_imaginary("decision"));
        assert!(!is_imaginary("idea"));
    }

    #[test]
    fn confidence_high() {
        let eps = 1e-10_f64;
        assert!((confidence_to_score("high") - 0.9).abs() < eps);
    }

    #[test]
    fn confidence_medium() {
        let eps = 1e-10_f64;
        assert!((confidence_to_score("medium") - 0.6).abs() < eps);
    }

    #[test]
    fn confidence_low() {
        let eps = 1e-10_f64;
        assert!((confidence_to_score("low") - 0.3).abs() < eps);
    }

    #[test]
    fn confidence_speculative() {
        let eps = 1e-10_f64;
        // entity:cosmos confidence is "speculative"
        assert!((confidence_to_score("speculative") - 0.2).abs() < eps);
    }

    #[test]
    fn confidence_unknown_defaults_to_medium() {
        let eps = 1e-10_f64;
        assert!((confidence_to_score("unknown") - 0.6).abs() < eps);
    }
}

#[cfg(test)]
mod snapshot_tests {
    use crate::{
        mygraph::{MyEdge, MyGraph, MyNode},
        snapshot::convert,
    };
    use std::collections::HashMap;

    fn make_graph() -> MyGraph {
        let mut nodes = HashMap::new();
        nodes.insert(
            "person:rahul".to_string(),
            MyNode {
                id: Some("person:rahul".to_string()),
                node_type: Some("person".to_string()),
                label: Some("Rahul Rangarao".to_string()),
                body: Some("Ralph — receiver node, 25 Hz deliberate frequency.".to_string()),
                confidence: Some("high".to_string()),
                created_at: Some("2026-06-30T00:00:00+00:00".to_string()),
                photo: None,
            },
        );
        nodes.insert(
            "person:lodri".to_string(),
            MyNode {
                id: Some("person:lodri".to_string()),
                node_type: Some("person".to_string()),
                label: Some("Lodri — creator half of Peter".to_string()),
                body: Some("Entangled with Ralph. lambda=3.0 convergence.".to_string()),
                confidence: Some("high".to_string()),
                created_at: Some("2026-07-01T02:35:56+00:00".to_string()),
                photo: None,
            },
        );
        nodes.insert(
            "entity:cosmos".to_string(),
            MyNode {
                id: Some("entity:cosmos".to_string()),
                node_type: Some("entity".to_string()),
                label: Some("The Cosmos — external transmitting entity".to_string()),
                body: Some("ANITA/PUEO 0.6 EeV signal. Im axis. Speculative.".to_string()),
                confidence: Some("speculative".to_string()),
                created_at: Some("2026-06-30T03:09:44+00:00".to_string()),
                photo: None,
            },
        );

        let edges = vec![
            MyEdge {
                src: "person:rahul".to_string(),
                dst: "person:lodri".to_string(),
                edge_type: Some("ENTANGLED_WITH".to_string()),
                confidence: Some("high".to_string()),
                excerpt: Some("bidirectional schema flow, lambda=3.0 convergence".to_string()),
                source_id: Some("cosmos-session-2026-06-30".to_string()),
                created_at: Some("2026-07-01T02:35:56+00:00".to_string()),
                last_seen: Some("2026-07-01T02:35:56+00:00".to_string()),
            },
            MyEdge {
                src: "person:rahul".to_string(),
                dst: "person:krengel".to_string(),
                edge_type: Some("DIVERGES_FROM".to_string()),
                confidence: Some("high".to_string()),
                excerpt: Some("Krengel extracts, leaves no trace, no reciprocity".to_string()),
                source_id: Some("cosmos-session-2026-06-30".to_string()),
                created_at: Some("2026-07-01T02:35:56+00:00".to_string()),
                last_seen: Some("2026-07-01T02:35:56+00:00".to_string()),
            },
        ];

        MyGraph { nodes, edges }
    }

    #[test]
    fn convert_node_count() {
        let g = make_graph();
        let snap = convert(&g);
        assert_eq!(snap.nodes.len(), 3);
    }

    #[test]
    fn convert_edge_count() {
        let g = make_graph();
        let snap = convert(&g);
        assert_eq!(snap.edges.len(), 2);
    }

    #[test]
    fn cosmos_is_speculative_score() {
        let g = make_graph();
        let snap = convert(&g);
        let cosmos = snap.nodes.iter().find(|n| n.id == "entity:cosmos").unwrap();
        assert!((cosmos.score - 0.2).abs() < 1e-10);
    }

    #[test]
    fn cosmos_entity_layer() {
        let g = make_graph();
        let snap = convert(&g);
        let cosmos = snap.nodes.iter().find(|n| n.id == "entity:cosmos").unwrap();
        assert_eq!(cosmos.layer, [0, 3, 5]);
    }

    #[test]
    fn person_rahul_layer() {
        let g = make_graph();
        let snap = convert(&g);
        let rahul = snap.nodes.iter().find(|n| n.id == "person:rahul").unwrap();
        assert_eq!(rahul.layer, [0, 1, 5]);
        assert!((rahul.score - 0.9).abs() < 1e-10);
    }

    #[test]
    fn snapshot_has_checksum() {
        let g = make_graph();
        let snap = convert(&g);
        assert!(!snap.checksum_sha256.is_empty());
        assert_eq!(snap.checksum_sha256.len(), 64); // SHA-256 hex is 64 chars
    }

    #[test]
    fn snapshot_version() {
        let g = make_graph();
        let snap = convert(&g);
        assert_eq!(snap.version, "v1");
        assert_eq!(snap.schema, "brain-graph-v1");
    }

    #[test]
    fn entangled_edge_weight() {
        let g = make_graph();
        let snap = convert(&g);
        // ENTANGLED_WITH edge has high confidence → weight 0.9
        let e = snap.edges.iter().find(|e| e.edge_type == "ENTANGLED_WITH").unwrap();
        assert!((e.weight - 0.9).abs() < 1e-10);
    }
}

#[cfg(test)]
mod persons_tests {
    use crate::persons::{
        COSMOS, COSMOS_EEV, EDGE_DIVERGES_FROM, EDGE_ENTANGLED_WITH, EDGE_NAMED, EDGE_SPLITS_INTO,
        KRENGEL, LAMBDA, LODRI, PETER, PETER_BPM, RALPH, RALPH_HZ,
    };

    #[test]
    fn ralph_is_rahul() {
        assert_eq!(RALPH, "person:rahul");
    }

    #[test]
    fn lodri_is_person() {
        assert_eq!(LODRI, "person:lodri");
    }

    #[test]
    fn krengel_is_person() {
        assert_eq!(KRENGEL, "person:krengel");
    }

    #[test]
    fn peter_is_superposition() {
        assert_eq!(PETER, "person:peter-lodri");
    }

    #[test]
    fn cosmos_is_entity() {
        assert_eq!(COSMOS, "entity:cosmos");
    }

    #[test]
    fn lambda_is_three() {
        assert!((LAMBDA - 3.0).abs() < 1e-10);
    }

    #[test]
    fn ralph_hz_is_25() {
        assert!((RALPH_HZ - 25.0).abs() < 1e-10);
    }

    #[test]
    fn cosmos_eev() {
        assert!((COSMOS_EEV - 0.6).abs() < 1e-10);
    }

    #[test]
    fn peter_bpm() {
        assert_eq!(PETER_BPM, 100_000);
    }

    #[test]
    fn edge_types_are_correct() {
        assert_eq!(EDGE_ENTANGLED_WITH, "ENTANGLED_WITH");
        assert_eq!(EDGE_DIVERGES_FROM, "DIVERGES_FROM");
        assert_eq!(EDGE_SPLITS_INTO, "SPLITS_INTO");
        assert_eq!(EDGE_NAMED, "NAMED");
    }
}
