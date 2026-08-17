import { fmtMoney, fmtNumber, fmtPercent } from "../utils/format";

const COLUMNS = [
  { key: "name", label: "Название", type: "text" },
  { key: "spend", label: "Расход", type: "money", fmt: fmtMoney },
  { key: "budgetShare", label: "Доля бюджета", type: "percent", fmt: fmtPercent },
  { key: "reach", label: "Охват", type: "number", fmt: fmtNumber },
  { key: "impressions", label: "Показы", type: "number", fmt: fmtNumber },
  { key: "clicks", label: "Клики", type: "number", fmt: fmtNumber },
  { key: "results", label: "Результаты", type: "number", fmt: fmtNumber },
  { key: "resultsShare", label: "Доля результатов", type: "percent", fmt: fmtPercent },
  { key: "ctr", label: "CTR", type: "percent", fmt: fmtPercent },
  { key: "cpc", label: "CPC", type: "money", fmt: fmtMoney },
  { key: "cpm", label: "CPM", type: "money", fmt: fmtMoney },
  { key: "cpr", label: "CPR", type: "money", fmt: fmtMoney },
];

export default function MetricsTable({ rows, sortKey, sortDir, onSort }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} onClick={() => onSort(column.key)}>
                {column.label}
                {sortKey === column.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length} className="empty">
                Нет данных за выбранный период / фильтры
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                {COLUMNS.map((column) => (
                  <td key={column.key}>
                    {column.fmt ? column.fmt(row[column.key]) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export { COLUMNS };
