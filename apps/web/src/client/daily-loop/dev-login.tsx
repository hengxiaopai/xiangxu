"use client";

import { Button, Surface } from "@xiangxu/ui";
import { useState } from "react";

import { beginClientSession } from "../state/auth-epoch";

export function DevLogin() {
  const [state, setState] = useState<"idle" | "submitting" | "error">("idle");

  const establish = async () => {
    setState("submitting");
    try {
      const response = await fetch("/api/dev/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("开发会话不可用");
      beginClientSession();
      globalThis.location.assign("/app/today");
    } catch {
      setState("error");
    }
  };

  return (
    <main className="shell shell--login" data-shell="login">
      <Surface aria-labelledby="login-title" size="major">
        <div className="shell__stack">
          <p className="shell__brand">向序 XIANGXU</p>
          <h1 id="login-title">进入今日秩序</h1>
          <p>本地开发会话仅在获准的 local/test profile 中启用。</p>
          <Button disabled={state === "submitting"} onClick={() => void establish()} type="button">
            {state === "submitting" ? "正在建立会话" : "建立开发会话"}
          </Button>
          {state === "error" ? <p aria-live="assertive" className="state-message state-message--error">无法建立开发会话，请检查运行配置。</p> : null}
        </div>
      </Surface>
    </main>
  );
}
