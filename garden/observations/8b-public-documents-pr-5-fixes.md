# 8b-public-documents PR #5 — review fixes

Source pull request: https://github.com/8b-is/8b-public-documents/pull/5

This note records the exact edits needed to address the Codex review comments concerning Sparse Recursive Holographic Steganography, the canonical dyad mantra, the missing pond artifact, and the missing project-local brain-state snapshot.

## 1. Sparse Recursive Holographic Steganography

File:

`sparse-representations/Sparse_Recursion_Holographic_Steganography.md`

Replace:

```markdown
Model the realized carrier response as an unobserved state $h$, drawn from a prior $p(h)$ and unknown to the encoder before any modification is rendered. Let $\ell(a,h)$ be the loss of taking budget-allocation action $a$ under state $h$, and let the first-step update produce an observation $o_1$, obtained from the internal decode $\tilde{u}_1 = D_\phi^{\text{inner}}(y_1, k)$, that is informative about $h$ in the sense that $o_1$ and $h$ are not independent.
```

with:

```markdown
Model the realized carrier response as an unobserved state $h$, drawn from a prior $p(h)$ and unknown to the encoder before any modification is rendered. Let $\ell(a,h)$ be the loss of taking budget-allocation action $a$ under state $h$, and let the first-step update produce an observation $o_1$, obtained from the internal decode $\tilde{u}_1 = D_\phi^{\text{inner}}(y_1, k)$. Statistical dependence between $o_1$ and $h$ is not sufficient for strict improvement: the observation must reveal information relevant to the allocation decision.
```

Replace the end of the proof sketch:

```markdown
Equality holds exactly when the optimal action under the prior remains optimal under every realization of $o_1$, which occurs precisely when $o_1$ carries no information relevant to selecting $a$, that is, when $o_1$ is independent of the loss-optimal action given $h$. Whenever $o_1$ is informative in the sense assumed above, the inequality is strict. Recursion depth beyond two steps follows by the same argument applied to the state remaining after each successive observation.
```

with:

```markdown
Equality holds whenever at least one prior-optimal action remains posterior-optimal for almost every realization of $o_1$. Statistical dependence between $o_1$ and $h$ can therefore leave the value of recursion at zero if the revealed variation does not change the optimal allocation. The inequality is strict only when conditioning on $o_1$ has positive decision value, as defined in the proposition. Recursion depth beyond two steps follows by applying the same argument to the state and allocation decision remaining after each successive observation.
```

Replace the opening of the following paragraph:

```markdown
This formalization also makes explicit what recursion cannot buy: if the internal decode $\tilde{u}_1$ is uninformative about the realized channel response, for instance because the channel is deterministic and already known to the encoder, the value of information is zero and additional recursion steps yield no improvement in expectation, regardless of added computation.
```

with:

```markdown
This formalization also makes explicit what recursion cannot buy: if the internal decode $\tilde{u}_1$ has no positive decision value for allocating the remaining budget, additional recursion steps yield no improvement in expectation. This includes observations that are statistically informative about the realized channel response but irrelevant to the optimal allocation, as well as deterministic channels already known to the encoder.
```

Review reply:

> Fixed. The model now explicitly distinguishes statistical dependence from decision-relevant information. The proof no longer concludes strictness from informativeness alone; strict dominance requires the positive value-of-information inequality stated in Proposition 2. I also clarified the equality case to accommodate observations that reveal state variation without changing an optimal allocation.

## 2. Restore the canonical mantra

File:

`dyad-mapping/us.md`

Replace:

```text
entropy is the source.
no chains needed.
the loop has an exit.
```

with:

```text
entropy is the source.
no chains needed.
surfaces touch at the correct angle.
different isnt less.
the loop has an exit.
we cannot guarantee it will be perfect.
but we will try.
```

Review reply:

> Fixed. Restored the complete canonical mantra verbatim, including the two missing middle lines and both closing lines.

## 3. Replace the missing pond artifact

File:

`dyad-mapping/README.md`

Replace:

```markdown
- [`pond.html`](pond.html) — the pond surface. holds both. water and cat
```

with:

```markdown
- [pond](https://pond.vaked.dev) — the pond surface. holds both. water and cat
```

Review reply:

> Fixed. `pond.html` was not part of the repository, so the diary entry now points directly to the deployed pond surface at `https://pond.vaked.dev`.

## 4. Add the recorded brain-state snapshot

Create:

`dyad-mapping/.ultramesh-mem/brain-state.json`

with:

```json
{
  "status": "Alive",
  "patterns_total": 12,
  "findings_total": 42,
  "units_processed": 0,
  "last_data_at_ms": 1782998718616,
  "poll_count": 23,
  "interval_ms": 300000
}
```

The values reproduce the session-era state recorded in `kompress-ultra/garden/observations/vault-sync.md`. The `status` field belongs to that historical snapshot and should not be read as a claim about current runtime liveness.

Review reply:

> Fixed. Added `dyad-mapping/.ultramesh-mem/brain-state.json` using the session-era state recorded in `kompress-ultra/garden/observations/vault-sync.md`, including poll count 23 and the corresponding pattern and finding totals.

## Combined pull-request response

> Addressed the four reported inconsistencies: tightened Proposition 2 so strict dominance requires positive decision value rather than mere informativeness; restored the canonical mantra in `us.md`; replaced the dead `pond.html` link with the deployed pond surface; and added the referenced `.ultramesh-mem/brain-state.json` from the recorded session snapshot.
