import test from "node:test";
import assert from "node:assert/strict";
import {analyzeClaim, internals} from "./analyzer.mjs";
import {createServer} from "./server.mjs";

const html = (title, date, body, canonical, outbound = "") => `<!doctype html>
<html><head><title>${title}</title><meta property="og:title" content="${title}">
<meta property="article:published_time" content="${date}"><meta name="author" content="Test Reporter">
<link rel="canonical" href="${canonical}"></head><body><article><p>${body}</p>${outbound}</article></body></html>`;

function fixtureFetch(input) {
  const url = new URL(input);
  if (url.hostname === "api.gdeltproject.org") return Promise.resolve(Response.json({articles: [
    {title: "Orion bridge collapse was not caused by sabotage", url: "https://agency.gov/orion-report", domain: "agency.gov", seendate: "20240102T120000Z"},
    {title: "Orion bridge collapse caused by sabotage, anonymous post claims", url: "https://origin.example/orion-claim", domain: "origin.example", seendate: "20240101T120000Z"},
    {title: "Orion bridge collapse caused by sabotage, anonymous post claims", url: "https://copy.example/orion-claim", domain: "copy.example", seendate: "20240103T120000Z"},
    {title: "Fact check: Orion bridge sabotage claim is false", url: "https://factcheck.org/orion", domain: "factcheck.org", seendate: "20240104T120000Z"}
  ]}));
  if (url.hostname === "news.google.com") return Promise.resolve(new Response(`<rss><channel><item>
    <title>Orion bridge collapse caused by sabotage, anonymous post claims - Example News</title>
    <link>https://news.example/orion</link><pubDate>Fri, 05 Jan 2024 12:00:00 GMT</pubDate>
    <description>Report repeats Orion bridge sabotage claim.</description><source url="https://news.example">Example News</source>
  </item></channel></rss>`, {status: 200}));
  if (url.hostname === "api.crossref.org") return Promise.resolve(Response.json({message: {items: [{
    DOI: "10.0000/orion", title: ["Orion Bridge Collapse: Structural Failure Not Sabotage"],
    author: [{given: "A.", family: "Engineer"}], published: {"date-parts": [[2024, 1, 2]]},
    publisher: "Engineering Journal", URL: "https://doi.org/10.0000/orion",
    abstract: "The study found the Orion bridge collapse was caused by structural fatigue, not sabotage."
  }]}}));
  if (url.hostname === "en.wikipedia.org") return Promise.resolve(Response.json({query: {pages: {1: {
    title: "Orion bridge collapse", fullurl: "https://en.wikipedia.org/wiki/Orion_bridge_collapse",
    extract: "The Orion bridge collapse is the subject of a disputed sabotage claim."
  }}}}));
  const pages = {
    "agency.gov": html("Orion bridge collapse was not caused by sabotage", "2024-01-02", "Official records show the Orion bridge collapse was not caused by sabotage. Investigators documented structural fatigue.", "https://agency.gov/orion-report"),
    "origin.example": html("Orion bridge collapse caused by sabotage, anonymous post claims", "2024-01-01", "According to an anonymous post, the Orion bridge collapse was caused by sabotage. The claim predicts an arrest by 2025.", "https://origin.example/orion-claim"),
    "copy.example": html("Orion bridge collapse caused by sabotage, anonymous post claims", "2024-01-03", "According to an anonymous post, the Orion bridge collapse was caused by sabotage. The claim predicts an arrest by 2025.", "https://copy.example/orion-claim", '<a href="https://origin.example/orion-claim">original report</a>'),
    "factcheck.org": html("Fact check: Orion bridge sabotage claim is false", "2024-01-04", "The Orion bridge sabotage claim is false and unsupported by authenticated evidence.", "https://factcheck.org/orion"),
    "news.example": html("Orion bridge sabotage report", "2024-01-05", "According to the origin report, the Orion bridge collapse was caused by sabotage.", "https://news.example/orion", '<a href="https://origin.example/orion-claim">origin</a>'),
    "doi.org": html("Orion Bridge Collapse: Structural Failure Not Sabotage", "2024-01-02", "The study found the Orion bridge collapse was caused by structural fatigue, not sabotage.", "https://doi.org/10.0000/orion")
  };
  return Promise.resolve(new Response(pages[url.hostname] || "not found", {status: pages[url.hostname] ? 200 : 404}));
}

test("claim analysis produces structured adversarial evidence without a generated answer", async () => {
  const result = await analyzeClaim("The Orion bridge collapse was caused by sabotage.", {fetcher: fixtureFetch});
  assert.equal(result.engine.generativeAI, false);
  assert.equal("answer" in result, false);
  assert.ok(result.sourceIndex.length >= 5);
  assert.ok(result.evidence.contradicting.length >= 2);
  assert.ok(result.evidence.repetitions.length >= 1);
  assert.ok(result.evidence.knownHoaxes.length >= 1);
  assert.ok(result.genealogy.dependencies.some(edge => edge.basis === "DIRECT_LINK"));
  assert.ok(result.genealogy.clusters.length < result.sourceIndex.length);
  assert.match(result.genealogy.firstClaimant.qualification, /not proof of first-ever/i);
  assert.ok(result.redTeam.unsupportedAssumptions.some(item => item.name === "Causation"));
  assert.ok(result.predictions.tests.length >= 4);
  assert.equal(result.retrieval.providers.length, 4);
});

test("metadata parsing recovers authorship, date, canonical URL, and links", () => {
  const page = internals.parsePage(html("Test", "2024-02-03", "Records show the event occurred.", "https://example.org/canonical", '<a href="https://source.example/item">source</a>'), "https://example.org/page");
  assert.equal(page.title, "Test");
  assert.equal(page.author, "Test Reporter");
  assert.equal(page.publishedAt.slice(0, 10), "2024-02-03");
  assert.equal(page.canonicalUrl, "https://example.org/canonical");
  assert.deepEqual(page.outbound, ["https://source.example/item"]);
});

test("server requires the access token and returns structured engine output", async () => {
  let calls = 0;
  const server = createServer({CURTAIN_ACCESS_TOKEN: "test-secret"}, async claim => {
    calls++;
    return {engine: {name: "CURTAIN deterministic evidence engine", generativeAI: false}, claim};
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const request = (token) => fetch(base + "/analyze", {
    method: "POST",
    headers: {Origin: "https://yyrv.net", Authorization: "Bearer " + token, "Content-Type": "application/json"},
    body: JSON.stringify({claim: "Test claim"})
  });
  assert.equal((await request("wrong")).status, 401);
  assert.equal(calls, 0);
  const response = await request("test-secret");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).engine.generativeAI, false);
  assert.equal(calls, 1);
  await new Promise(resolve => server.close(resolve));
});
