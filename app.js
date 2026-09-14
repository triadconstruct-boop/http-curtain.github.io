const $ = id => document.getElementById(id);
const form = $("claimForm");
const input = $("claimInput");
const button = form.querySelector('button[type="submit"]');
let pending = false;
let sessionToken = "";
let sourceMap = new Map();

function make(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== "") element.textContent = text;
  return element;
}
function clear(target) { target.replaceChildren(); }
function empty(target, message) { clear(target); target.append(make("p", "empty", message)); }
function setText(id, value) { $(id).textContent = value ?? "—"; }
function sourceLink(source, label) {
  const link = make("a", "source-link", label || source?.title || source?.id || "Source");
  if (source?.url) {
    try {
      const url = new URL(source.url);
      if (["http:", "https:"].includes(url.protocol)) {
        link.href = url.href; link.target = "_blank"; link.rel = "noopener noreferrer";
      }
    } catch {}
  }
  return link;
}
function sourceReference(sourceId) {
  const source = sourceMap.get(sourceId);
  return sourceLink(source, source ? source.id + " · " + source.domain : sourceId);
}
function sourceCard(source) {
  const card = make("div", "source-card");
  const heading = make("div", "source-title");
  heading.append(sourceLink(source));
  const meta = make("div", "source-meta");
  for (const value of [
    source.id,
    source.kind?.replaceAll("_", " "),
    source.relationship?.replaceAll("_", " "),
    source.publishedAt?.slice(0, 10),
    source.domain
  ].filter(Boolean)) meta.append(make("span", "badge", value));
  card.append(heading, meta);
  if (source.excerpt) card.append(make("p", "source-excerpt", source.excerpt));
  if (source.fetchError) card.append(make("p", "fetch-note", "Page metadata only · " + source.fetchError));
  return card;
}
function renderSourceCards(id, records, message) {
  const target = $(id); clear(target);
  if (!records?.length) return empty(target, message);
  records.forEach(record => target.append(sourceCard(record)));
}
function renderTextList(id, records, message) {
  const target = $(id); clear(target);
  if (!records?.length) return empty(target, message);
  const list = make("ul", "analysis-list");
  records.forEach(record => list.append(make("li", "", String(record))));
  target.append(list);
}
function renderFindings(records) {
  const target = $("factsList"); clear(target);
  if (!records?.length) return empty(target, "No primary-record, research, or fact-check passage was recovered.");
  for (const record of records) {
    const row = make("div", "finding");
    row.append(make("p", "", record.finding || "No extract available."));
    const meta = make("div", "source-meta");
    meta.append(make("span", "badge", record.kind?.replaceAll("_", " ") || "SOURCE"), sourceReference(record.sourceId));
    row.append(meta); target.append(row);
  }
}
function renderAssumptions(records) {
  const target = $("assumptionsList"); clear(target);
  if (!records?.length) return empty(target, "No rule-triggered assumption was detected.");
  records.forEach((record, index) => {
    const item = make("div", "logic-item");
    item.append(make("b", "logic-number", String(index + 1).padStart(2, "0")));
    const body = make("div");
    body.append(make("h4", "", record.name), make("p", "", record.reason), make("small", "", "FALSIFY / VERIFY: " + record.test));
    item.append(body); target.append(item);
  });
}
function renderAlternatives(records) {
  const target = $("alternativesList"); clear(target);
  if (!records?.length) return empty(target, "No competing explanation was generated.");
  records.forEach(record => {
    const item = make("div", "analysis-item");
    item.append(make("h4", "", record.name), make("p", "", record.explanation), make("small", "", "TEST: " + record.test));
    target.append(item);
  });
}
function renderGenealogy(data) {
  const firstTarget = $("firstSource"); clear(firstTarget);
  if (data.earliestRecovered) {
    firstTarget.append(sourceCard(data.earliestRecovered));
    if (data.firstClaimant) {
      const attribution = [
        data.firstClaimant.author ? "Author: " + data.firstClaimant.author : "Individual author not recovered",
        "Publisher: " + (data.firstClaimant.publisher || "unknown"),
        data.firstClaimant.qualification
      ];
      firstTarget.append(make("p", "qualification", attribution.join(" · ")));
    }
  } else empty(firstTarget, "No recoverable dated origin was found.");

  const clusters = $("clustersList"); clear(clusters);
  if (!data.clusters?.length) empty(clusters, "No origin clusters were recovered.");
  else data.clusters.forEach(cluster => {
    const item = make("div", "cluster-card");
    const head = make("div", "cluster-head");
    head.append(make("b", "", cluster.id), make("span", "badge", cluster.members.length + " RECORD" + (cluster.members.length === 1 ? "" : "S")));
    item.append(head, sourceLink(cluster.root, cluster.root?.title || "Unknown root"));
    item.append(make("p", "cluster-meta", cluster.domains.length + " domain" + (cluster.domains.length === 1 ? "" : "s") + " · " + cluster.basis.replaceAll("_", " ")));
    clusters.append(item);
  });

  const dependencies = $("dependenciesList"); clear(dependencies);
  if (!data.dependencies?.length) empty(dependencies, "No direct-link or near-duplicate dependency was detected.");
  else data.dependencies.slice(0, 40).forEach(edge => {
    const from = sourceMap.get(edge.from), to = sourceMap.get(edge.to);
    const item = make("div", "dependency");
    item.append(sourceReference(edge.from), make("span", "dependency-arrow", "depends on"), sourceReference(edge.to));
    item.append(make("span", "badge", edge.basis.replaceAll("_", " ")));
    item.title = (from?.title || edge.from) + " → " + (to?.title || edge.to);
    dependencies.append(item);
  });

  const propagation = $("propagationList"); clear(propagation);
  if (!data.propagation?.length) empty(propagation, "No machine-dated propagation sequence was recovered.");
  else {
    const list = make("ol", "timeline");
    data.propagation.slice(0, 60).forEach(point => {
      const item = make("li");
      item.append(make("time", "", point.date.slice(0, 10)), sourceReference(point.sourceId), make("span", "badge", point.relationship.replaceAll("_", " ")));
      list.append(item);
    });
    propagation.append(list);
  }

  const gaps = $("gapsList"); clear(gaps);
  if (!data.coverageGaps?.length) empty(gaps, "No gap of 45 days or longer appears between recovered dated records.");
  else data.coverageGaps.forEach(gap => {
    const item = make("div", "gap-row");
    item.append(make("b", "", gap.days + " DAYS"), make("span", "", gap.from.slice(0, 10) + " → " + gap.to.slice(0, 10)));
    gaps.append(item);
  });
}
function renderPredictions(data) {
  const tests = $("predictionTests"); clear(tests);
  if (!data.tests?.length) empty(tests, "No falsifiable tests were generated.");
  else data.tests.forEach(record => {
    const item = make("div", "analysis-item");
    item.append(make("h4", "", record.test), make("p", "supports", "STRENGTHENS: " + record.wouldSupport), make("p", "weakens", "WEAKENS: " + record.wouldWeaken));
    tests.append(item);
  });
  const recovered = $("recoveredPredictions"); clear(recovered);
  if (!data.recoveredPredictions?.length) empty(recovered, "No explicit prediction was recovered from the retrieved passages.");
  else data.recoveredPredictions.forEach(record => {
    const item = make("div", "finding");
    item.append(make("p", "", record.prediction));
    const meta = make("div", "source-meta");
    meta.append(make("span", "badge", record.status.replaceAll("_", " ")), sourceReference(record.sourceId));
    item.append(meta); recovered.append(item);
  });
}
function renderIncentiveMentions(id, records, message) {
  const target = $(id); clear(target);
  if (!records?.length) return empty(target, message);
  records.forEach(record => {
    const item = make("div", "finding");
    item.append(make("p", "", record.passage), sourceReference(record.sourceId));
    target.append(item);
  });
}
function renderSources(records) {
  setText("sourceCount", records.length + " RECORD" + (records.length === 1 ? "" : "S"));
  const target = $("sourceIndex"); clear(target);
  if (!records.length) return empty(target, "No relevant source records were recovered.");
  const table = make("table", "source-table"), thead = make("thead"), header = make("tr");
  ["ID", "DATE", "SOURCE", "TYPE", "RELATION"].forEach(label => header.append(make("th", "", label)));
  thead.append(header);
  const tbody = make("tbody");
  records.forEach(source => {
    const row = make("tr");
    row.append(make("td", "", source.id), make("td", "", source.publishedAt?.slice(0, 10) || "—"));
    const sourceCell = make("td");
    sourceCell.append(sourceLink(source), make("small", "domain-line", source.domain || ""));
    row.append(sourceCell, make("td", "", source.kind?.replaceAll("_", " ") || "—"), make("td", "", source.relationship?.replaceAll("_", " ") || "—"));
    tbody.append(row);
  });
  table.append(thead, tbody); target.append(table);
}
function renderMethod(retrieval) {
  const providers = $("providerList"); clear(providers);
  retrieval.providers?.forEach(provider => {
    const row = make("div", "provider-row");
    row.append(make("b", "", provider.name), make("span", "", provider.recovered + " recovered"));
    if (provider.errors?.length) row.append(make("small", "provider-error", provider.errors.join(" · ")));
    providers.append(row);
  });
  renderTextList("limitationsList", retrieval.limitations, "No limitations were reported.");
}
function renderAnalysis(data) {
  sourceMap = new Map((data.sourceIndex || []).map(source => [source.id, source]));
  setText("activeClaim", data.claim);
  setText("assessmentStatus", data.assessment?.status?.replaceAll("_", " "));
  setText("interpretationHeadline", data.interpretation?.headline);
  const notes = $("interpretationNotes"); clear(notes);
  (data.interpretation?.observations || []).forEach(note => notes.append(make("li", "", note)));
  setText("coverageScore", (data.scores?.coverage ?? 0) + "/100");
  setText("independenceScore", (data.scores?.independence ?? 0) + "%");
  setText("contradictionScore", (data.scores?.contradiction ?? 0) + "%");
  setText("originScore", data.scores?.originClusters ?? 0);
  renderSourceCards("confirmingList", data.evidence?.confirming, "No explicit confirming evidence was recovered.");
  renderSourceCards("contradictingList", data.evidence?.contradicting, "No explicit contradiction was recovered.");
  renderSourceCards("hoaxesList", data.evidence?.knownHoaxes, "No indexed fact-check or known-hoax record was recovered.");
  renderSourceCards("repetitionsList", data.evidence?.repetitions, "No unsupported repetition was classified.");
  renderFindings(data.evidence?.knownFacts);
  renderTextList("missingList", data.evidence?.missingEvidence, "No missing-evidence condition was generated.");
  renderAssumptions(data.redTeam?.unsupportedAssumptions);
  renderAlternatives(data.redTeam?.competingExplanations);
  renderGenealogy(data.genealogy || {});
  renderPredictions(data.predictions || {});
  setText("incentiveQualification", data.incentives?.qualification);
  renderIncentiveMentions("benefitsList", data.incentives?.whoBenefits, "No retrieved source explicitly documents a beneficiary.");
  renderIncentiveMentions("losesList", data.incentives?.whoLoses, "No retrieved source explicitly documents a losing or burdened party.");
  renderSources(data.sourceIndex || []);
  renderMethod(data.retrieval || {});
  $("workspace").classList.remove("hidden");
}
async function endpoint() {
  const response = await fetch("analysis-config.json", {cache: "no-store"});
  if (!response.ok) throw new Error("CURTAIN could not load its analysis configuration.");
  const config = await response.json();
  if (!config.endpoint) throw new Error("CURTAIN's evidence endpoint is not configured.");
  const url = new URL(config.endpoint, location.href);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("The evidence endpoint must use HTTPS.");
  return url;
}

input.addEventListener("input", () => setText("count", input.value.length + " / 1200"));
form.addEventListener("submit", async event => {
  event.preventDefault();
  const claim = input.value.trim();
  if (!claim || pending) return;
  if (!sessionToken) sessionToken = window.prompt("Enter your CURTAIN access token:") || "";
  if (!sessionToken) return setText("runStatus", "Analysis cancelled. No search was sent.");
  pending = true; button.disabled = true; $("workspace").classList.add("hidden");
  setText("runStatus", "Searching evidence indexes, retrieving source pages, and tracing dependencies…");
  try {
    const url = await endpoint();
    const response = await fetch(url, {
      method: "POST",
      headers: {"Content-Type": "application/json", Authorization: "Bearer " + sessionToken},
      body: JSON.stringify({claim}),
      signal: AbortSignal.timeout(180000)
    });
    const data = await response.json().catch(() => { throw new Error("The evidence server returned an unreadable response."); });
    if (!response.ok) {
      if (response.status === 401) sessionToken = "";
      throw new Error(data.error || "Analysis failed (" + response.status + ").");
    }
    if (!data.engine || data.engine.generativeAI !== false) throw new Error("The response did not come from the configured CURTAIN evidence engine.");
    renderAnalysis(data);
    setText("runStatus", "Analysis complete · " + data.scores.sources + " relevant records · " + data.scores.domains + " domains · " + data.elapsedMs + " ms");
    $("workspace").scrollIntoView({behavior: "smooth", block: "start"});
  } catch (error) {
    const message = error.name === "TimeoutError" ? "The evidence search timed out. No partial result was presented."
      : error.message === "Failed to fetch" ? "CURTAIN could not reach the evidence server." : error.message;
    setText("runStatus", message);
  } finally { pending = false; button.disabled = false; }
});
$("resetBtn").addEventListener("click", () => {
  if (pending) return;
  $("workspace").classList.add("hidden"); input.value = "";
  setText("count", "0 / 1200"); setText("runStatus", ""); input.focus();
});
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(panel => panel.classList.remove("active"));
    tab.classList.add("active"); $(tab.dataset.tab).classList.add("active");
  });
});
