"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCaptureCommandSchema,
  type CreateCaptureCommandDto,
  type PlanSnapshotDto,
  type TaskDto,
} from "@xiangxu/contracts";
import { Button, Surface } from "@xiangxu/ui";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { v7 as uuidv7 } from "uuid";

import { IndexedDbOfflineCaptureStore } from "../offline/indexeddb-capture-queue";
import {
  HttpOfflineCaptureTransport,
  queueOfflineCapture,
  syncOfflineCapture,
  syncPendingOfflineCaptures,
  visibleOfflineCaptures,
  type StoredOfflineCapture,
} from "../offline/offline-capture";
import { applyMutationInvalidation } from "../state/invalidation";
import { queryKeys } from "../state/query-keys";
import { useDailyLoopRuntime } from "../state/daily-loop-provider";
import {
  ApiProblemError,
  applyProposal,
  commitDailyPlan,
  getProposal,
  getTasks,
  getToday,
} from "./daily-loop-api";
import { planRole, projectionState, quickCaptureViewState } from "./daily-loop-model";

interface LocalDay {
  readonly date: string;
  readonly timezone: string;
}

function currentLocalDay(): LocalDay {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, timezone };
}

export function TodayView() {
  const [day, setDay] = useState<LocalDay>();
  const [selectedTaskIds, setSelectedTaskIds] = useState<readonly string[]>([]);
  const [capacity, setCapacity] = useState("");
  const { authEpoch, latestProposalId } = useDailyLoopRuntime();
  const queryClient = useQueryClient();

  useEffect(() => setDay(currentLocalDay()), []);

  const tasks = useQuery({
    queryKey: queryKeys.tasks(authEpoch),
    queryFn: getTasks,
  });
  const today = useQuery({
    queryKey: queryKeys.today(authEpoch),
    queryFn: () => getToday(day?.date ?? "", day?.timezone ?? "UTC"),
    enabled: day !== undefined,
  });
  const planMutation = useMutation({
    mutationFn: async () => {
      if (day === undefined) throw new Error("Local day is unavailable");
      const capacityMinutes = Number(capacity);
      if (!Number.isInteger(capacityMinutes) || capacityMinutes < 0) throw new Error("容量必须是非负整数分钟");
      const commandId = uuidv7();
      return commitDailyPlan({
        date: day.date,
        timezone: day.timezone,
        capacityMinutes,
        taskIds: selectedTaskIds,
        planSnapshotId: uuidv7(),
        commandId,
        idempotencyKey: commandId,
      });
    },
    onSuccess: async (result) => applyMutationInvalidation(queryClient, result, authEpoch),
  });

  const availableTasks = (tasks.data ?? []).filter((task) => task.status !== "completed" && task.status !== "cancelled");
  const taskById = new Map((tasks.data ?? []).map((task) => [task.id, task]));
  const state = projectionState({ pending: today.isPending || day === undefined, error: today.isError, data: today.data });

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((current) => current.includes(taskId)
      ? current.filter((id) => id !== taskId)
      : current.length < 3 ? [...current, taskId] : current);
  };

  return (
    <div className="daily-page" data-page="today">
      <header className="daily-page__header">
        <div>
          <p className="daily-page__eyeline">{day?.date ?? "正在确认本地日期"}</p>
          <h1>今天</h1>
        </div>
        <p>{day?.timezone ?? "正在确认时区"}</p>
      </header>

      {state === "loading" ? <StateSurface title="正在读取今日计划">Canonical projection 正在加载。</StateSurface> : null}
      {state === "error" ? <StateSurface error title="今日计划暂时不可用">没有使用样例数据替代失败的真实查询。</StateSurface> : null}
      {state === "empty" ? (
        <StateSurface title="今天还没有已提交计划">选择最多三项真实 Task，并明确提交一份不可变 baseline。</StateSurface>
      ) : null}
      {state === "data" && today.data !== null && today.data !== undefined ? (
        <PlanSnapshotSurface plan={today.data} taskById={taskById} />
      ) : null}

      <section aria-labelledby="commit-plan-title" className="daily-section">
        <div className="daily-section__heading">
          <div>
            <p className="ontology-label ontology-label--fact">Fact → Snapshot</p>
            <h2 id="commit-plan-title">确认今日计划</h2>
          </div>
          <p>每次确认都会追加新版本，不覆盖历史。</p>
        </div>
        <Surface>
          <form className="daily-form" onSubmit={(event) => { event.preventDefault(); planMutation.mutate(); }}>
            <fieldset>
              <legend>Top 3 / Now</legend>
              {tasks.isPending ? <p>正在读取 Task Facts。</p> : null}
              {tasks.isError ? <p className="state-message state-message--error">Task Facts 暂不可读；没有用空列表掩盖错误。</p> : null}
              {!tasks.isPending && !tasks.isError && availableTasks.length === 0 ? <p>没有可加入计划的开放 Task。</p> : null}
              <div className="selection-list">
                {availableTasks.map((task) => (
                  <label className="selection-row" key={task.id}>
                    <input
                      checked={selectedTaskIds.includes(task.id)}
                      disabled={!selectedTaskIds.includes(task.id) && selectedTaskIds.length >= 3}
                      onChange={() => toggleTask(task.id)}
                      type="checkbox"
                    />
                    <span><strong>{task.title}</strong><small>{task.status} · rev-{task.revision}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="field-label">
              今日可用容量（分钟）
              <input inputMode="numeric" min="0" onChange={(event) => setCapacity(event.target.value)} required type="number" value={capacity} />
            </label>
            <Button disabled={planMutation.isPending || day === undefined} type="submit">
              {planMutation.isPending ? "正在提交" : today.data === null ? "提交 baseline" : "提交新计划版本"}
            </Button>
            {planMutation.isError ? <p aria-live="assertive" className="state-message state-message--error">{planMutation.error.message}</p> : null}
            {planMutation.isSuccess ? <p aria-live="polite" className="state-message">计划快照已提交。</p> : null}
          </form>
        </Surface>
      </section>

      <QuickCapture authEpoch={authEpoch} queryClient={queryClient} />
      <ProposalSurface authEpoch={authEpoch} proposalId={latestProposalId} queryClient={queryClient} />
    </div>
  );
}

function PlanSnapshotSurface({ plan, taskById }: Readonly<{
  plan: PlanSnapshotDto;
  taskById: ReadonlyMap<string, TaskDto>;
}>) {
  const primary = plan.items[0];
  return (
    <section aria-labelledby="primary-focus-title" className="daily-section">
      <div className="daily-section__heading">
        <div>
          <p className="ontology-label ontology-label--snapshot">Snapshot · {planRole(plan)}</p>
          <h2 id="primary-focus-title">一个主要焦点</h2>
        </div>
        <p>版本 {plan.version} · 容量 {plan.capacityMinutes} 分钟</p>
      </div>
      <Surface size="major">
        {primary === undefined ? <p>已提交空计划，当前没有主要焦点。</p> : (
          <div className="primary-focus">
            <strong>{taskById.get(primary.taskId)?.title ?? "Task Fact 暂不可读"}</strong>
            <small>{primary.taskId}</small>
          </div>
        )}
        <ol className="top-three-list">
          {plan.items.map((item) => (
            <li key={item.taskId}>
              <span>{taskById.get(item.taskId)?.title ?? "Task Fact 暂不可读"}</span>
              <small>{item.timeBlockIds.length === 0 ? "未纳入时间块" : `${item.timeBlockIds.length} 个时间块`}</small>
            </li>
          ))}
        </ol>
      </Surface>
    </section>
  );
}

function QuickCapture({ authEpoch, queryClient }: Readonly<{
  authEpoch: Parameters<typeof applyMutationInvalidation>[2];
  queryClient: Parameters<typeof applyMutationInvalidation>[0];
}>) {
  const store = useMemo(() => new IndexedDbOfflineCaptureStore(), []);
  const transport = useMemo(() => new HttpOfflineCaptureTransport(), []);
  const [text, setText] = useState("");
  const [records, setRecords] = useState<readonly StoredOfflineCapture[]>([]);
  const [syncingId, setSyncingId] = useState<string>();
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const next = await store.list();
        if (active) setRecords(visibleOfflineCaptures(next, authEpoch));
      } catch {
        if (active) setStorageError(true);
      }
    };
    const online = () => {
      void syncPendingOfflineCaptures(store, authEpoch, transport).then((next) => {
        if (active) setRecords(visibleOfflineCaptures(next, authEpoch));
      }).catch(() => {
        if (active) setStorageError(true);
      });
    };
    void refresh();
    globalThis.addEventListener("online", online);
    return () => { active = false; globalThis.removeEventListener("online", online); };
  }, [authEpoch, store, transport]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (value.length === 0) return;
    setStorageError(false);
    try {
      const captureId = uuidv7();
      const payload: CreateCaptureCommandDto = createCaptureCommandSchema.parse({
        commandId: uuidv7(),
        sourceContext: { route: "/app/today", surface: "quick-capture" },
        captureId,
        rawPayload: { id: uuidv7(), kind: "text", text: value },
      });
      const queued = await queueOfflineCapture(store, payload, authEpoch);
      setRecords((current) => [...current.filter((record) => record.command.localId !== queued.command.localId), queued]);
      setText("");
      if (!globalThis.navigator.onLine) return;
      setSyncingId(queued.command.localId);
      const synced = await syncOfflineCapture(queued, authEpoch, transport);
      await store.put(synced);
      setRecords((current) => current.map((record) => record.command.localId === synced.command.localId ? synced : record));
      if (synced.command.state === "done") {
        await applyMutationInvalidation(queryClient, {
          affectedRefs: [{ objectType: "capture_item", id: captureId }],
          projectionHints: ["captures"],
        }, authEpoch);
      }
    } catch {
      setStorageError(true);
    } finally {
      setSyncingId(undefined);
    }
  };

  const latest = records.at(-1);
  const latestState = quickCaptureViewState(latest?.command.state, syncingId === latest?.command.localId);
  const stateText = latestState === "online-success" ? "在线保存成功"
    : latestState === "syncing" ? "正在同步"
      : latestState === "offline-pending" ? "离线待同步"
        : latestState === "conflict" ? "同步冲突，需要人工处理"
          : latestState === "failed" ? "同步失败" : "尚无待处理 Capture";

  return (
    <section aria-labelledby="quick-capture-title" className="daily-section">
      <div className="daily-section__heading">
        <div><p className="ontology-label ontology-label--fact">Fact intake</p><h2 id="quick-capture-title">快速收集</h2></div>
        <p aria-live="polite">{stateText}</p>
      </div>
      <Surface>
        <form className="daily-form" onSubmit={(event) => void submit(event)}>
          <label className="field-label">把此刻的内容留在 Inbox<textarea onChange={(event) => setText(event.target.value)} required value={text} /></label>
          <Button type="submit">保存 Capture</Button>
          {storageError ? <p aria-live="assertive" className="state-message state-message--error">当前浏览器无法使用 IndexedDB；未声称持久化成功。</p> : null}
        </form>
      </Surface>
    </section>
  );
}

function ProposalSurface({ authEpoch, proposalId, queryClient }: Readonly<{
  authEpoch: Parameters<typeof applyMutationInvalidation>[2];
  proposalId: string | undefined;
  queryClient: Parameters<typeof applyMutationInvalidation>[0];
}>) {
  const proposal = useQuery({
    queryKey: queryKeys.proposal(authEpoch, proposalId ?? "none"),
    queryFn: () => getProposal(proposalId ?? ""),
    enabled: proposalId !== undefined,
  });
  const apply = useMutation({
    mutationFn: () => {
      if (proposal.data === undefined) throw new Error("Proposal 尚未就绪");
      return applyProposal(proposal.data, uuidv7());
    },
    onSuccess: async (result) => applyMutationInvalidation(queryClient, result, authEpoch),
  });
  const conflict = apply.error instanceof ApiProblemError && apply.error.status === 409;

  return (
    <section aria-labelledby="proposal-title" className="daily-section">
      <div className="daily-section__heading">
        <div><p className="ontology-label ontology-label--proposal">Proposal</p><h2 id="proposal-title">结构化建议</h2></div>
        <p>真实 AI：不可用 / 未生成</p>
      </div>
      <Surface tone="intelligence">
        {proposalId === undefined ? <p>后台尚未发布可读取的 Proposal。这里不伪造建议。</p> : null}
        {proposal.isPending && proposalId !== undefined ? <p>Proposal ready 事件已到达，正在读取 canonical DTO。</p> : null}
        {proposal.isError ? <p className="state-message state-message--error">Proposal 暂不可读。</p> : null}
        {proposal.data !== undefined ? (
          <div className="proposal-content">
            <h3>{proposal.data.patch.kind === "task.create" ? proposal.data.patch.task.title : "分类建议"}</h3>
            <p>{proposal.data.rationale}</p>
            <p>风险：{proposal.data.riskLevel} · 状态：{proposal.data.status}</p>
            <Button disabled={proposal.data.status !== "ready" || apply.isPending} onClick={() => apply.mutate()} type="button">确认并应用</Button>
          </div>
        ) : null}
        {conflict ? <p aria-live="assertive" className="state-message state-message--error">Proposal 已 stale 或发生冲突，未修改 Fact。</p> : null}
        {apply.isSuccess ? <p aria-live="polite" className="state-message">Proposal 已显式应用为 Fact。</p> : null}
      </Surface>
    </section>
  );
}

function StateSurface({ children, error = false, title }: Readonly<{
  children: string;
  error?: boolean;
  title: string;
}>) {
  return (
    <Surface aria-label={title} tone="subtle">
      <h2>{title}</h2>
      <p className={error ? "state-message state-message--error" : "state-message"}>{children}</p>
    </Surface>
  );
}
