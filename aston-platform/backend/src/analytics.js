export function findBest(rows) {
  const withShows = rows.filter((row) => row.impressions > 0 && row.ctr != null);
  const withClicks = rows.filter((row) => row.clicks > 0 && row.cpc != null);
  const withResults = rows.filter((row) => row.results > 0 && row.cpr != null);

  return {
    highestCTR: pickExtreme(withShows, "ctr", "max"),
    lowestCPC: pickExtreme(withClicks, "cpc", "min"),
    lowestCPR: pickExtreme(withResults, "cpr", "min"),
    mostResults: pickExtreme(rows.filter((row) => row.results > 0), "results", "max"),
    highestSpend: pickExtreme(rows.filter((row) => row.spend > 0), "spend", "max"),
  };
}

export function findWeak(rows) {
  const withShows = rows.filter((row) => row.impressions > 0 && row.ctr != null);
  const withClicks = rows.filter((row) => row.clicks > 0 && row.cpc != null);
  const withResults = rows.filter((row) => row.results > 0 && row.cpr != null);
  const spendNoResults = rows.filter((row) => row.spend > 0 && row.results === 0);

  return {
    lowestCTR: pickExtreme(withShows, "ctr", "min"),
    highestCPC: pickExtreme(withClicks, "cpc", "max"),
    highestCPR: pickExtreme(withResults, "cpr", "max"),
    spendNoResults,
  };
}

export function spendWithoutResults(rows) {
  return rows
    .filter((row) => row.spend > 0 && row.results === 0)
    .reduce((sum, row) => sum + row.spend, 0);
}

function pickExtreme(rows, field, mode) {
  if (!rows.length) return null;
  return rows.reduce((best, row) => {
    if (!best) return row;
    if (mode === "max") return row[field] > best[field] ? row : best;
    return row[field] < best[field] ? row : best;
  }, null);
}
