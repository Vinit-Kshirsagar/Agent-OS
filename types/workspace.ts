// ===========================================
// Agent OS — Workspace UI Types
// ===========================================
// Extracted from app/page.tsx to keep types/index.ts clean.

export type WorkspacePhase = "idea" | "chatting" | "processing" | "done" | "error";

export interface AgentStatus {
  name: string;
  status: "pending" | "running" | "done";
}

export const DEFAULT_AGENT_STATUSES: AgentStatus[] = [
  { name: "Requirement Analyst", status: "pending" },
  { name: "Product Strategist", status: "pending" },
  { name: "Technical Architect", status: "pending" },
  { name: "Prompt Engineer", status: "pending" },
];
