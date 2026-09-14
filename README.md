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

## On-demand Astra integration

The old submit handler only displayed placeholders. The new handler submits only on explicit form submission, shows loading/errors, prevents duplicate submissions, and renders the answer and source links using text-safe DOM APIs. No typing, page-load, timer, or ingestion event calls Astra.

### Activation (not yet configured)
1. Host `backend/server.mjs` on a Node.js 22+ service with HTTPS, running `node backend/server.mjs`.
2. Set server-only secrets `OPENAI_API_KEY` and a strong random `CURTAIN_ACCESS_TOKEN`. Set `CURTAIN_ORIGIN=https://triadconstruct-boop.github.io`. Never commit secrets.
3. Set `analysis-config.json` endpoint to the hosted HTTPS URL ending in `/analyze`.
4. Submit a claim and enter the CURTAIN access token when prompted. It is never persisted by the app. This is a personal shared-token deployment, not multi-user authentication.
5. Verify a live Astra answer and clickable source links. API access and billing are required; they have not been verified in this checkout.

The server fixes the model to `gpt-6-astra`, high reasoning, and web search. It bounds input/output, allows one in-flight analysis per process, and never automatically retries paid calls. Deploy one instance for that concurrency bound; configure account spending limits before use. Origin checking supplements token authentication and does not replace it.

The backend is not run by GitHub Pages. Until hosted and configured the page explicitly reports that Astra is not connected.
