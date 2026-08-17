import { enrichWithKPI, resultCount } from "./kpi.js";
import { overlaps } from "./periods.js";

export const LEVELS = {
  projects: {
    idField: "projectId",
    nameMap: "projects",
    parentFields: [],
  },
  accounts: {
    idField: "accountId",
    nameMap: "accounts",
    parentFields: ["projectId"],
  },
  campaigns: {
    idField: "campaignId",
    nameMap: "campaigns",
    parentFields: ["projectId", "accountId"],
  },
  adsets: {
    idField: "adSetId",
    nameMap: "adSets",
    parentFields: ["projectId", "accountId", "campaignId"],
  },
  ads: {
    idField: "adId",
    nameMap: "ads",
    parentFields: ["projectId", "accountId", "campaignId", "adSetId"],
  },
};

export function filterInsightsByPeriod(insights, from, to) {
  return insights.filter((row) => {
    const rowFrom = row._period_from;
    const rowTo = row._period_to;
    if (!rowFrom || !rowTo) return false;
    return overlaps(rowFrom, rowTo, from, to);
  });
}

/**
 * Prefer exact period match, then fully contained chunks.
 * Do not use wider windows that extend outside the requested period —
 * that would inflate totals for partial ranges.
 */
export function selectInsightsForPeriod(insights, from, to) {
  const exact = insights.filter((row) => row._period_from === from && row._period_to === to);
  if (exact.length) return dedupeInsights(exact);

  const inside = insights.filter(
    (row) => row._period_from && row._period_to && row._period_from >= from && row._period_to <= to,
  );
  if (!inside.length) return [];

  return dropCoveredWideRows(dedupeInsights(inside));
}

function dedupeInsights(rows) {
  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const key = [
      row.projectId,
      row.accountId,
      row.campaignId,
      row.adSetId,
      row.adId,
      row._period_from,
      row._period_to,
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

function dropCoveredWideRows(rows) {
  const byWidth = [...rows].sort((a, b) => periodDays(a) - periodDays(b));
  const kept = [];
  const coveredDays = new Map(); // objectKey -> Set(days)

  for (const row of byWidth) {
    const objectKey = [row.projectId, row.accountId, row.campaignId, row.adSetId, row.adId].join("|");
    const days = enumerateDays(row._period_from, row._period_to);
    const already = coveredDays.get(objectKey) || new Set();
    const uncovered = days.filter((day) => !already.has(day));
    if (!uncovered.length) continue;
    kept.push(row);
    for (const day of days) already.add(day);
    coveredDays.set(objectKey, already);
  }

  return kept;
}

function periodDays(row) {
  const start = Date.parse(row._period_from);
  const end = Date.parse(row._period_to);
  return Math.round((end - start) / 86400000) + 1;
}

function enumerateDays(from, to) {
  const days = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function aggregateByLevel(insights, level, nameMaps = {}, filters = {}) {
  const config = LEVELS[level];
  if (!config) throw new Error(`Unknown level: ${level}`);

  const filtered = insights.filter((row) => matchesStructuralFilters(row, filters));
  const map = new Map();

  for (const row of filtered) {
    const id = row[config.idField];
    if (!id) continue;

    if (!map.has(id)) {
      const parents = {};
      for (const field of config.parentFields) parents[field] = row[field] || null;

      map.set(id, {
        id: String(id),
        name: resolveName(id, config.nameMap, nameMaps, row),
        ...parents,
        spend: 0,
        impressions: 0,
        clicks: 0,
        reach: 0,
        results: 0,
        leads: 0,
        qLeads: 0,
        sales: 0,
      });
    }

    const agg = map.get(id);
    agg.spend += Number(row.spend) || 0;
    agg.impressions += Number(row.impressions) || 0;
    agg.clicks += Number(row.clicks) || 0;
    agg.reach += Number(row.reach) || 0;
    agg.results += resultCount(row);
    agg.leads += Number(row.leads) || 0;
    agg.qLeads += Number(row.qLeads) || 0;
    agg.sales += Number(row.sales) || 0;
  }

  const rows = [...map.values()].map(enrichWithKPI);
  const totalSpend = rows.reduce((sum, row) => sum + row.spend, 0);
  const totalResults = rows.reduce((sum, row) => sum + row.results, 0);

  return rows
    .map((row) => ({
      ...row,
      budgetShare: totalSpend ? (row.spend / totalSpend) * 100 : null,
      resultsShare: totalResults ? (row.results / totalResults) * 100 : null,
    }))
    .sort((a, b) => b.spend - a.spend);
}

function resolveName(id, mapKey, nameMaps, row) {
  const fromMap = nameMaps?.[mapKey]?.[id];
  if (fromMap) return fromMap;
  if (mapKey === "projects" && row.projectId && nameMaps?.projects?.[row.projectId]) {
    return nameMaps.projects[row.projectId];
  }
  return String(id);
}

function matchesStructuralFilters(row, filters) {
  if (filters.projectId && String(row.projectId) !== String(filters.projectId)) return false;
  if (filters.accountId && String(row.accountId) !== String(filters.accountId)) return false;
  if (filters.campaignId && String(row.campaignId) !== String(filters.campaignId)) return false;
  if (filters.adSetId && String(row.adSetId) !== String(filters.adSetId)) return false;
  if (filters.adId && String(row.adId) !== String(filters.adId)) return false;
  return true;
}

export function summarize(rows) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.spend += row.spend || 0;
      acc.impressions += row.impressions || 0;
      acc.clicks += row.clicks || 0;
      acc.reach += row.reach || 0;
      acc.results += row.results || 0;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0 },
  );
  return enrichWithKPI(totals);
}
