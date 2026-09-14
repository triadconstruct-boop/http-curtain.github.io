import http from "node:http";
import {timingSafeEqual} from "node:crypto";
import {analyzeClaim} from "./analyzer.mjs";

const KNOWN_ORIGINS = new Set([
  "https://yyrv.net",
  "https://www.yyrv.net",
  "https://triadconstruct-boop.github.io"
]);

function allowedOrigins(env) {
  const configured = [env.CURTAIN_ORIGIN, env.CURTAIN_ORIGINS]
    .filter(Boolean).flatMap(value => value.split(",")).map(value => value.trim()).filter(Boolean);
  return new Set([...KNOWN_ORIGINS, ...configured]);
}

function authorized(header, secret) {
  if (!secret) return false;
  const actual = Buffer.from(header || "");
  const expected = Buffer.from("Bearer " + secret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function readJson(req, limit = 10_000) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > limit) throw Object.assign(new Error("Claim is too large."), {status: 413});
  }
  try { return JSON.parse(raw); }
  catch { throw Object.assign(new Error("Invalid request JSON."), {status: 400}); }
}

export function createServer(env = process.env, analyze = analyzeClaim) {
  let busy = false;
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin || "";
    const origins = allowedOrigins(env);
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "Origin"
    };
    if (origins.has(origin)) Object.assign(headers, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    const reply = (status, body) => {
      res.writeHead(status, headers);
      res.end(JSON.stringify(body));
    };

    if (req.method === "OPTIONS") {
      if (!origins.has(origin)) return reply(403, {error: "Origin not allowed."});
      res.writeHead(204, headers); return res.end();
    }
    if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
      return reply(200, {
        status: "ready",
        engine: "CURTAIN deterministic evidence engine",
        generativeAI: false,
        sources: ["GDELT", "Google News", "Crossref", "Wikipedia"]
      });
    }
    if (req.url !== "/analyze") return reply(404, {error: "Not found."});
    if (req.method !== "POST") return reply(405, {error: "Submit a claim using POST."});
    if (!origins.has(origin)) return reply(403, {error: "Origin not allowed."});
    if (!env.CURTAIN_ACCESS_TOKEN) return reply(503, {error: "CURTAIN access is not configured on the server."});
    if (!authorized(req.headers.authorization, env.CURTAIN_ACCESS_TOKEN)) return reply(401, {error: "Invalid CURTAIN access token."});
    if (busy) return reply(429, {error: "An analysis is already running. Wait for it to finish."});

    busy = true;
    try {
      const body = await readJson(req);
      if (typeof body.claim !== "string" || !body.claim.trim() || body.claim.length > 1200) {
        return reply(400, {error: "Enter a claim of 1–1200 characters."});
      }
      const analysis = await analyze(body.claim.trim());
      return reply(200, analysis);
    } catch (error) {
      const status = error.status || 502;
      return reply(status, {
        error: error.name === "TimeoutError"
          ? "One or more evidence indexes timed out. Submit again to start a new search."
          : (error.message || "The evidence pipeline failed.")
      });
    } finally {
      busy = false;
    }
  });
}

if (process.argv[1]?.endsWith("server.mjs")) {
  createServer().listen(Number(process.env.PORT || 8787), "0.0.0.0");
}
