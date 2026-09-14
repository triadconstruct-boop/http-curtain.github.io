# Y&Y // CURTAIN

CURTAIN is an adversarial claim-analysis and narrative-genealogy system. It searches indexed public records, retrieves source pages, separates corroboration from repetition, looks for explicit counterevidence, and traces recoverable source dependencies.

It does not use a generative model. The backend produces structured JSON with deterministic retrieval, text, date, citation, similarity, source-type, and stance-marker rules. The browser renders each result into its matching investigation field.

## What an analysis contains

- Confirming evidence
- Contradicting evidence
- Documented findings from primary, scholarly, and fact-check sources
- Known-hoax and fact-check records
- Repetition without proof
- Missing evidence
- Unsupported assumptions
- Competing explanations
- Falsifiable predictions and recovered past predictions
- Earliest recovered source and claimant metadata
- Narrative origin clusters
- Direct-link, canonical, and near-duplicate dependencies
- Propagation timeline and coverage gaps
- Explicitly documented beneficiaries and losing parties
- Full source index and provider diagnostics

## Retrieval sources

The default engine queries:

1. **GDELT DOC 2.0** for worldwide public news records
2. **Google News RSS** for current and refutation-oriented reporting
3. **Crossref** for scholarly publication metadata
4. **Wikipedia** for reference context and indexed hoax topics

It then retrieves a diverse subset of source pages, extracts publication metadata and outbound links, and compares titles and article text.

## Genealogy method

CURTAIN treats every URL as a lead, not an independent vote.

- Canonical URLs merge duplicate pages.
- High title or body-text similarity forms likely syndication/origin clusters.
- Direct outbound links create explicit dependency edges.
- The oldest machine-dated member becomes the root candidate for its cluster.
- The oldest root is labeled **earliest recovered source**.
- Domain count and origin-cluster count remain separate from raw URL count.

This can collapse a large retrieved news ecosystem into a smaller set of likely origins. It cannot prove first-ever authorship when a source was private, deleted, blocked, paywalled, image-only, or absent from the indexes.

## Analysis method

The engine uses:

- claim keyword extraction and relevance thresholds;
- explicit confirmation, denial, refutation, and hoax markers;
- source-type classification for primary records, research, fact checks, wire reporting, press releases, reporting, reference pages, and social posts;
- deterministic assumption checks based on causal, intent, absolute, anonymous-source, absence-of-evidence, measurement, and prediction language;
- rule-selected alternative explanations and falsification tests;
- explicit benefit/loss passages only, without treating benefit as proof of motive.

Automated relationship labels describe the text recovered. They require manual review before consequential use.

## Deployment

The frontend is deployed through GitHub Pages. `analysis-config.json` points to the Render web service.

Render settings:

- Build command: `node --check backend/server.mjs && node --check backend/analyzer.mjs`
- Start command: `node backend/server.mjs`
- Node: 22 or newer
- Required environment variable: `CURTAIN_ACCESS_TOKEN`
- Optional origin variables: `CURTAIN_ORIGIN` or comma-separated `CURTAIN_ORIGINS`

The server accepts the known Y&Y and GitHub Pages origins. The browser keeps the access token in page memory for the current load only. No model access is used.

## API

`GET /health` returns engine readiness and the provider list.

`POST /analyze` accepts:

```json
{"claim":"A specific, falsifiable claim"}
```

The request requires `Authorization: Bearer <CURTAIN_ACCESS_TOKEN>` and an allowed browser origin.
