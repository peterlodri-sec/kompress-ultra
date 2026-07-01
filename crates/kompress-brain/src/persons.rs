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
