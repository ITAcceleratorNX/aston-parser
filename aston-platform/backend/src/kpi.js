export function calcCTR(clicks, impressions) {
  if (!impressions) return null;
  return (clicks / impressions) * 100;
}

export function calcCPC(spend, clicks) {
  if (!clicks) return null;
  return spend / clicks;
}

export function calcCPM(spend, impressions) {
  if (!impressions) return null;
  return (spend / impressions) * 1000;
}

export function calcCPR(spend, results) {
  if (!results) return null;
  return spend / results;
}

export function resultCount(row) {
  if (row == null) return 0;
  if (typeof row.result === "number" && Number.isFinite(row.result)) return row.result;
  if (typeof row.results === "number" && Number.isFinite(row.results)) return row.results;
  if (row.results && typeof row.results === "object") {
    return Object.values(row.results).reduce((sum, value) => sum + (Number(value) || 0), 0);
  }
  return Number(row.leads) || 0;
}

export function enrichWithKPI(row) {
  const spend = Number(row.spend) || 0;
  const clicks = Number(row.clicks) || 0;
  const impressions = Number(row.impressions) || 0;
  const reach = Number(row.reach) || 0;
  const results = Number(row.results) || 0;

  return {
    ...row,
    spend,
    clicks,
    impressions,
    reach,
    results,
    ctr: calcCTR(clicks, impressions),
    cpc: calcCPC(spend, clicks),
    cpm: calcCPM(spend, impressions),
    cpr: calcCPR(spend, results),
  };
}

export function roundKPI(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
}
