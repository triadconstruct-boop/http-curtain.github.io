# Y&Y // CURTAIN

CURTAIN is a standalone Y&Y claim-analysis and narrative-genealogy interface.

## Current starter

This first build is intentionally front-end only. It establishes the visual shell and analysis model without pretending to have live evidence retrieval.

### Core views
- Evidence vs contradiction
- Red-team / countercase
- Narrative genealogy
- Prediction ledger
- Null-zone detector
- Four-part CURTAIN protocol:
  1. Evidence
  2. Interpretation
  3. Alternatives
  4. Prediction

## Recommended next architecture

1. `sources/` — source registry, quality, provenance, reliability
2. `claims/` — normalized claims and lifecycle states
3. `genealogy/` — narrative origin + dependency graph
4. `analysis/` — corroboration, contradiction, independence, recency
5. `predictions/` — falsifiable prediction ledger
6. `null-zones/` — unexplained coverage-collapse detector
7. `ui/` — graph views, claim detail pages, filters
8. `jobs/` — autonomous ingestion/refresh routines

## Evidence-state model

Suggested states:

- CONFIRMED
- CREDIBLE_REPORT
- EARLY_WARNING
- SPECULATIVE
- UNVERIFIED_CLAIM
- REFUTED
- DORMANT

## Principle

> No hypothesis is promoted merely because it is interesting.

CURTAIN should always preserve a strict separation between observations, sources, interpretations, and hypotheses.
