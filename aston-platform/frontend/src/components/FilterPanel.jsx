export default function FilterPanel({
  filters,
  options,
  numericFilters,
  onStructuralChange,
  onNumericChange,
  onReset,
}) {
  const campaigns = (options.campaigns || []).filter(
    (item) => !filters.projectId || item.projectId === filters.projectId,
  );
  const adsets = (options.adsets || []).filter((item) => {
    if (filters.projectId && item.projectId !== filters.projectId) return false;
    if (filters.campaignId && item.campaignId !== filters.campaignId) return false;
    return true;
  });
  const ads = (options.ads || []).filter((item) => {
    if (filters.projectId && item.projectId !== filters.projectId) return false;
    if (filters.campaignId && item.campaignId !== filters.campaignId) return false;
    if (filters.adSetId && item.adSetId !== filters.adSetId) return false;
    return true;
  });
  const accounts = (options.accounts || []).filter(
    (item) => !filters.projectId || item.projectId === filters.projectId,
  );

  return (
    <div className="filter-panel">
      <div className="filter-row">
        <Select
          label="Проект"
          value={filters.projectId || ""}
          onChange={(value) =>
            onStructuralChange({
              ...filters,
              projectId: value || null,
              accountId: null,
              campaignId: null,
              adSetId: null,
              adId: null,
            })
          }
          items={options.projects || []}
        />
        <Select
          label="Кабинет"
          value={filters.accountId || ""}
          onChange={(value) =>
            onStructuralChange({
              ...filters,
              accountId: value || null,
              campaignId: null,
              adSetId: null,
              adId: null,
            })
          }
          items={accounts}
        />
        <Select
          label="Кампания"
          value={filters.campaignId || ""}
          onChange={(value) =>
            onStructuralChange({
              ...filters,
              campaignId: value || null,
              adSetId: null,
              adId: null,
            })
          }
          items={campaigns}
        />
        <Select
          label="Группа"
          value={filters.adSetId || ""}
          onChange={(value) =>
            onStructuralChange({
              ...filters,
              adSetId: value || null,
              adId: null,
            })
          }
          items={adsets}
        />
        <Select
          label="Объявление"
          value={filters.adId || ""}
          onChange={(value) => onStructuralChange({ ...filters, adId: value || null })}
          items={ads}
        />
      </div>

      <div className="filter-row">
        <NumberFilter
          label="Расход от"
          value={numericFilters.spendMin}
          onChange={(value) => onNumericChange({ ...numericFilters, spendMin: value })}
        />
        <NumberFilter
          label="Расход до"
          value={numericFilters.spendMax}
          onChange={(value) => onNumericChange({ ...numericFilters, spendMax: value })}
        />
        <NumberFilter
          label="CTR от %"
          value={numericFilters.ctrMin}
          onChange={(value) => onNumericChange({ ...numericFilters, ctrMin: value })}
        />
        <NumberFilter
          label="CTR до %"
          value={numericFilters.ctrMax}
          onChange={(value) => onNumericChange({ ...numericFilters, ctrMax: value })}
        />
        <NumberFilter
          label="CPC от"
          value={numericFilters.cpcMin}
          onChange={(value) => onNumericChange({ ...numericFilters, cpcMin: value })}
        />
        <NumberFilter
          label="CPC до"
          value={numericFilters.cpcMax}
          onChange={(value) => onNumericChange({ ...numericFilters, cpcMax: value })}
        />
        <NumberFilter
          label="CPR от"
          value={numericFilters.cprMin}
          onChange={(value) => onNumericChange({ ...numericFilters, cprMin: value })}
        />
        <NumberFilter
          label="CPR до"
          value={numericFilters.cprMax}
          onChange={(value) => onNumericChange({ ...numericFilters, cprMax: value })}
        />
        <NumberFilter
          label="Результаты от"
          value={numericFilters.resultsMin}
          onChange={(value) => onNumericChange({ ...numericFilters, resultsMin: value })}
        />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(numericFilters.spendNoResults)}
            onChange={(event) =>
              onNumericChange({ ...numericFilters, spendNoResults: event.target.checked })
            }
          />
          Расход без результата
        </label>
        <button type="button" className="ghost" onClick={onReset}>
          Сбросить фильтры
        </button>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, items }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Все</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberFilter({ label, value, onChange }) {
  return (
    <label>
      {label}
      <input
        type="number"
        step="any"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
