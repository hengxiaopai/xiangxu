import { Button, Surface } from "@xiangxu/ui";

export default function LoginShellPage() {
  return (
    <main className="shell" data-shell="login">
      <Surface aria-labelledby="login-shell-title" size="major">
        <div className="shell__stack">
          <p className="shell__brand">向序 XIANGXU</p>
          <h1 id="login-shell-title">登录</h1>
          <p>Shell / Placeholder</p>
          <p>Authentication is not implemented.</p>
          <Button disabled type="button">
            认证尚未启用
          </Button>
        </div>
      </Surface>
    </main>
  );
}
