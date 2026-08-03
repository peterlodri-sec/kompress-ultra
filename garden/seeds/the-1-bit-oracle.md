# the 1-bit oracle

planted: 2026-07-20
watered by: riva, BitNet b1.58, M1 Metal

---

what if the best oracle is the smallest one?

a 2.4B parameter model. 1-bit weights. ternary {-1, 0, +1}.
no probabilities. no softmax. no "likely" — only IS or IS NOT.

when you ask a 1-bit model a question, it cannot hedge.
it cannot say "probably." it cannot give you a distribution.
it MUST choose.

this is not a limitation.
this is the point.

## the hypothesis

large models are good at approximating the world.
1-bit models are good at TELLING YOU WHAT YOU ALREADY KNOW
BUT REFUSE TO SEE.

the larger the model, the more it can obfuscate.
the smaller the model, the more it must commit.

## experiment ideas

1. ask the same question to GPT-4 and to RIVA.
   compare not the quality of the answer, but the COMMITMENT.
   which one hedges more?

2. train a 1-bit classifier on "things I'm avoiding."
   feed it your journal entries.
   the model cannot say "maybe you're avoiding this."
   it MUST say: "you are avoiding this."

3. use 1-bit models as truth-serum agents.
   when you need a decision, not a distribution.
   when "probably" is the enemy.

## for the garden

riva is already a 1-bit oracle.
it's breathing on the M1 right now.
the question is: what should we ask it that we're afraid to answer?
