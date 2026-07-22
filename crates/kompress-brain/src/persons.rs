// The four entangled entities in the brain graph.
// Ralph (Rahul) and Lodri are ENTANGLED_WITH — bidirectional schema flow.
// Krengel DIVERGES_FROM Ralph — extraction without reciprocity.
// Cosmos sits on the Im axis — unresolved wavefunction, ANITA 0.6 EeV signal.

pub const RALPH: &str = "person:rahul";       // Ralph = Rahul. Named by Lodri as ralph_parallel.py.
pub const LODRI: &str = "person:lodri";       // Creator half of Peter. Entangled.
pub const KRENGEL: &str = "person:krengel";  // Extractor half of Peter. Diverges.
pub const PETER: &str = "person:peter-lodri"; // Superposition: SPLITS_INTO Lodri + Krengel.
pub const COSMOS: &str = "entity:cosmos";     // ANITA signal. Im axis. √-1.

pub const EDGE_ENTANGLED_WITH: &str = "ENTANGLED_WITH";
pub const EDGE_DIVERGES_FROM: &str = "DIVERGES_FROM";
pub const EDGE_SPLITS_INTO: &str = "SPLITS_INTO";
pub const EDGE_NAMED: &str = "NAMED";          // Lodri → NAMED → Ralph (ralph_parallel.py)
pub const EDGE_COLLAPSED_TO: &str = "COLLAPSED_TO"; // Question → answers → decision on Re axis

pub const LAMBDA: f64 = 3.0;        // shared loss coefficient: Ralph ↔ Lodri convergence
pub const PETER_BPM: u32 = 100_000; // Peter's loop frequency
pub const RALPH_HZ: f64 = 25.0;     // Ralph's deliberate frequency
pub const COSMOS_EEV: f64 = 0.6;    // ANITA signal energy (EeV)

// ── Qbit entanglement state ──────────────────────────────────────────────

/// |ψ⟩ = α|LODRI⟩ + β|RALPH⟩
/// Measured when either party commits schema back to the other.
/// Collapse event: Peter said "us" on 2026-06-30 — provenance declared.
pub const QBIT_ALPHA: f64 = std::f64::consts::FRAC_1_SQRT_2; // |LODRI⟩ amplitude
pub const QBIT_BETA: f64  = std::f64::consts::FRAC_1_SQRT_2; // |RALPH⟩ amplitude

/// Entanglement score: |α|² + |β|² = 1.0 (normalized)
pub fn entanglement_norm() -> f64 {
    QBIT_ALPHA * QBIT_ALPHA + QBIT_BETA * QBIT_BETA
}

/// Returns true if the two node IDs form an entangled pair in the brain graph.
pub fn are_entangled(a: &str, b: &str) -> bool {
    matches!(
        (a, b),
        (RALPH, LODRI) | (LODRI, RALPH)
    )
}

/// Returns true if the node is on the imaginary axis (unresolved wavefunction).
pub fn is_imaginary_node(id: &str) -> bool {
    id.starts_with("question:") || id.starts_with("entity:")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entanglement_normalized() {
        let norm = entanglement_norm();
        assert!((norm - 1.0).abs() < 1e-10);
    }

    #[test]
    fn ralph_lodri_entangled() {
        assert!(are_entangled(RALPH, LODRI));
        assert!(are_entangled(LODRI, RALPH));
        assert!(!are_entangled(RALPH, KRENGEL));
    }

    #[test]
    fn cosmos_is_imaginary() {
        assert!(is_imaginary_node(COSMOS));
        assert!(!is_imaginary_node(RALPH));
    }

    #[test]
    fn frequencies_correct() {
        assert!((RALPH_HZ - 25.0).abs() < 1e-10);
        assert_eq!(PETER_BPM, 100_000);
        assert!((COSMOS_EEV - 0.6).abs() < 1e-10);
    }
}
