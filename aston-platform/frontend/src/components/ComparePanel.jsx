import { fmtChange, fmtMoney, fmtNumber, fmtPercent } from "../utils/format";

const METRICS = [
  { key: "spend", label: "Расход", fmt: fmtMoney, invert: true },
  { key: "reach", label: "Охват", fmt: fmtNumber },
  { key: "impressions", label: "Показы", fmt: fmtNumber },
  { key: "clicks", label: "Клики", fmt: fmtNumber },
  { key: "results", label: "Результаты", fmt: fmtNumber },
  { key: "ctr", label: "CTR", fmt: fmtPercent },
  { key: "cpc", label: "CPC", fmt: fmtMoney, invert: true },
  { key: "cpm", label: "CPM", fmt: fmtMoney, invert: true },
  { key: "cpr", label: "CPR", fmt: fmtMoney, invert: true },
];

export default function ComparePanel({ compare }) {
  if (!compare) return null;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Сравнение периодов</h2>
        <p className="muted">
          {compare.currentPeriod.from} → {compare.currentPeriod.to} vs{" "}
          {compare.previousPeriod.from} → {compare.previousPeriod.to}
        </p>
      </div>
      <div className="compare-grid">
        {METRICS.map((metric) => {
          const item = compare.totals?.[metric.key];
          if (!item) return null;
          const tone = toneFor(item.changePct, metric.invert);
          return (
            <article key={metric.key} className="compare-card">
              <h3>{metric.label}</h3>
              <p className="value">{metric.fmt(item.current)}</p>
              <p className="muted">было {metric.fmt(item.previous)}</p>
              <p className={`delta ${tone}`}>{fmtChange(item.changePct)}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function toneFor(changePct, invert) {
  if (changePct == null) return "";
  const good = invert ? changePct < 0 : changePct > 0;
  const bad = invert ? changePct > 0 : changePct < 0;
  if (good) return "good";
  if (bad) return "bad";
  return "";
}
