# PFO 6.43 — Sleeper touchdown bonus threshold adjudication (research evidence)

Evidence checked: November 7, 2026 (Pacific Time). This file **does not modify** Coach's immutable 2026 FFL scoring weights or 6.35 contract version.

## What is independently established by the scoring platform

Sleeper HQ's official September 17, 2026 help-center article **What Stacks?** states that 40+ yard passing TD and 50+ yard passing TD scoring options **stack** for a qualifying 50+ passing touchdown.

Authoritative source: https://support.sleeper.com/en/articles/3186339-what-stacks

Sleeper's scoring-options inventory separately identifies passing, rushing and receiving 40+/50+ TD bonus fields. It does not give the same explicit additive example for rushing and receiving on this page.

Scoring-options reference: https://support.sleeper.com/en/articles/3998131-what-scoring-options-are-available

### Application to the current FFL contract

Coach's November 5 contract has passing TD 40+ = +1, passing TD 50+ = +2. When the complete independently verified MSF event record proves a **50+ yard passing touchdown** and its inclusive 40+ threshold, the incremental long-TD portion is **+3** under Sleeper's documented stacking semantics. Ordinary passing yards and passing TD base points remain separate.

The same event must NOT be scored as only +2 by choosing the highest threshold, and must NOT award extra 40+ completion points because that unrelated FFL category has zero weight.

**This does not certify a player game score by itself:** source player IDs, provider fixture, complete MSF PBP, scoring attribution, game final status and corrections still need independent verification. A zero, absent or fragmented MSF long-TD event is never fabricated from this documentation.

### Pending adjudication

The official cited example explicitly establishes **passing** TD behavior. For rigorous FFO certification, 50+ rushing and receiving threshold stacking remains separately evidence-gated pending equally clear authority or verified official league scoring/event reconciliation. In practice the same overlapping platform design may apply; this document does not assume that as certified fact.

No provider API secrets, Sleeper fantasy point totals, FFOI feeds or public endpoints were used. The 6.43 experimental bonus proof gate and tests are isolated in draft PR #5. No release, schema change or new model promotion is authorized by this research.

The source-of-truth contract `FFO_FFL_SCORING_V1.json` is intentionally left byte-for-byte unchanged (Git blob `0e61cbe05f83419834c5d6619edd5ffbac5b2013`). The contract's earlier pending-semantics note is now supplemented by this separately cited verification; formal source contract revision requires explicit review, not a silent scoring mutation.
