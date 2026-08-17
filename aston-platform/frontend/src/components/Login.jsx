import { login } from "../api";

export default function Login({ onSuccess }) {
  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await login(form.get("login"), form.get("password"));
      onSuccess();
    } catch (error) {
      alert(error.message || "Ошибка входа");
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <p className="eyebrow">Aston Platform</p>
        <h1>Вход</h1>
        <p className="muted">Аналитика рекламных данных AdWave</p>
        <label>
          Логин
          <input name="login" defaultValue="admin" autoComplete="username" required />
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            defaultValue="aston123"
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit">Войти</button>
      </form>
    </div>
  );
}
