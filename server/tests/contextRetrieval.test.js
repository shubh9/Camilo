/**
 * Context Retrieval Test
 *
 * Runs 2-3 targeted queries through getRelevantContext and shows:
 *  - How many segments are pulled per category
 *  - Full score distribution with content previews
 *  - Where the threshold is cutting off
 *
 * Usage:
 *   npm test                          # run default queries
 *   npm run test:verbose              # include content previews
 *   node tests/contextRetrieval.test.js --query "what happened at XAI"
 *   node tests/contextRetrieval.test.js --threshold 0.20   # override threshold
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

// ─── Queries to test (2-3 is plenty — pick ones that cover different topics) ──
const DEFAULT_QUERIES = [
  "what's going on with XAI?",      // tests recency / contradiction handling
  "where have you worked?",          // tests career history coverage
  "what are you building right now?", // tests current projects
];

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const VERBOSE      = args.includes("--verbose");
const CUSTOM_QUERY = argValue(args, "--query");
const THRESHOLD_OVERRIDE = argValue(args, "--threshold");

function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : null;
}

// Optionally override threshold at runtime without editing source
if (THRESHOLD_OVERRIDE) {
  process.env.TEST_THRESHOLD_OVERRIDE = THRESHOLD_OVERRIDE;
}

// ─── Load service AFTER potentially setting override ─────────────────────────
const aiService = require("../services/aiService");

// ─── Helpers ─────────────────────────────────────────────────────────────────
const W = 72;
const divider  = (c = "─") => console.log(c.repeat(W));
const pct      = (n)        => `${(n * 100).toFixed(1)}%`;
const preview  = (text, n = 110) => {
  if (!text) return "(empty)";
  const flat = String(text).replace(/\s+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n) + "…" : flat;
};

function scoreBar(score, width = 20) {
  const filled = Math.round(score * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function getContent(item, type) {
  if (type === "question")     return `Q: ${item.question}  →  A: ${preview(item.answer, 80)}`;
  if (type === "conversation") {
    const msgs = item.content?.conversation ?? [];
    return preview(msgs.map(m => `${m.isAI ? "Shubh" : "User"}: ${m.content}`).join(" | "));
  }
  return preview(item.content);
}

function printCategory(label, items, type) {
  if (items.length === 0) {
    console.log(`\n  ${label}: 0 results`);
    return;
  }

  const scores = items.map(i => i.similarity);
  const avg    = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min    = Math.min(...scores);
  const max    = Math.max(...scores);

  console.log(`\n  ${label}: ${items.length} results  |  avg ${pct(avg)}  |  range [${pct(min)} – ${pct(max)}]`);

  // Score distribution buckets: 25–30, 30–35, 35–40, 40–45, 45–50, 50%+
  const buckets = [0.50, 0.45, 0.40, 0.35, 0.30, 0.25];
  const labels  = ["50%+", "45–50", "40–45", "35–40", "30–35", "25–30"];
  const counts  = buckets.map((floor, i) => {
    const ceiling = i === 0 ? Infinity : buckets[i - 1];
    return items.filter(x => x.similarity >= floor && x.similarity < ceiling).length;
  });
  const distStr = labels.map((l, i) => `${l}: ${counts[i]}`).join("  |  ");
  console.log(`  Distribution  →  ${distStr}`);

  if (VERBOSE) {
    console.log();
    items.forEach((item, idx) => {
      const bar = scoreBar(item.similarity);
      console.log(`    [${String(idx + 1).padStart(2)}] ${pct(item.similarity)} ${bar}  ${getContent(item, type)}`);
    });
  }
}

// ─── Core test runner ────────────────────────────────────────────────────────
async function runQuery(query) {
  const messages = [{ content: query, isAI: false }];
  const t0 = Date.now();

  let ctx;
  try {
    ctx = await aiService.getRelevantContext(messages);
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    return null;
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  const { blogSegments, similarQuestions, similarConversations } = ctx;
  const total = blogSegments.length + similarQuestions.length + similarConversations.length;

  divider();
  console.log(`Query  : "${query}"`);
  console.log(`Time   : ${elapsed}s   |   Total pulled: ${total}  (${blogSegments.length} blog, ${similarQuestions.length} Q&A, ${similarConversations.length} conv)`);

  printCategory("Blog Segments",  blogSegments,       "segment");
  printCategory("Q&As",           similarQuestions,   "question");
  printCategory("Conversations",  similarConversations, "conversation");

  return { query, total, elapsed, blogSegments, similarQuestions, similarConversations };
}

function printSummary(results) {
  const valid = results.filter(Boolean);
  divider("═");
  console.log("SUMMARY");
  divider("═");

  valid.forEach(r => {
    const bar  = "█".repeat(Math.min(Math.round(r.total / 2), 35));
    const note = r.total >= 45 ? " ← lots of content" : r.total <= 5 ? " ← very sparse" : "";
    console.log(`  ${String(r.total).padStart(3)}  ${bar.padEnd(35)} "${r.query}"${note}`);
  });

  const totals = valid.map(r => r.total);
  const avg    = totals.reduce((a, b) => a + b, 0) / totals.length;
  console.log();
  console.log(`  Avg pull: ${avg.toFixed(0)} segments`);

  const currentThreshold = process.env.TEST_THRESHOLD_OVERRIDE ?? "0.25 (default)";
  console.log(`  Threshold tested: ${currentThreshold}`);
  divider("═");
  console.log();
}

// ─── Entry ────────────────────────────────────────────────────────────────────
(async () => {
  const queries = CUSTOM_QUERY ? [CUSTOM_QUERY] : DEFAULT_QUERIES;
  const thresholdNote = THRESHOLD_OVERRIDE ? ` (threshold override: ${THRESHOLD_OVERRIDE})` : "";

  console.log(`\nContext Retrieval Test${thresholdNote}`);
  console.log(`${queries.length} quer${queries.length === 1 ? "y" : "ies"}${VERBOSE ? "  [verbose]" : "  [use --verbose to see content]"}\n`);

  const results = [];
  for (const q of queries) {
    results.push(await runQuery(q));
  }

  printSummary(results);
})();
