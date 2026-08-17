import { Router } from "express";
import { entityForLevel, getMetricInsights, loadNameMaps } from "../db.js";
import { LEVELS, aggregateByLevel, selectInsightsForPeriod, summarize } from "../aggregate.js";
import { previousPeriod, pctChange } from "../periods.js";

const router = Router();

function parseFilters(query) {
  return {
    projectId: query.projectId || null,
    accountId: query.accountId || null,
    campaignId: query.campaignId || null,
    adSetId: query.adSetId || null,
    adId: query.adId || null,
  };
}

function buildDataset(level, from, to, filters) {
  const entity = entityForLevel(level);
  const insights = selectInsightsForPeriod(getMetricInsights(entity), from, to);
  const nameMaps = loadNameMaps();
  const data = aggregateByLevel(insights, level, nameMaps, filters);
  return { insights, nameMaps, data, totals: summarize(data), entity };
}

router.get("/", (req, res) => {
  const { level = "projects", from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "from and to required (YYYY-MM-DD)" });
  if (!LEVELS[level]) return res.status(400).json({ error: `Unknown level. Use: ${Object.keys(LEVELS).join(", ")}` });

  const filters = parseFilters(req.query);
  const { data, totals } = buildDataset(level, from, to, filters);

  res.json({
    level,
    from,
    to,
    count: data.length,
    totals,
    filters,
    data,
  });
});

router.get("/compare", (req, res) => {
  const { level = "projects", from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "from and to required" });
  if (!LEVELS[level]) return res.status(400).json({ error: "Unknown level" });

  const filters = parseFilters(req.query);
  const prev = previousPeriod(from, to);
  const current = buildDataset(level, from, to, filters);
  const previous = buildDataset(level, prev.from, prev.to, filters);

  const prevById = new Map(previous.data.map((row) => [row.id, row]));
  const metrics = ["spend", "reach", "impressions", "clicks", "results", "ctr", "cpc", "cpm", "cpr"];

  const data = current.data.map((row) => {
    const before = prevById.get(row.id) || null;
    const changes = {};
    for (const metric of metrics) {
      const currentValue = row[metric];
      const previousValue = before ? before[metric] : null;
      changes[metric] = {
        current: currentValue ?? null,
        previous: previousValue ?? null,
        changePct: pctChange(currentValue, previousValue),
      };
    }
    return {
      id: row.id,
      name: row.name,
      current: row,
      previous: before,
      changes,
    };
  });

  const totalsChanges = {};
  for (const metric of metrics) {
    totalsChanges[metric] = {
      current: current.totals[metric] ?? null,
      previous: previous.totals[metric] ?? null,
      changePct: pctChange(current.totals[metric], previous.totals[metric]),
    };
  }

  res.json({
    level,
    currentPeriod: { from, to },
    previousPeriod: prev,
    totals: totalsChanges,
    count: data.length,
    data,
  });
});

router.get("/options", (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "from and to required" });

  // Use the richest available level for filter option IDs.
  const ads = selectInsightsForPeriod(getMetricInsights("ads"), from, to);
  const campaigns = selectInsightsForPeriod(getMetricInsights("campaigns"), from, to);
  const projects = selectInsightsForPeriod(getMetricInsights("metrics"), from, to);
  const insights = ads.length ? ads : campaigns.length ? campaigns : projects;
  const nameMaps = loadNameMaps();

  const collect = (field, mapKey, parents = []) => {
    const map = new Map();
    for (const row of insights) {
      const id = row[field];
      if (!id) continue;
      if (!map.has(String(id))) {
        const item = {
          id: String(id),
          name: nameMaps[mapKey]?.[id] || String(id),
        };
        for (const parent of parents) item[parent] = row[parent] || null;
        map.set(String(id), item);
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  };

  res.json({
    from,
    to,
    projects: collect("projectId", "projects"),
    accounts: collect("accountId", "accounts", ["projectId"]),
    campaigns: collect("campaignId", "campaigns", ["projectId", "accountId"]),
    adsets: collect("adSetId", "adSets", ["projectId", "accountId", "campaignId"]),
    ads: collect("adId", "ads", ["projectId", "accountId", "campaignId", "adSetId"]),
  });
});

router.get("/periods", (_req, res) => {
  const entities = ["metrics", "campaigns", "adsets", "ads"];
  const set = new Set();
  for (const entity of entities) {
    for (const row of getMetricInsights(entity)) {
      if (row._period_from && row._period_to) set.add(`${row._period_from}|${row._period_to}`);
    }
  }
  const periods = [...set]
    .map((value) => {
      const [from, to] = value.split("|");
      return { from, to };
    })
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  res.json({ periods });
});

export { buildDataset, parseFilters };
export default router;
