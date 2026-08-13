"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Surface } from "@xiangxu/ui";
import { useState, type FormEvent } from "react";
import { v7 as uuidv7 } from "uuid";

import { createLibrary, getKnowledgeOverview } from "../daily-loop/daily-loop-api";
import { applyMutationInvalidation } from "../state/invalidation";
import { queryKeys } from "../state/query-keys";
import { useDailyLoopRuntime } from "../state/daily-loop-provider";

const metricLabels = {
  added: "新增",
  unread: "未读",
  reading: "阅读中",
  settled: "已沉淀",
  longUnread: "长期未读",
} as const;

export function KnowledgeView() {
  const { authEpoch } = useDailyLoopRuntime();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const overview = useQuery({
    queryKey: queryKeys.knowledge(authEpoch),
    queryFn: getKnowledgeOverview,
  });
  const create = useMutation({
    mutationFn: async () => {
      const commandId = uuidv7();
      return createLibrary({
        libraryId: uuidv7(),
        commandId,
        name,
        ...(description.trim().length === 0 ? {} : { description }),
      });
    },
    onSuccess: async (result) => {
      setName("");
      setDescription("");
      await applyMutationInvalidation(queryClient, result, authEpoch);
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim().length > 0) create.mutate();
  };

  return (
    <div className="knowledge-page" data-page="knowledge">
      <header className="knowledge-page__header">
        <div>
          <p className="daily-page__eyeline">Knowledge Core · canonical projection</p>
          <h1>知识库</h1>
          <p>让资料进入可阅读、可关联、可复用的长期系统。</p>
        </div>
        <Button onClick={() => document.querySelector<HTMLInputElement>("#library-name")?.focus()} type="button">
          新建知识库
        </Button>
      </header>

      {overview.isPending ? <Surface tone="subtle"><p>正在读取真实 Knowledge projection。</p></Surface> : null}
      {overview.isError ? (
        <Surface tone="subtle"><p className="state-message state-message--error">知识投影暂不可用；没有使用样例数字掩盖失败。</p></Surface>
      ) : null}

      {overview.data !== undefined ? (
        <>
          <section aria-label="知识指标" className="knowledge-metrics">
            {Object.entries(metricLabels).map(([key, label]) => (
              <div className="knowledge-metric" key={key}>
                <strong>{overview.data.metrics[key as keyof typeof metricLabels]}</strong>
                <span>{label}</span>
              </div>
            ))}
          </section>

          <div className="knowledge-layout">
            <div className="knowledge-layout__primary">
              <section aria-labelledby="libraries-title" className="daily-section">
                <div className="daily-section__heading">
                  <div><p className="ontology-label ontology-label--fact">Fact collection</p><h2 id="libraries-title">Libraries</h2></div>
                  <p>{overview.data.libraries.length} 个知识库</p>
                </div>
                {overview.data.libraries.length === 0 ? (
                  <Surface tone="subtle"><p>还没有知识库。创建第一个真实 Library，Resource 身份不会被复制。</p></Surface>
                ) : (
                  <div className="library-grid">
                    {overview.data.libraries.map((library) => (
                      <Surface aria-label={library.name} key={library.id}>
                        <div className="library-card">
                          <p className="ontology-label">Library</p>
                          <h3>{library.name}</h3>
                          <p>{library.description || "尚未添加说明"}</p>
                          <small>0 个成员 · canonical membership</small>
                        </div>
                      </Surface>
                    ))}
                  </div>
                )}
              </section>

              <section aria-labelledby="reading-title" className="daily-section">
                <div className="daily-section__heading">
                  <div><p className="ontology-label ontology-label--snapshot">Action queue</p><h2 id="reading-title">阅读队列</h2></div>
                  <p>Resource → Read → Note</p>
                </div>
                <Surface tone="subtle"><p>当前没有 Resource。下一阶段将通过 Capture → Proposal → Fact 物化，不开放绕过确认的直接写入。</p></Surface>
              </section>
            </div>

            <aside aria-label="知识上下文" className="knowledge-layout__rail">
              <Surface>
                <form className="daily-form" onSubmit={submit}>
                  <div><p className="ontology-label ontology-label--fact">Create Fact</p><h2>新建知识库</h2></div>
                  <label className="field-label" htmlFor="library-name">名称
                    <input id="library-name" onChange={(event) => setName(event.target.value)} required type="text" value={name} />
                  </label>
                  <label className="field-label" htmlFor="library-description">说明
                    <textarea id="library-description" onChange={(event) => setDescription(event.target.value)} value={description} />
                  </label>
                  <Button disabled={create.isPending || name.trim().length === 0} type="submit">{create.isPending ? "正在创建" : "创建 Library"}</Button>
                  {create.isError ? <p aria-live="assertive" className="state-message state-message--error">创建失败，事务未提交。</p> : null}
                  {create.isSuccess ? <p aria-live="polite" className="state-message">Library 已写入并同步投影。</p> : null}
                </form>
              </Surface>
              <Surface tone="intelligence">
                <div className="knowledge-rail-card">
                  <p className="ontology-label ontology-label--proposal">AI Reading Rationale</p>
                  <h2>为什么现在读</h2>
                  <p>尚无 Goal / Project / Resource 证据，因此不生成伪推荐。</p>
                </div>
              </Surface>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
