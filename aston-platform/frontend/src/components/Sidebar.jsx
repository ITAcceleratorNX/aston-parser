const SECTIONS = [
  { id: "overview", label: "Обзор", group: "main" },
  { id: "table", label: "Таблица", group: "main" },
  { id: "compare", label: "Сравнение", group: "main" },
  { id: "analytics", label: "Аналитика", group: "main" },
];

const LEVELS = [
  { id: "projects", label: "Проекты" },
  { id: "accounts", label: "Кабинеты" },
  { id: "campaigns", label: "Кампании" },
  { id: "adsets", label: "Группы" },
  { id: "ads", label: "Объявления" },
];

export default function Sidebar({
  section,
  onSectionChange,
  level,
  onLevelChange,
  onLogout,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">A</span>
        <div>
          <strong>Aston</strong>
          <p>AdWave Analytics</p>
        </div>
      </div>

      <div className="sidebar-scroll">
        <nav className="sidebar-nav" aria-label="Разделы">
          <p className="sidebar-label">Разделы</p>
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-link ${section === item.id ? "active" : ""}`}
              onClick={() => onSectionChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <nav className="sidebar-nav" aria-label="Уровни">
          <p className="sidebar-label">Уровни данных</p>
          {LEVELS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-link ${level === item.id ? "active" : ""}`}
              onClick={() => onLevelChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-logout" onClick={onLogout}>
          Выйти
        </button>
      </div>
    </aside>
  );
}

export { SECTIONS, LEVELS };
