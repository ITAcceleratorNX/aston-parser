import { fmtMoney, fmtPercent } from "../utils/format";

export default function AnalyticsPanel({ analytics, onShowSpendNoResults }) {
  if (!analytics) return null;

  const cards = [
    { title: "Лучший CTR", item: analytics.best?.highestCTR, value: (item) => fmtPercent(item.ctr) },
    { title: "Лучший CPC", item: analytics.best?.lowestCPC, value: (item) => fmtMoney(item.cpc) },
    { title: "Лучший CPR", item: analytics.best?.lowestCPR, value: (item) => fmtMoney(item.cpr) },
    {
      title: "Больше всего результатов",
      item: analytics.best?.mostResults,
      value: (item) => item.results,
    },
    {
      title: "Самый большой расход",
      item: analytics.best?.highestSpend,
      value: (item) => fmtMoney(item.spend),
    },
    { title: "Слабый CTR", item: analytics.weak?.lowestCTR, value: (item) => fmtPercent(item.ctr) },
    { title: "Слабый CPC", item: analytics.weak?.highestCPC, value: (item) => fmtMoney(item.cpc) },
    { title: "Слабый CPR", item: analytics.weak?.highestCPR, value: (item) => fmtMoney(item.cpr) },
  ];

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Аналитика эффективности</h2>
        <button type="button" className="ghost" onClick={onShowSpendNoResults}>
          Расход без результата: {fmtMoney(analytics.spendWithoutResults?.total)} (
          {analytics.spendWithoutResults?.count || 0})
        </button>
      </div>
      <div className="analytics-grid">
        {cards.map((card) => (
          <article key={card.title} className="analytics-card">
            <h3>{card.title}</h3>
            {card.item ? (
              <>
                <p className="value">{card.value(card.item)}</p>
                <p className="muted">{card.item.name}</p>
              </>
            ) : (
              <p className="muted">Нет данных</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
