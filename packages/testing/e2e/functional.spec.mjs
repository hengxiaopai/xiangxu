import { expect, test } from "@playwright/test";

import {
  assertNoSecretSurface,
  baseURL,
  createDirectSession,
  createTask,
  createTimeBlock,
  frozenDate,
  ids,
  newStageContext,
  observePage,
  restartNextProductionServer,
  revokeSession,
  sseEvents,
} from "./helpers.mjs";

test.describe.configure({ mode: "serial" });

test("anonymous, valid, revoked, logout and browser-back authority are fail-closed", async ({ browser }) => {
  const anonymous = await newStageContext(browser);
  const anonymousPage = await anonymous.newPage();
  await anonymousPage.goto("/app/today");
  await expect(anonymousPage.getByRole("heading", { name: "今天", exact: true })).toBeVisible();
  await expect(anonymousPage.getByText("Task Facts 暂不可读")).toBeVisible();
  expect(await anonymousPage.evaluate(() => globalThis.fetch("/api/v1/tasks").then((response) => response.status))).toBe(401);
  await anonymous.close();

  const context = await newStageContext(browser);
  const session = await createDirectSession(context, "stage8-auth-proof");
  const page = await context.newPage();
  const observed = observePage(page, {
    allowedConsole: [/404 \(Not Found\)/u, /401 \(Unauthorized\)/u],
  });
  await page.goto("/app/today");
  await expect(page.getByText("实时已连接")).toBeVisible();
  const cookie = (await context.cookies()).find(({ name }) => name === "xiangxu_dev_session");
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
  expect(cookie.expires).toBeGreaterThan(Date.parse("2026-08-13T03:00:00.000Z") / 1000);
  await assertNoSecretSurface(page, expect);

  await revokeSession(session.tokenHash);
  expect(await page.evaluate(() => globalThis.fetch("/api/v1/tasks").then((response) => response.status))).toBe(401);
  await context.clearCookies();
  observed.assertClean(expect);
  await context.close();

  const loginContext = await newStageContext(browser);
  const loginPage = await loginContext.newPage();
  const loginObserved = observePage(loginPage, {
    allowedConsole: [/404 \(Not Found\)/u, /401 \(Unauthorized\)/u, /EventSource/u],
    allowedFailures: [/^\/api\/v1\/stream$/u, /^DELETE \/api\/dev\/session$/u],
  });
  await loginPage.goto("/login");
  await loginPage.keyboard.press("Tab");
  await expect(loginPage.getByRole("button", { name: "建立开发会话" })).toBeFocused();
  await loginPage.keyboard.press("Enter");
  await expect(loginPage).toHaveURL(`${baseURL}/app/today`);
  await expect(loginPage.getByText("实时已连接")).toBeVisible();
  await loginPage.getByRole("button", { name: "退出开发会话" }).focus();
  await loginPage.keyboard.press("Enter");
  await expect(loginPage).toHaveURL(`${baseURL}/login`);
  await loginPage.goBack();
  expect(await loginPage.evaluate(() => globalThis.fetch("/api/v1/tasks").then((response) => response.status))).toBe(401);
  await loginPage.reload();
  await expect(loginPage.getByText("Task Facts 暂不可读")).toBeVisible();
  loginObserved.assertClean(expect);
  await loginContext.close();
});

test("keyboard-driven Daily Loop uses real Task, TimeBlock, Plan, dispatcher/worker Proposal, Apply and Review", async ({ browser }) => {
  const context = await newStageContext(browser);
  const session = await createDirectSession(context, "stage8-functional");
  const page = await context.newPage();
  const observed = observePage(page, { allowedConsole: [/404 \(Not Found\)/u] });
  await page.goto("/app/today");
  await expect(page.getByText("实时已连接")).toBeVisible();
  await expect(page.getByText("今天还没有已提交计划")).toBeVisible();

  await createTask(session, {
    id: ids.functionalTask,
    title: "Stage 8 真实浏览器重点任务",
    key: "stage8-functional-task",
  });
  await createTimeBlock(session, {
    id: ids.functionalBlock,
    taskId: ids.functionalTask,
    key: "stage8-functional-block",
  });
  const taskCheckbox = page.getByRole("checkbox", { name: /Stage 8 真实浏览器重点任务/u });
  await expect(taskCheckbox).toBeVisible();
  await taskCheckbox.focus();
  await page.keyboard.press("Space");
  await expect(taskCheckbox).toBeChecked();
  const capacity = page.getByRole("spinbutton", { name: "今日可用容量（分钟）" });
  await capacity.fill("180");
  await capacity.press("Enter");
  await expect(page.getByText("计划快照已提交。")).toBeVisible();
  await expect(page.getByRole("heading", { name: "一个主要焦点" })).toBeVisible();
  await expect(page.getByText("Stage 8 真实浏览器重点任务", { exact: true }).first()).toBeVisible();

  const captureText = "Stage 8 Quick Capture 可验证建议";
  const capture = page.getByRole("textbox", { name: "把此刻的内容留在 Inbox" });
  await capture.fill(captureText);
  await page.getByRole("button", { name: "保存 Capture" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("在线保存成功")).toBeVisible();
  await expect(page.getByRole("heading", { name: captureText })).toBeVisible({ timeout: 15_000 });
  const apply = page.getByRole("button", { name: "确认并应用" });
  await apply.focus();
  await page.keyboard.press("Space");
  await expect(page.getByText("Proposal 已显式应用为 Fact。")).toBeVisible();
  await expect(page.getByText(captureText, { exact: true }).first()).toBeVisible();

  const events = await sseEvents(page);
  expect(events.some(({ type }) => type === "proposal.ready")).toBe(true);
  expect(events.every(({ type, data }) => type !== "capture.triage.requested" && !data.includes("capture.triage.requested"))).toBe(true);
  const durableIds = events.filter(({ id }) => /^\d+$/u.test(id)).map(({ id }) => BigInt(id));
  expect(durableIds.every((id, index) => index === 0 || id >= durableIds[index - 1])).toBe(true);

  await page.getByRole("link", { name: "复盘" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("今天还没有 Review Snapshot")).toBeVisible();
  const createReviewButton = page.getByRole("button", { name: "生成不可变复盘" });
  await createReviewButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "计划" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "实际" })).toBeVisible();
  await expect(page.getByText("缺少实际执行时间证据")).toBeVisible();
  await expect(page.getByText(frozenDate)).toBeVisible();
  await assertNoSecretSurface(page, expect);
  observed.assertClean(expect);
  await context.close();
});

test("SSE reconnect replays missed committed events with Last-Event-ID", async ({ browser }) => {
  const context = await newStageContext(browser);
  const session = await createDirectSession(context, "stage8-sse-reconnect");
  const page = await context.newPage();
  const observed = observePage(page, {
    allowedConsole: [
      /404 \(Not Found\)/u,
      /ERR_CONNECTION_RESET/u,
      /^Failed to load resource: net::ERR_INCOMPLETE_CHUNKED_ENCODING$/u,
      /ERR_INTERNET_DISCONNECTED/u,
      /EventSource/u,
    ],
    allowedFailures: [/^\/api\/v1\/stream$/u],
  });
  await page.goto("/app/today");
  await expect(page.getByText("实时已连接")).toBeVisible();

  await createTask(session, {
    id: "01989abc-0003-7000-8000-000000000301",
    title: "SSE reconnect before",
    key: "stage8-sse-before",
  });
  await expect(page.getByRole("checkbox", { name: /SSE reconnect before/u })).toBeVisible();
  await expect.poll(async () => (await sseEvents(page)).some(({ data }) => data.includes("01989abc-0003-7000-8000-000000000301"))).toBe(true);
  await page.route("**/api/v1/stream?**", (route) => route.abort("connectionfailed"));
  await restartNextProductionServer();
  await expect(page.getByText("正在重连", { exact: true })).toBeVisible();
  await createTask(session, {
    id: "01989abc-0003-7000-8000-000000000302",
    title: "SSE reconnect missed event",
    key: "stage8-sse-missed",
  });
  await page.unroute("**/api/v1/stream?**");
  await expect(page.getByText("实时已连接")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /SSE reconnect missed event/u })).toBeVisible();
  await expect.poll(() => observed.streamRequests.some((value) => /^\d+$/u.test(value))).toBe(true);
  observed.assertClean(expect);
  await context.close();
});
