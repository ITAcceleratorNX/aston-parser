export function previousPeriod(from, to) {
  const start = parseUtcDate(from);
  const end = parseUtcDate(to);
  const days = Math.round((end - start) / 86400000) + 1;

  const prevEnd = new Date(start);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);

  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - days + 1);

  return {
    from: toIsoDate(prevStart),
    to: toIsoDate(prevEnd),
    days,
  };
}

export function pctChange(current, previous) {
  if (previous == null || previous === 0 || current == null) return null;
  return ((current - previous) / previous) * 100;
}

export function daysBetween(from, to) {
  const start = parseUtcDate(from);
  const end = parseUtcDate(to);
  return Math.round((end - start) / 86400000) + 1;
}

export function overlaps(aFrom, aTo, bFrom, bTo) {
  return aFrom <= bTo && aTo >= bFrom;
}

function parseUtcDate(value) {
  const [y, m, d] = String(value).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}
