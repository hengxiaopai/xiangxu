import { encodeSseEnvelope, type SseEnvelope } from "@xiangxu/contracts";

import { HttpProblemError, problem, resolveRequestActor } from "../../../../server/http";
import { sseEventStream, sseRuntimeConfig } from "../../../../server/composition/runtime";

export const dynamic = "force-dynamic";

const ELIGIBLE_CHANNELS = new Set(["object.changed", "proposal.ready"] as const);

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await resolveRequestActor(request);
    const channels = requestedChannels(request.url);
    const headerCursor = request.headers.get("Last-Event-ID");
    if (headerCursor !== null && !/^(0|[1-9][0-9]*)$/.test(headerCursor)) {
      throw new HttpProblemError(400, "VALIDATION_ERROR", "Last-Event-ID must be a decimal durable sequence");
    }
    let cursor = headerCursor ?? await sseEventStream.currentCursor();
    const config = sseRuntimeConfig();
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let lastWrite = Date.now();
        const close = () => {
          if (closed) return;
          closed = true;
          controller.close();
        };
        request.signal.addEventListener("abort", close, { once: true });

        const write = (wire: string) => {
          if (closed) return;
          controller.enqueue(encoder.encode(wire));
          lastWrite = Date.now();
        };

        write(": connected\n\n");

        void (async () => {
          try {
            while (!closed && !request.signal.aborted) {
              const batch = await sseEventStream.replay(actor.actor.actorId, cursor, channels, config.replayLimit);
              if (batch.resyncRequired) {
                const resync: SseEnvelope = {
                  event: "system.resync-required",
                  id: batch.latestEventId,
                  version: "1",
                  data: {
                    affectedRefs: [],
                    projectionHints: ["today", "tasks", "calendar", "captures", "proposals", "review"],
                    reason: "retention_gap",
                    latestEventId: batch.latestEventId,
                  },
                };
                write(encodeSseEnvelope(resync));
                cursor = batch.latestEventId;
              } else {
                for (const event of batch.events) write(encodeSseEnvelope(event as SseEnvelope));
                cursor = batch.latestEventId;
              }
              if (Date.now() - lastWrite >= config.heartbeatMilliseconds) write(": heartbeat\n\n");
              await abortableDelay(config.pollMilliseconds, request.signal);
            }
          } catch (error) {
            if (!closed && !request.signal.aborted) controller.error(error);
          } finally {
            close();
          }
        })();
      },
      cancel() {
        // The request abort signal stops the polling loop and releases its timer.
      },
    });

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return problem(error, "/api/v1/stream");
  }
}

function requestedChannels(url: string): readonly ("object.changed" | "proposal.ready")[] {
  const requested = new URL(url).searchParams.getAll("channels").flatMap((value) => value.split(","));
  if (requested.length === 0) return ["object.changed", "proposal.ready"];
  return requested.filter((value): value is "object.changed" | "proposal.ready" =>
    ELIGIBLE_CHANNELS.has(value as "object.changed" | "proposal.ready"));
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}
