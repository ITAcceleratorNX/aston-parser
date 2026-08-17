import { useEffect, useMemo, useState } from "react";
import {
  fetchAnalytics,
  fetchCompare,
  fetchMetrics,
  fetchOptions,
  fetchPeriods,
  isAuthed,
  logout,
} from "./api";
import Login from "./components/Login";
import Sidebar, { LEVELS } from "./components/Sidebar";
import PeriodPicker from "./components/PeriodPicker";
import FilterPanel from "./components/FilterPanel";
import MetricsTable, { COLUMNS } from "./components/MetricsTable";
import ComparePanel from "./components/ComparePanel";
import AnalyticsPanel from "./components/AnalyticsPanel";
import { exportCsv, fmtMoney, fmtNumber, fmtPercent } from "./utils/format";
import "./App.css";

const EMPTY_STRUCT = {
  projectId: null,
  accountId: null,
  campaignId: null,
  adSetId: null,
  adId: null,
};

const EMPTY_NUMERIC = {
  spendMin: "",
  spendMax: "",
  ctrMin: "",
  ctrMax: "",
  cpcMin: "",
  cpcMax: "",
  cprMin: "",
  cprMax: "",
  resultsMin: "",
  spendNoResults: false,
};

const SECTION_TITLES = {
  overview: "Обзор показателей",
  table: "Таблица данных",
  compare: "Сравнение периодов",
  analytics: "Аналитика эффективности",
};

export default function App() {
  const [authed, setAuthed] = useState(isAuthed());
  const [section, setSection] = useState("overview");
  const [level, setLevel] = useState("projects");
  const [from, setFrom] = useState("2026-08-06");
  const [to, setTo] = useState("2026-08-12");
  const [periods, setPeriods] = useState([]);
  const [options, setOptions] = useState({});
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [compare, setCompare] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [filters, setFilters] = useState(EMPTY_STRUCT);
  const [numericFilters, setNumericFilters] = useState(EMPTY_NUMERIC);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("spend");
  const [sortDir, setSortDir] = useState("desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authed) return;
    fetchPeriods()
      .then((res) => {
        setPeriods(res.periods || []);
        if (res.periods?.length) {
          const last = res.periods[res.periods.length - 1];
          setFrom(last.from);
          setTo(last.to);
        }
      })
      .catch((err) => setError(err.message));
  }, [authed]);

  useEffect(() => {
    if (!authed || !from || !to) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = { level, from, to, ...filters };
        const [metrics, compareRes, analyticsRes, optionsRes] = await Promise.all([
          fetchMetrics(params),
          fetchCompare(params),
          fetchAnalytics(params),
          fetchOptions({ from, to }),
        ]);
        if (cancelled) return;
        setRows(metrics.data || []);
        setTotals(metrics.totals || null);
        setCompare(compareRes);
        setAnalytics(analyticsRes);
        setOptions(optionsRes);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          if (err.message === "Unauthorized") setAuthed(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [authed, level, from, to, filters]);

  const filteredRows = useMemo(() => {
    let next = rows.filter((row) =>
      (row.name || "").toLowerCase().includes(search.toLowerCase()),
    );

    next = next.filter((row) => matchesNumeric(row, numericFilters));

    next = [...next].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" || typeof bv === "string") {
        return sortDir === "asc"
          ? String(av || "").localeCompare(String(bv || ""), "ru")
          : String(bv || "").localeCompare(String(av || ""), "ru");
      }
      const left = av == null ? Number.NEGATIVE_INFINITY : av;
      const right = bv == null ? Number.NEGATIVE_INFINITY : bv;
      return sortDir === "asc" ? left - right : right - left;
    });

    return next;
  }, [rows, search, numericFilters, sortKey, sortDir]);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function handleExport() {
    exportCsv(filteredRows, COLUMNS, `aston_${level}_${from}_${to}.csv`);
  }

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  const levelLabel = LEVELS.find((item) => item.id === level)?.label || level;

  return (
    <div className="shell">
      <Sidebar
        section={section}
        onSectionChange={setSection}
        level={level}
        onLevelChange={setLevel}
        onLogout={() => {
          logout();
          setAuthed(false);
        }}
      />

      <div className="main">
        <header className="main-header">
          <div>
            <p className="eyebrow">Aston × AdWave</p>
            <h1>{SECTION_TITLES[section]}</h1>
            <p className="muted">
              Уровень: {levelLabel} · {from} → {to}
            </p>
          </div>
          <div className="header-actions">
            <PeriodPicker
              from={from}
              to={to}
              availablePeriods={periods}
              onChange={({ from: nextFrom, to: nextTo }) => {
                setFrom(nextFrom);
                setTo(nextTo);
              }}
            />
          </div>
        </header>

        <div className="main-toolbar">
          <input
            className="search"
            placeholder="Поиск по названию..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="button" onClick={handleExport}>
            Экспорт CSV
          </button>
        </div>

        <FilterPanel
          filters={filters}
          options={options}
          numericFilters={numericFilters}
          onStructuralChange={setFilters}
          onNumericChange={setNumericFilters}
          onReset={() => {
            setFilters(EMPTY_STRUCT);
            setNumericFilters(EMPTY_NUMERIC);
            setSearch("");
          }}
        />

        {error && <div className="error">{error}</div>}
        {loading && <div className="muted loading-line">Загрузка...</div>}

        {section === "overview" && totals && (
          <section className="panel">
            <div className="panel-head">
              <h2>Сводка за период</h2>
            </div>
            <div className="totals">
              <article className="stat-card">
                <span>Расход</span>
                <strong>{fmtMoney(totals.spend)}</strong>
              </article>
              <article className="stat-card">
                <span>Показы</span>
                <strong>{fmtNumber(totals.impressions)}</strong>
              </article>
              <article className="stat-card">
                <span>Клики</span>
                <strong>{fmtNumber(totals.clicks)}</strong>
              </article>
              <article className="stat-card">
                <span>Результаты</span>
                <strong>{fmtNumber(totals.results)}</strong>
              </article>
              <article className="stat-card">
                <span>CTR</span>
                <strong>{fmtPercent(totals.ctr)}</strong>
              </article>
              <article className="stat-card">
                <span>CPC</span>
                <strong>{fmtMoney(totals.cpc)}</strong>
              </article>
              <article className="stat-card">
                <span>CPM</span>
                <strong>{fmtMoney(totals.cpm)}</strong>
              </article>
              <article className="stat-card">
                <span>CPR</span>
                <strong>{fmtMoney(totals.cpr)}</strong>
              </article>
            </div>
          </section>
        )}

        {section === "table" && (
          <section className="panel">
            <div className="panel-head">
              <h2>
                {levelLabel} · {filteredRows.length} объектов
              </h2>
            </div>
            <MetricsTable
              rows={filteredRows}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </section>
        )}

        {section === "compare" && <ComparePanel compare={compare} />}

        {section === "analytics" && (
          <AnalyticsPanel
            analytics={analytics}
            onShowSpendNoResults={() => {
              setNumericFilters((prev) => ({ ...prev, spendNoResults: true }));
              setSection("table");
            }}
          />
        )}
      </div>
    </div>
  );
}

function matchesNumeric(row, filters) {
  if (filters.spendMin !== "" && row.spend < Number(filters.spendMin)) return false;
  if (filters.spendMax !== "" && row.spend > Number(filters.spendMax)) return false;
  if (filters.ctrMin !== "" && (row.ctr == null || row.ctr < Number(filters.ctrMin))) return false;
  if (filters.ctrMax !== "" && (row.ctr == null || row.ctr > Number(filters.ctrMax))) return false;
  if (filters.cpcMin !== "" && (row.cpc == null || row.cpc < Number(filters.cpcMin))) return false;
  if (filters.cpcMax !== "" && (row.cpc == null || row.cpc > Number(filters.cpcMax))) return false;
  if (filters.cprMin !== "" && (row.cpr == null || row.cpr < Number(filters.cprMin))) return false;
  if (filters.cprMax !== "" && (row.cpr == null || row.cpr > Number(filters.cprMax))) return false;
  if (filters.resultsMin !== "" && row.results < Number(filters.resultsMin)) return false;
  if (filters.spendNoResults && !(row.spend > 0 && row.results === 0)) return false;
  return true;
}
