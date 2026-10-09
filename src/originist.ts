/**
 * Originist — generation count / repair-risk on regenerated content.
 *
 * Critical-token machinery (Safety Floors, λ=3.0) currently treats
 * "survived compression" as roughly binary. A token regenerated from a
 * compressed summary across Rewrite → Compose cycles is a different
 * epistemic object than one never touched, even if byte-identical now.
 *
 * Originist tags each unit with a generation count — cycles since it last
 * matched a verbatim original — and lets loss/scoring depend on that count.
 *
 * generation 0 = still matches last known original
 * generation n = rewritten / recomposed n times since last verbatim match
 *
 * @see Future Work in README — Archivist and Originist
 * @see crates/kompress-core loss.rs λ=3.0 asymmetric loss
 */

/** Default λ — matches Rust `LAMBDA` and project asymmetric loss. */
export const ORIGIN_LAMBDA = 3.0;

/** How much each generation increases repair-risk for critical content. */
export const GENERATION_RISK_STEP = 0.12;

/** Cap on generation-derived risk so scores stay in a usable range. */
export const GENERATION_RISK_CAP = 0.6;

export interface Provenance {
  /** Stable unit id (message id, content key, etc.). */
  id: string;
  /** Hash of content at last verbatim (generation-0) observation. */
  original_hash: string;
  /** Hash of current content. */
  current_hash: string;
  /** Cycles through rewrite/compose since last verbatim match. */
  generation: number;
  /** True if content matches patterns that Safety Floors care about. */
  is_critical: boolean;
  updated_at_ms: number;
}

export interface OriginTagInput {
  id: string;
  content: string;
  is_critical?: boolean;
  /** If true, treat current content as a new original (reset generation). */
  as_original?: boolean;
  timestamp_ms?: number;
}

export interface OriginistOptions {
  lambda?: number;
  riskStep?: number;
  riskCap?: number;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return `h-${Math.abs(h).toString(36)}`;
}

/**
 * Repair-risk in [0, riskCap] from generation count.
 * Non-critical content accrues risk more slowly (half step).
 */
export function generationRisk(
  generation: number,
  isCritical: boolean,
  riskStep: number = GENERATION_RISK_STEP,
  riskCap: number = GENERATION_RISK_CAP,
): number {
  if (generation <= 0) return 0;
  const step = isCritical ? riskStep : riskStep * 0.5;
  return Math.min(riskCap, generation * step);
}

/**
 * Trust weight in (0, 1]: how much to believe current content vs original.
 * generation 0 → 1; decays toward 1 - riskCap.
 */
export function trustWeight(
  generation: number,
  isCritical: boolean,
  riskStep: number = GENERATION_RISK_STEP,
  riskCap: number = GENERATION_RISK_CAP,
): number {
  return 1 - generationRisk(generation, isCritical, riskStep, riskCap);
}

/**
 * Asymmetric loss with origin generation.
 * Base loss matches the sketch: drop below threshold costs λ× more.
 * Generation multiplies the drop-side cost for critical regenerated content —
 * losing a thrice-repaired fact is costlier than losing a fresh original.
 */
export function asymmetricLossWithOrigin(
  score: number,
  threshold: number,
  generation: number,
  isCritical: boolean,
  lambda: number = ORIGIN_LAMBDA,
  riskStep: number = GENERATION_RISK_STEP,
  riskCap: number = GENERATION_RISK_CAP,
): number {
  const base =
    score < threshold ? lambda * (threshold - score) : score - threshold;
  if (score >= threshold || generation <= 0) return base;
  const risk = generationRisk(generation, isCritical, riskStep, riskCap);
  // Extra penalty only on the drop side (score < threshold).
  return base * (1 + risk * lambda);
}

/**
 * Adjust a keep-score downward by repair-risk so high-generation critical
 * content competes less favorably against fresh material (without binary kill).
 */
export function originAdjustedScore(
  score: number,
  generation: number,
  isCritical: boolean,
  riskStep: number = GENERATION_RISK_STEP,
  riskCap: number = GENERATION_RISK_CAP,
): number {
  const trust = trustWeight(generation, isCritical, riskStep, riskCap);
  return Math.max(0, Math.min(1, score * trust));
}

/**
 * Bump generation when content is rewritten. If rewritten text still matches
 * the original hash, generation stays 0 (rewrite was a no-op).
 */
export function nextGeneration(
  previous: number,
  originalHash: string,
  newContentHash: string,
  contentChanged: boolean,
): number {
  if (!contentChanged) return previous;
  if (newContentHash === originalHash) return 0;
  return previous + 1;
}

export class Originist {
  private readonly byId = new Map<string, Provenance>();
  private readonly lambda: number;
  private readonly riskStep: number;
  private readonly riskCap: number;

  constructor(options: OriginistOptions = {}) {
    this.lambda = options.lambda ?? ORIGIN_LAMBDA;
    this.riskStep = options.riskStep ?? GENERATION_RISK_STEP;
    this.riskCap = options.riskCap ?? GENERATION_RISK_CAP;
  }

  /** Register or refresh a unit. `as_original` resets generation to 0. */
  tag(input: OriginTagInput): Provenance {
    const hash = simpleHash(input.content);
    const ts = input.timestamp_ms ?? Date.now();
    const existing = this.byId.get(input.id);

    if (!existing || input.as_original) {
      const prov: Provenance = {
        id: input.id,
        original_hash: hash,
        current_hash: hash,
        generation: 0,
        is_critical: input.is_critical ?? false,
        updated_at_ms: ts,
      };
      this.byId.set(input.id, prov);
      return { ...prov };
    }

    const contentChanged = hash !== existing.current_hash;
    const generation = nextGeneration(
      existing.generation,
      existing.original_hash,
      hash,
      contentChanged,
    );
    const is_critical = input.is_critical ?? existing.is_critical;
    const original_hash =
      generation === 0 && hash === existing.original_hash
        ? existing.original_hash
        : existing.original_hash;

    const prov: Provenance = {
      id: input.id,
      original_hash,
      current_hash: hash,
      generation,
      is_critical,
      updated_at_ms: ts,
    };
    this.byId.set(input.id, prov);
    return { ...prov };
  }

  /**
   * Record a rewrite/compose cycle for an existing unit.
   * Equivalent to tag() with the new content; bumps generation if text changed.
   */
  recordRewrite(id: string, newContent: string, isCritical?: boolean): Provenance {
    const existing = this.byId.get(id);
    if (!existing) {
      return this.tag({ id, content: newContent, is_critical: isCritical });
    }
    return this.tag({
      id,
      content: newContent,
      is_critical: isCritical ?? existing.is_critical,
    });
  }

  /** Mark current content as the new ground-truth original (generation → 0). */
  reanchor(id: string, content: string): Provenance | undefined {
    if (!this.byId.has(id)) return undefined;
    return this.tag({ id, content, as_original: true, is_critical: this.byId.get(id)!.is_critical });
  }

  get(id: string): Provenance | undefined {
    const p = this.byId.get(id);
    return p ? { ...p } : undefined;
  }

  getGeneration(id: string): number {
    return this.byId.get(id)?.generation ?? 0;
  }

  size(): number {
    return this.byId.size;
  }

  risk(id: string): number {
    const p = this.byId.get(id);
    if (!p) return 0;
    return generationRisk(p.generation, p.is_critical, this.riskStep, this.riskCap);
  }

  adjustedScore(id: string, score: number): number {
    const p = this.byId.get(id);
    if (!p) return score;
    return originAdjustedScore(score, p.generation, p.is_critical, this.riskStep, this.riskCap);
  }

  loss(id: string, score: number, threshold: number): number {
    const p = this.byId.get(id);
    const generation = p?.generation ?? 0;
    const isCritical = p?.is_critical ?? false;
    return asymmetricLossWithOrigin(
      score,
      threshold,
      generation,
      isCritical,
      this.lambda,
      this.riskStep,
      this.riskCap,
    );
  }

  clear(): void {
    this.byId.clear();
  }

  /** Export all provenance rows (for telemetry / Archivist handoff). */
  snapshot(): Provenance[] {
    return [...this.byId.values()].map((p) => ({ ...p }));
  }
}

export function createOriginist(options?: OriginistOptions): Originist {
  return new Originist(options);
}

/** Heuristic criticality — mirrors Safety Floor / syntactic critical sketches. */
export function isCriticalContent(content: string): boolean {
  if (!content) return false;
  if (content.includes("```")) return true;
  if (content.startsWith("Error:") || content.includes("\nError:")) return true;
  if (content.includes("/") && content.length > 3) return true;
  if (content.includes("::")) return true;
  if (content.length === 64 && /^[0-9a-fA-F]+$/.test(content)) return true;
  return false;
}
