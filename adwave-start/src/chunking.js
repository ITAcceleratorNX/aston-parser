function toIso(value) {
  if (value instanceof Date) {
    return formatLocal(value);
  }
  return String(value).slice(0, 10);
}

function formatLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromIso(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function parseDate(value) {
  return toIso(value);
}

export function addDays(iso, days) {
  const date = fromIso(parseDate(iso));
  date.setDate(date.getDate() + days);
  return formatLocal(date);
}

export function diffDays(from, to) {
  return Math.round((fromIso(parseDate(to)) - fromIso(parseDate(from))) / 86400000);
}

export function todayIso() {
  return formatLocal(new Date());
}

export function iterChunks(dateFrom, dateTo, chunkDays) {
  let start = parseDate(dateFrom);
  const end = parseDate(dateTo);
  if (end < start) throw new Error("date_to must be >= date_from");
  const size = Math.max(1, Number(chunkDays));
  const chunks = [];
  let cursor = start;
  while (cursor <= end) {
    const chunkEnd = addDays(cursor, size - 1) < end ? addDays(cursor, size - 1) : end;
    chunks.push([cursor, chunkEnd]);
    cursor = addDays(chunkEnd, 1);
  }
  return chunks;
}

export function splitChunk([start, end]) {
  if (start === end) return [[start, end]];
  const mid = addDays(start, Math.floor(diffDays(start, end) / 2));
  return [
    [start, mid],
    [addDays(mid, 1), end],
  ];
}

export function defaultPeriod(days, end = null) {
  const finish = end ? parseDate(end) : todayIso();
  const start = addDays(finish, -Math.max(0, days - 1));
  return [start, finish];
}

export function formatChunk([from, to]) {
  return { from, to };
}
