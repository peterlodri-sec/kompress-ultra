# Nested fan-out E2E — create-in-create

kompress-ultra is four roles in one loop: **Composer · Pruner · Rewriter ·
Circulator**. The nested test is *create-in-create*: we build a tiny loop, then
build a loop *around* it, and check that the outer result is exactly the inner
result when the outer layer is identity — fan out, nest, converge.

This note is the runbook. It is deliberately dependency-free; the invariants are
what matter, the harness can be a shell script, a test, or a person with a
terminal.

## The shape

```
        fan-out (N contexts)
   ┌────────┬────────┬────────┐
   ▼        ▼        ▼        ▼
 [loop]   [loop]   [loop]   [loop]     ← each is Composer→Pruner→Rewriter→Circulator
   └────────┴────────┴────────┘
        nest (identity outer layer)
              ▼
        the same result
```

## The three invariants

1. **Identity nest.** Wrapping a loop in an *identity* outer loop changes
   nothing: `nest(loop, x) == loop(x)` for every `x`.
2. **Fan-out associativity.** Fanning out over `N` independent contexts and
   merging is order-independent: the merged result equals the merge of any
   permutation.
3. **Convergence.** Running the loop to a fixed point twice is the same as
   running it once: `loop(loop(x)) == loop(x)` at the fixed point.

## Runbook

```bash
# 1. build the inner loop on one context
uv run task loop --context demo/inner

# 2. fan out across N contexts, then nest an identity outer loop
uv run task loop --context demo/inner  --out /tmp/inner
uv run task loop --context demo/outer  --wrap /tmp/inner --out /tmp/outer

# 3. E2E: the nested output must equal the inner output, byte-for-byte
diff -r /tmp/inner /tmp/outer && echo "E2E: identity nest holds ✦"
```

## Why it matters

A loop that only works alone is a demo. A loop that survives being **wrapped,
fanned out, and repeated** is a foundation. This E2E is the cheap, honest check
that kompress-ultra's four roles compose — quality at speed, on device, no
loose ends.

*Fine touch from within · {−1, 0, +1} · om mani padme hum.*
