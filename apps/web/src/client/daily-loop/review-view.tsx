"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Surface } from "@xiangxu/ui";
import { useEffect, useState } from "react";
import { v7 as uuidv7 } from "uuid";

import { useDailyLoopRuntime } from "../state/daily-loop-provider";
import { applyMutationInvalidation } from "../state/invalidation";
import { queryKeys } from "../state/query-keys";
import { createDailyReview, getReview, getToday } from "./daily-loop-api";
import { hasActualEvidence, projectionState } from "./daily-loop-model";

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

export function ReviewView() {
  const [day, setDay] = useState<LocalDay>();
  const { authEpoch } = useDailyLoopRuntime();
  const queryClient = useQueryClient();
  useEffect(() => setDay(currentLocalDay()), []);

  const today = useQuery({
    queryKey: queryKeys.today(authEpoch),
    queryFn: () => getToday(day?.date ?? "", day?.timezone ?? "UTC"),
    enabled: day !== undefined,
  });
  const review = useQuery({
    queryKey: queryKeys.review(authEpoch),
    queryFn: () => getReview(day?.date ?? "", day?.timezone ?? "UTC"),
    enabled: day !== undefined,
  });
  const create = useMutation({
    mutationFn: async () => {
      if (day === undefined || today.data === null || today.data === undefined) {
        throw new Error("需要先提交今日计划");
      }
      if (today.data.version !== 1) {
        throw new Error("frozen read Contract 未暴露历史 baseline；多版本 Review 创建已安全收窄");
      }
      const commandId = uuidv7();
      return createDailyReview({
        date: day.date,
        timezone: day.timezone,
        baselinePlanSnapshotId: today.data.id,
        finalPlanSnapshotId: today.data.id,
        reviewSnapshotId: uuidv7(),
        commandId,
        idempotencyKey: commandId,
      });
    },
    onSuccess: async (result) => applyMutationInvalidation(queryClient, result, authEpoch),
  });
  const state = projectionState({ pending: review.isPending || day === undefined, error: review.isError, data: review.data });

  return (
    <div className="daily-page" data-page="review">
      <header className="daily-page__header">
        <div><p className="daily-page__eyeline">{day?.date ?? "正在确认本地日期"}</p><h1>每日复盘</h1></div>
        <p>Plan → Actual → What Changed</p>
      </header>

      {state === "loading" ? <ReviewState title="正在读取 Review Snapshot">Canonical projection 正在加载。</ReviewState> : null}
      {state === "error" ? <ReviewState error title="Review 暂时不可用">没有用计算假数据掩盖查询错误。</ReviewState> : null}
      {state === "empty" ? (
        <section aria-labelledby="review-empty-title" className="daily-section">
          <Surface tone="subtle">
            <h2 id="review-empty-title">今天还没有 Review Snapshot</h2>
            <p>服务端将从 canonical Plan 与 actual evidence 重新计算，浏览器不提交指标。</p>
            <Button
              disabled={create.isPending || today.data === null || today.data === undefined || today.data.version !== 1}
              onClick={() => create.mutate()}
              type="button"
            >
              {create.isPending ? "正在生成" : "生成不可变复盘"}
            </Button>
            {today.data !== null && today.data !== undefined && today.data.version !== 1 ? (
              <p className="state-message">当前 Plan 为版本 {today.data.version}；frozen API 未提供 baseline 读取，本 UI 不猜历史 ID。</p>
            ) : null}
            {create.isError ? <p aria-live="assertive" className="state-message state-message--error">{create.error.message}</p> : null}
          </Surface>
        </section>
      ) : null}

      {state === "data" && review.data !== null && review.data !== undefined ? (
        <>
          <section aria-labelledby="review-plan-title" className="daily-section">
            <div className="daily-section__heading">
              <div><p className="ontology-label ontology-label--snapshot">Snapshot</p><h2 id="review-plan-title">计划</h2></div>
              <p>不可编辑历史基线</p>
            </div>
            <Surface>
              <dl className="reference-list">
                <div><dt>Baseline</dt><dd>{review.data.baselinePlanSnapshotId}</dd></div>
                <div><dt>Final</dt><dd>{review.data.finalPlanSnapshotId}</dd></div>
                <div><dt>Planned</dt><dd>{review.data.derivedMetrics.plannedCount ?? "未提供"}</dd></div>
              </dl>
            </Surface>
          </section>

          <section aria-labelledby="review-actual-title" className="daily-section">
            <div className="daily-section__heading">
              <div><p className="ontology-label ontology-label--fact">Actual evidence</p><h2 id="review-actual-title">实际</h2></div>
              <p>due ≠ TimeBlock ≠ ExecutionRecord</p>
            </div>
            <Surface>
              {hasActualEvidence(review.data) ? (
                <ul className="reference-items">{review.data.executionRecordIds.map((id) => <li key={id}>{id}</li>)}</ul>
              ) : <p>缺少实际执行时间证据；完成 Task 不会被伪造成 duration。</p>}
              <p>实际记录 {review.data.derivedMetrics.actualExecutionCount ?? 0} 条 · {review.data.derivedMetrics.actualDurationMinutes ?? 0} 分钟</p>
            </Surface>
          </section>

          <section aria-labelledby="review-change-title" className="daily-section">
            <div className="daily-section__heading">
              <div><p className="ontology-label ontology-label--fact">Traceable change</p><h2 id="review-change-title">发生的变化</h2></div>
              <p>来自 ChangeRecord，而非前端猜测</p>
            </div>
            <Surface>
              {review.data.whatChanged.length === 0 ? <p>baseline 之后没有可追溯变化。</p> : (
                <ul className="reference-items">
                  {review.data.whatChanged.map((ref) => <li key={`${ref.objectType}:${ref.id}`}>{ref.objectType} · {ref.id}</li>)}
                </ul>
              )}
            </Surface>
          </section>

          <section aria-labelledby="review-ai-title" className="daily-section">
            <div className="daily-section__heading">
              <div><p className="ontology-label ontology-label--proposal">AI insight</p><h2 id="review-ai-title">智能洞察</h2></div>
              <p>次要层</p>
            </div>
            <Surface tone="intelligence"><p>{review.data.aiInsightRefs.length === 0 ? "不可用 / 未生成。本阶段没有调用真实 AI。" : "已有引用"}</p></Surface>
          </section>
        </>
      ) : null}
    </div>
  );
}

function ReviewState({ children, error = false, title }: Readonly<{ children: string; error?: boolean; title: string }>) {
  return (
    <Surface aria-label={title} tone="subtle">
      <h2>{title}</h2>
      <p className={error ? "state-message state-message--error" : "state-message"}>{children}</p>
    </Surface>
  );
}
