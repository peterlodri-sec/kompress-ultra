//! Archivist — append-only audit store outside the Circulator cycle.
//!
//! Circulator's memory is a *cycling* store (active → pruned → memory →
//! retrieved → active). Archivist records permanent exits from that loop:
//! what was pruned, when, and under what score — for audit, not automatic
//! per-cycle retrieval.
//!
//! Sketch status: in-memory append-only log with deliberate query API.
//! Durable backends (JSONL, object store) can wrap `record` without changing
//! the role contract.

use crate::types::ContextUnit;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ArchiveReason {
    Pruned,
    Overflow,
    Budget,
    Manual,
    Demoted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveRecord {
    pub id: String,
    pub content_hash: String,
    pub residual: String,
    pub score: f64,
    pub reason: ArchiveReason,
    pub timestamp_ms: i64,
    pub generation: Option<u32>,
    pub is_critical_syntactic: bool,
    pub token_count: usize,
}

#[derive(Debug, Clone, Default)]
pub struct ArchivistQuery {
    pub id: Option<String>,
    pub content_hash: Option<String>,
    pub reason: Option<ArchiveReason>,
    pub since_ms: Option<i64>,
    pub until_ms: Option<i64>,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone)]
pub struct Archivist {
    records: Vec<ArchiveRecord>,
    seq: u64,
    cap: usize,
}

impl Archivist {
    pub fn new() -> Self {
        Self {
            records: Vec::new(),
            seq: 0,
            cap: 10_000,
        }
    }

    pub fn with_cap(cap: usize) -> Self {
        Self {
            records: Vec::new(),
            seq: 0,
            cap: cap.max(1),
        }
    }

    /// Append a permanent exit record. Never updates existing rows.
    pub fn record(
        &mut self,
        residual: impl Into<String>,
        score: f64,
        reason: ArchiveReason,
        timestamp_ms: i64,
        generation: Option<u32>,
        is_critical_syntactic: bool,
        token_count: usize,
    ) -> ArchiveRecord {
        let residual = residual.into();
        let content_hash = simple_hash(&residual);
        self.seq += 1;
        let entry = ArchiveRecord {
            id: format!("arch-{content_hash}-{}-{}", timestamp_ms, self.seq),
            content_hash,
            residual,
            score,
            reason,
            timestamp_ms,
            generation,
            is_critical_syntactic,
            token_count,
        };
        self.records.push(entry.clone());
        if self.records.len() > self.cap {
            let excess = self.records.len() - self.cap;
            self.records.drain(0..excess);
        }
        entry
    }

    /// Archive a pruned `ContextUnit` (exit from active C).
    pub fn record_unit(
        &mut self,
        unit: &ContextUnit,
        reason: ArchiveReason,
        timestamp_ms: i64,
        generation: Option<u32>,
    ) -> ArchiveRecord {
        self.record(
            unit.content.clone(),
            unit.score,
            reason,
            timestamp_ms,
            generation,
            unit.is_critical_syntactic,
            unit.token_count,
        )
    }

    pub fn size(&self) -> usize {
        self.records.len()
    }

    /// Deliberate retrieval — AND filters, newest first.
    pub fn query(&self, q: &ArchivistQuery) -> Vec<ArchiveRecord> {
        let mut out: Vec<ArchiveRecord> = self
            .records
            .iter()
            .filter(|r| {
                if let Some(ref id) = q.id {
                    if &r.id != id {
                        return false;
                    }
                }
                if let Some(ref h) = q.content_hash {
                    if &r.content_hash != h {
                        return false;
                    }
                }
                if let Some(reason) = q.reason {
                    if r.reason != reason {
                        return false;
                    }
                }
                if let Some(since) = q.since_ms {
                    if r.timestamp_ms < since {
                        return false;
                    }
                }
                if let Some(until) = q.until_ms {
                    if r.timestamp_ms > until {
                        return false;
                    }
                }
                true
            })
            .cloned()
            .collect();
        out.sort_by(|a, b| b.timestamp_ms.cmp(&a.timestamp_ms));
        if let Some(limit) = q.limit {
            out.truncate(limit);
        }
        out
    }

    pub fn snapshot(&self) -> Vec<ArchiveRecord> {
        self.query(&ArchivistQuery::default())
    }

    /// Test helper — clears in-memory log only.
    pub fn clear(&mut self) {
        self.records.clear();
    }
}

impl Default for Archivist {
    fn default() -> Self {
        Self::new()
    }
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
    fn append_only_grows() {
        let mut a = Archivist::new();
        a.record("alpha", 0.2, ArchiveReason::Pruned, 1, None, false, 1);
        a.record("beta", 0.1, ArchiveReason::Budget, 2, Some(1), true, 2);
        assert_eq!(a.size(), 2);
        let snap = a.snapshot();
        assert_eq!(snap[0].residual, "beta"); // newest first
        assert_eq!(snap[1].residual, "alpha");
    }

    #[test]
    fn query_by_reason() {
        let mut a = Archivist::new();
        a.record("a", 0.0, ArchiveReason::Pruned, 1, None, false, 1);
        a.record("b", 0.0, ArchiveReason::Overflow, 2, None, false, 1);
        let q = ArchivistQuery {
            reason: Some(ArchiveReason::Overflow),
            ..Default::default()
        };
        let hits = a.query(&q);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].residual, "b");
    }

    #[test]
    fn cap_bounds_memory() {
        let mut a = Archivist::with_cap(2);
        a.record("1", 0.0, ArchiveReason::Pruned, 1, None, false, 1);
        a.record("2", 0.0, ArchiveReason::Pruned, 2, None, false, 1);
        a.record("3", 0.0, ArchiveReason::Pruned, 3, None, false, 1);
        assert_eq!(a.size(), 2);
        let ids: Vec<_> = a.snapshot().into_iter().map(|r| r.residual).collect();
        assert!(ids.contains(&"2".to_string()));
        assert!(ids.contains(&"3".to_string()));
    }

    #[test]
    fn record_unit_preserves_critical_flag() {
        let mut a = Archivist::new();
        let unit = ContextUnit {
            id: "u1".into(),
            content: "/usr/bin/cargo".into(),
            score: 0.15,
            layer: [0, 1, 2],
            token_count: 1,
            is_critical_syntactic: true,
        };
        let rec = a.record_unit(&unit, ArchiveReason::Pruned, 99, Some(2));
        assert!(rec.is_critical_syntactic);
        assert_eq!(rec.generation, Some(2));
        assert_eq!(rec.score, 0.15);
    }
}
