export default function PeriodPicker({ from, to, onChange, availablePeriods = [] }) {
  return (
    <div className="period-picker">
      <label>
        С
        <input
          type="date"
          value={from}
          onChange={(event) => onChange({ from: event.target.value, to })}
        />
      </label>
      <label>
        По
        <input
          type="date"
          value={to}
          onChange={(event) => onChange({ from, to: event.target.value })}
        />
      </label>
      {availablePeriods.length > 0 && (
        <label>
          Быстрый выбор
          <select
            value={`${from}|${to}`}
            onChange={(event) => {
              const [nextFrom, nextTo] = event.target.value.split("|");
              if (nextFrom && nextTo) onChange({ from: nextFrom, to: nextTo });
            }}
          >
            <option value={`${from}|${to}`}>Текущий: {from} → {to}</option>
            {availablePeriods.map((period) => (
              <option key={`${period.from}|${period.to}`} value={`${period.from}|${period.to}`}>
                {period.from} → {period.to}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
