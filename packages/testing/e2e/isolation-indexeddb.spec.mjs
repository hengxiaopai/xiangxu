import { expect, test } from "@playwright/test";

import {
  countCapture,
  createDirectSession,
  createTask,
  databaseCaptureProof,
  newStageContext,
  nodeRequest,
  observePage,
  readOfflineRecords,
  sseEvents,
} from "./helpers.mjs";

test.describe.configure({ mode: "serial" });

test("two independent browser identities do not share UI, mutation authority, SSE or IndexedDB", async ({ browser }) => {
  const contextA = await newStageContext(browser);
  const contextB = await newStageContext(browser);
  const sessionA = await createDirectSession(contextA, "stage8-isolation-a");
  await createDirectSession(contextB, "stage8-isolation-b");
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const observedA = observePage(pageA, { allowedConsole: [/404 \(Not Found\)/u] });
  const observedB = observePage(pageB, { allowedConsole: [/404 \(Not Found\)/u] });
  await Promise.all([pageA.goto("/app/today"), pageB.goto("/app/today")]);
  await Promise.all([
    expect(pageA.getByText("实时已连接")).toBeVisible(),
    expect(pageB.getByText("实时已连接")).toBeVisible(),
  ]);

  const taskId = "01989abc-0004-7000-8000-000000000401";
  await createTask(sessionA, { id: taskId, title: "仅属于 Actor A 的 Task", key: "stage8-actor-a-task" });
  await expect(pageA.getByRole("checkbox", { name: /仅属于 Actor A 的 Task/u })).toBeVisible();
  await expect(pageB.getByText("仅属于 Actor A 的 Task")).toHaveCount(0);
  expect((await contextB.request.get(`/api/v1/tasks/${taskId}`)).status()).toBe(404);
  expect((await contextB.request.post(`/api/v1/tasks/${taskId}/complete`, {
    headers: { "Idempotency-Key": "stage8-foreign-complete", "If-Match": '"rev-1"' },
    data: { commandId: "01989abc-0004-7000-8000-000000000402", sourceContext: { surface: "stage8" } },
  })).status()).toBe(404);
  expect((await sseEvents(pageB)).some(({ data }) => data.includes(taskId))).toBe(false);
  expect(await readOfflineRecords(pageB)).toEqual([]);
  observedA.assertClean(expect);
  observedB.assertClean(expect);
  await Promise.all([contextA.close(), contextB.close()]);
});

test("real IndexedDB survives reload, syncs once, and never replays an old Auth Epoch as a new session", async ({ browser }) => {
  const context = await newStageContext(browser);
  await createDirectSession(context, "stage8-indexeddb-a");
  const page = await context.newPage();
  const observed = observePage(page, {
    allowedConsole: [
      /404 \(Not Found\)/u,
      /401 \(Unauthorized\)/u,
      /ERR_INTERNET_DISCONNECTED/u,
      /EventSource/u,
      /Failed to fetch/u,
    ],
    allowedFailures: [
      /^\/api\/v1\/captures$/u,
      /^\/api\/v1\/stream$/u,
      /^DELETE \/api\/dev\/session$/u,
    ],
  });
  let capturePosts = 0;
  await page.route("**/api/v1/captures", async (route) => {
    if (route.request().method() === "POST") {
      capturePosts += 1;
      await route.abort("internetdisconnected");
    } else {
      await route.continue();
    }
  });
  await page.goto("/app/today");
  await expect(page.getByText("实时已连接")).toBeVisible();
  await context.setOffline(true);
  const capture = page.getByRole("textbox", { name: "把此刻的内容留在 Inbox" });
  await capture.fill("Stage 8 IndexedDB reload fixture");
  await page.getByRole("button", { name: "保存 Capture" }).click();
  await expect(page.getByText("离线待同步")).toBeVisible();
  const beforeReload = await readOfflineRecords(page);
  expect(beforeReload).toHaveLength(1);
  expect(beforeReload[0].command.state).toBe("pending");
  expect(beforeReload[0].command.localId).toBe(beforeReload[0].command.idempotencyKey);
  expect(beforeReload[0].command.payload.rawPayload.text).toBe("Stage 8 IndexedDB reload fixture");
  expect(beforeReload[0].authEpoch).toMatch(/^[0-9a-f-]{36}$/u);

  await context.setOffline(false);
  await expect.poll(() => capturePosts).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByText("离线待同步")).toBeVisible();
  const afterReload = await readOfflineRecords(page);
  expect(afterReload).toHaveLength(1);
  expect(afterReload[0].command.localId).toBe(beforeReload[0].command.localId);
  expect(afterReload[0].command.idempotencyKey).toBe(beforeReload[0].command.idempotencyKey);
  expect(afterReload[0].authEpoch).toBe(beforeReload[0].authEpoch);

  await page.unroute("**/api/v1/captures");
  await context.setOffline(true);
  await context.setOffline(false);
  await expect(page.getByText("在线保存成功")).toBeVisible();
  const finalRecords = await readOfflineRecords(page);
  expect(finalRecords[0].command.state).toBe("done");
  expect(finalRecords[0].command.localId).toBe(beforeReload[0].command.localId);
  expect(await databaseCaptureProof(finalRecords[0])).toEqual({
    captures: 1,
    raw_payloads: 1,
    change_records: 1,
    outbox_rows: 2,
    idempotency_rows: 1,
  });

  await page.route("**/api/v1/captures", (route) => route.abort("internetdisconnected"));
  await context.setOffline(true);
  await capture.fill("Stage 8 Auth Epoch A pending fixture");
  await page.getByRole("button", { name: "保存 Capture" }).click();
  await expect(page.getByText("离线待同步")).toBeVisible();
  const withPending = await readOfflineRecords(page);
  const actorAPending = withPending.find(({ command }) => command.payload.rawPayload.text === "Stage 8 Auth Epoch A pending fixture");
  expect(actorAPending).toBeDefined();
  await context.setOffline(false);
  await page.getByRole("button", { name: "退出开发会话" }).click();
  await expect(page).toHaveURL(/\/login$/u);

  await context.clearCookies();
  await createDirectSession(context, "stage8-indexeddb-b");
  await page.goto("/app/today");
  await expect(page.getByText("Stage 8 Auth Epoch A pending fixture")).toHaveCount(0);
  await page.unroute("**/api/v1/captures");
  await context.setOffline(true);
  await context.setOffline(false);
  await page.waitForTimeout(500);
  expect(await countCapture(actorAPending.command.payload.captureId)).toBe(0);
  expect((await readOfflineRecords(page)).find(({ command }) => command.localId === actorAPending.command.localId).command.state).toBe("conflict");
  observed.assertClean(expect);
  await context.close();
});

test("same-actor multi-tab receives targeted SSE/TanStack refresh without reload", async ({ browser }) => {
  const context = await newStageContext(browser);
  const session = await createDirectSession(context, "stage8-multitab");
  const tabA = await context.newPage();
  const tabB = await context.newPage();
  const observedA = observePage(tabA, { allowedConsole: [/404 \(Not Found\)/u] });
  const observedB = observePage(tabB, { allowedConsole: [/404 \(Not Found\)/u] });
  await Promise.all([tabA.goto("/app/today"), tabB.goto("/app/today")]);
  await Promise.all([
    expect(tabA.getByText("实时已连接")).toBeVisible(),
    expect(tabB.getByText("实时已连接")).toBeVisible(),
  ]);
  let taskReads = 0;
  let proposalReads = 0;
  tabB.on("request", (request) => {
    const pathname = new globalThis.URL(request.url()).pathname;
    if (request.method() === "GET" && pathname === "/api/v1/tasks") taskReads += 1;
    if (request.method() === "GET" && /^\/api\/v1\/proposals\//u.test(pathname)) proposalReads += 1;
  });
  const initialTaskReads = taskReads;
  const initialProposalReads = proposalReads;
  await createTask(session, {
    id: "01989abc-0005-7000-8000-000000000501",
    title: "Multi-tab SSE targeted refresh",
    key: "stage8-multitab-task",
  });
  await expect(tabB.getByRole("checkbox", { name: /Multi-tab SSE targeted refresh/u })).toBeVisible();
  expect(taskReads).toBeGreaterThan(initialTaskReads);
  expect(proposalReads).toBe(initialProposalReads);
  expect(await nodeRequest(session, "/api/v1/tasks").then((response) => response.status)).toBe(200);
  observedA.assertClean(expect);
  observedB.assertClean(expect);
  await context.close();
});
