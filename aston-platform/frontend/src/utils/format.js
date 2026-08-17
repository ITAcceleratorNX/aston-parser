export function fmtMoney(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtPercent(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Number(value).toFixed(2)}%`;
}

export function fmtNumber(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toLocaleString("ru-RU");
}

export function fmtChange(value) {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Number(value).toFixed(1)}%`;
}

export function exportCsv(rows, columns, filename) {
  const header = columns.map((column) => column.label).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((column) => {
          const raw = row[column.key];
          const value = raw == null ? "" : String(raw);
          return `"${value.replaceAll('"', '""')}"`;
        })
        .join(","),
    )
    .join("\n");

  const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
