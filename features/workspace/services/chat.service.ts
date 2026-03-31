// ===========================================
// Agent OS — Chat Service
// ===========================================
// Handles all communication with /api/chat.
// No UI logic, no JSX, no state mutations.

import type { ChatMessage } from "@/types";

export interface ChatServiceResult {
  content: string;
}

export async function sendChatMessage(
  messages: ChatMessage[]
): Promise<ChatServiceResult> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      (errBody as { error?: string })?.error ?? `Chat failed (${res.status})`
    );
  }

  const data = await res.json();
  return { content: data.content as string };
}

// Detect whether the orchestrator is signalling pipeline readiness
export function shouldTriggerPipeline(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes("enough information") || lower.includes("generate your")
  );
}
