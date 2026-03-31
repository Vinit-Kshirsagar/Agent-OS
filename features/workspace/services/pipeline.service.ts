// ===========================================
// Agent OS — Pipeline Service
// ===========================================
// Handles communication with /api/pipeline.
// Agent-status animation logic also lives here
// because it belongs to pipeline orchestration, not UI.

import type { ChatMessage } from "@/types";
import type { PipelineResult } from "@/agents/orchestrator";

export type AgentStatusUpdater = (
  index: number,
  status: "pending" | "running" | "done"
) => void;

export async function runPipelineRequest(
  messages: ChatMessage[],
  onStatusUpdate: AgentStatusUpdater
): Promise<PipelineResult> {
  // Animate agent statuses one-by-one while real API call runs
  for (let i = 0; i < 4; i++) {
    onStatusUpdate(i, "running");
    await new Promise((r) => setTimeout(r, 800));
  }

  const res = await fetch("/api/pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const traceId = res.headers.get("x-trace-id");
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      (errBody as { error?: string })?.error ??
        `Pipeline failed (${res.status})${traceId ? ` — TraceID: ${traceId}` : ""}`
    );
  }

  return res.json() as Promise<PipelineResult>;
}
