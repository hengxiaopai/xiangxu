import { Surface } from "@xiangxu/ui";

export default function TodayShellPage() {
  return (
    <div className="shell" data-shell="today">
      <header>
        <p>向序 XIANGXU</p>
        <nav aria-label="Shell navigation">
          <a aria-current="page" href="/app/today">
            Today shell
          </a>
          <a href="/login">Login shell</a>
        </nav>
      </header>
      <main>
        <h1>Today</h1>
        <Surface aria-labelledby="shell-status" tone="subtle">
          <h2 id="shell-status">Shell / Placeholder</h2>
          <p>No business data or workflow is implemented.</p>
        </Surface>
      </main>
    </div>
  );
}
