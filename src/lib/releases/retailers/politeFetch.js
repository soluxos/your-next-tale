// One careful way to read retailer pages: an honest user agent, one request
// at a time per site with a gap between them, and only the paths each site's
// robots.txt leaves open. We never try to get past a bot check; a blocked
// page is reported as blocked.
//
// Server only.

export const USER_AGENT = "YourNextTale/1.0 (+https://yournexttale.com; new-release listings)";

// Paths we read, checked against each robots.txt (Nov 2026). Waterstones
// disallows */sort/, */facet/, */format/, /search and /page/; Bookshop
// disallows /search and account pages. Nothing here touches those.
// Barnes & Noble isn't here: its site answers automated requests with a bot
// check, so the only fair way in is a product feed from its affiliate scheme.
const ALLOWED = {
  "www.waterstones.com": [/^\/category\/[a-z0-9/-]+$/, /^\/campaign\/[a-z0-9-]+$/, /^\/book\/(?:[^/]+\/){2,5}\d{13}$/],
  "bookshop.org": [/^\/lists\/[a-z0-9-]+$/],
  "openlibrary.org": [/^\/isbn\/\d{13}\.json$/, /^\/search\.json$/]
};

// Seconds between requests to one site. The shops get a slow pace: a weekly
// run reads a handful of list pages and a few new books' pages, nothing more.
const GAP_MS = { "www.waterstones.com": 5000, "bookshop.org": 3000 };
const DEFAULT_GAP_MS = 800;
const nextSlot = new Map();

async function waitTurn(host) {
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(host) || 0);
  nextSlot.set(host, at + (GAP_MS[host] ?? DEFAULT_GAP_MS));
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

export class BlockedError extends Error {}

/**
 * GETs a page and returns its text, or null for a 404. Throws BlockedError
 * when the site answers with a bot check or "too many requests": callers stop
 * asking that site for the rest of the run, and say so.
 */
export async function politeFetch(url, { accept = "text/html" } = {}) {
  const u = new URL(url);
  const rules = ALLOWED[u.host];
  if (!rules?.some((re) => re.test(u.pathname))) throw new Error(`Not on the allowed list: ${u.host}${u.pathname}`);

  for (let attempt = 0; attempt < 2; attempt++) {
    await waitTurn(u.host);
    let res;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: accept },
        redirect: "follow",
        signal: AbortSignal.timeout(20000)
      });
    } catch (e) {
      if (attempt) throw e;
      continue;
    }
    if (res.status === 404) return null;
    if (res.status === 403 || res.status === 429 || res.headers.get("cf-mitigated")) {
      throw new BlockedError(`${u.host} answered with a bot check (${res.status})`);
    }
    if (res.status >= 500 && !attempt) continue;
    if (!res.ok) throw new Error(`${u.host} answered ${res.status}`);
    return res.text();
  }
  return null;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", mdash: "—", ndash: "–", hellip: "…" };

/** Tags stripped, entities decoded, whitespace collapsed. */
export function htmlText(s) {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/** Every JSON-LD block on a page, flattened ( @graph included ). */
export function jsonLd(html) {
  const out = [];
  for (const m of String(html).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]);
      for (const node of [data].flat()) {
        if (node?.["@graph"]) out.push(...node["@graph"]);
        else if (node) out.push(node);
      }
    } catch {
      // A broken block on someone else's page isn't our problem.
    }
  }
  return out;
}

export const hasType = (node, type) => [node?.["@type"]].flat().includes(type);
