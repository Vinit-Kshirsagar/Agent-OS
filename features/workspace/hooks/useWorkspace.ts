// ===========================================
// Agent OS — useWorkspace Hook
// ===========================================
// Central state coordinator for the workspace.
// Orchestrates chat, pipeline, and project flows.
// No JSX. No direct fetch() calls (delegates to services).

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import type { ChatMessage } from "@/types";
import type { WorkspacePhase, AgentStatus } from "@/types/workspace";
import { DEFAULT_AGENT_STATUSES } from "@/types/workspace";
import type { PipelineResult } from "@/agents/orchestrator";
import { formatFinalPrompt } from "@/utils/format-prompt";
import {
  saveAgentOutputAction,
  saveFinalPromptAction,
} from "@/actions/db";
import { sendChatMessage, shouldTriggerPipeline } from "../services/chat.service";
import { runPipelineRequest } from "../services/pipeline.service";
import { createProject, persistMessage } from "../services/project.service";

export interface UseWorkspaceReturn {
  // State
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  phase: WorkspacePhase;
  setPhase: (p: WorkspacePhase) => void;
  rawIdea: string;
  setRawIdea: (s: string) => void;
  messages: ChatMessage[];
  setMessages: (m: ChatMessage[]) => void;
  inputValue: string;
  setInputValue: (s: string) => void;
  isAiTyping: boolean;
  pipelineResult: PipelineResult | null;
  finalMarkdown: string;
  copied: boolean;
  agentStatuses: AgentStatus[];
  activeTab: "brief" | "prompt";
  setActiveTab: (t: "brief" | "prompt") => void;
  // Actions
  handleStartProject: () => Promise<void>;
  handleSendChat: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleGenerateNow: () => void;
  handleRegenerate: () => void;
  handleRetryPipeline: () => void;
  handleCopy: () => Promise<void>;
  handleExport: () => void;
  handleNewProject: () => void;
  resetPipeline: () => void;
}

export function useWorkspace(
  projectId: string | null,
  setProjectId: (id: string | null) => void
): UseWorkspaceReturn {
  const router = useRouter();
  const { toast } = useToast();

  const [phase, setPhase] = useState<WorkspacePhase>("idea");
  const [rawIdea, setRawIdea] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [finalMarkdown, setFinalMarkdown] = useState("");
  const [copied, setCopied] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>(
    DEFAULT_AGENT_STATUSES.map((a) => ({ ...a }))
  );
  const [activeTab, setActiveTab] = useState<"brief" | "prompt">("brief");

  // ── Helpers ──────────────────────────────────────────────

  const updateAgentStatus = useCallback(
    (index: number, status: AgentStatus["status"]) => {
      setAgentStatuses((prev) =>
        prev.map((a, i) => (i === index ? { ...a, status } : a))
      );
    },
    []
  );

  const resetPipeline = useCallback(() => {
    setPipelineResult(null);
    setFinalMarkdown("");
    setAgentStatuses(DEFAULT_AGENT_STATUSES.map((a) => ({ ...a })));
  }, []);

  // ── Pipeline ─────────────────────────────────────────────

  const runPipeline = useCallback(
    async (chatMessages: ChatMessage[], activeProjectId?: string | null) => {
      setPhase("processing");

      try {
        const result = await runPipelineRequest(chatMessages, updateAgentStatus);

        setPipelineResult(result);
        setAgentStatuses((prev) => prev.map((a) => ({ ...a, status: "done" })));

        const md = formatFinalPrompt(result.finalPrompt);
        setFinalMarkdown(md);

        const pid = activeProjectId ?? projectId;
        if (pid) {
          saveAgentOutputAction(pid, "requirement_analyst", result.requirements);
          saveAgentOutputAction(pid, "product_strategist", result.strategy);
          saveAgentOutputAction(pid, "technical_architect", result.architecture);
          saveFinalPromptAction(pid, md);
        }

        setPhase("done");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        console.error("Pipeline error:", err);
        toast({ variant: "destructive", title: "Pipeline failed", description: message });
        setPhase("error");
        setAgentStatuses(DEFAULT_AGENT_STATUSES.map((a) => ({ ...a })));
      }
    },
    [projectId, toast, updateAgentStatus]
  );

  // ── Chat ─────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (
      content: string,
      existingMessages?: ChatMessage[],
      currentProjectId?: string | null
    ) => {
      const activeProjectId = currentProjectId ?? projectId;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        sender_type: "user",
        content,
        timestamp: new Date(),
      };

      const allMsgs = [...(existingMessages ?? messages), userMsg];
      setMessages(allMsgs);
      setInputValue("");
      setIsAiTyping(true);

      if (activeProjectId) {
        await persistMessage(activeProjectId, userMsg);
      }

      try {
        const { content: aiContent } = await sendChatMessage(allMsgs);

        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          sender_type: "orchestrator",
          content: aiContent,
          timestamp: new Date(),
        };

        const updatedMsgs = [...allMsgs, aiMsg];
        setMessages(updatedMsgs);

        if (activeProjectId) {
          await persistMessage(activeProjectId, aiMsg);
        }

        if (shouldTriggerPipeline(aiContent)) {
          setTimeout(() => runPipeline(updatedMsgs, activeProjectId), 1500);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to reach the AI.";
        console.error("Chat error:", err);
        toast({ variant: "destructive", title: "Message failed", description: message });

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            sender_type: "orchestrator",
            content: "Something went wrong. Please try sending your message again.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsAiTyping(false);
      }
    },
    [messages, projectId, runPipeline, toast]
  );

  // ── Handlers ─────────────────────────────────────────────

  const handleStartProject = useCallback(async () => {
    if (!rawIdea.trim()) return;
    const result = await createProject(rawIdea);
    if (!result) return;

    const { project, newId } = result;
    setProjectId(newId);
    setPhase("chatting");
    router.replace(`/?id=${newId}`, { scroll: false });
    sendMessage(rawIdea, [], newId);

    return project;
  }, [rawIdea, setProjectId, router, sendMessage]);

  const handleSendChat = useCallback(() => {
    if (!inputValue.trim() || isAiTyping) return;
    sendMessage(inputValue);
  }, [inputValue, isAiTyping, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (phase === "idea") handleStartProject();
        else handleSendChat();
      }
    },
    [phase, handleStartProject, handleSendChat]
  );

  const handleGenerateNow = useCallback(() => {
    if (messages.length < 2) return;
    runPipeline(messages);
  }, [messages, runPipeline]);

  const handleRegenerate = useCallback(() => {
    resetPipeline();
    runPipeline(messages);
  }, [messages, resetPipeline, runPipeline]);

  const handleRetryPipeline = useCallback(() => {
    setAgentStatuses(DEFAULT_AGENT_STATUSES.map((a) => ({ ...a })));
    runPipeline(messages);
  }, [messages, runPipeline]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(finalMarkdown);
    setCopied(true);
    toast({ title: "Copied!", description: "Prompt copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  }, [finalMarkdown, toast]);

  const handleExport = useCallback(() => {
    const blob = new Blob([finalMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${
      pipelineResult?.finalPrompt.product_name
        ?.replace(/\s+/g, "-")
        .toLowerCase() ?? "project"
    }-prompt.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [finalMarkdown, pipelineResult]);

  const handleNewProject = useCallback(() => {
    localStorage.removeItem("agent_os_current_project");
    router.replace("/", { scroll: false });
    setProjectId(null);
    setPhase("idea");
    setRawIdea("");
    setMessages([]);
    setInputValue("");
    resetPipeline();
    setActiveTab("brief");
  }, [router, setProjectId, resetPipeline]);

  return {
    projectId,
    setProjectId,
    phase,
    setPhase,
    rawIdea,
    setRawIdea,
    messages,
    setMessages,
    inputValue,
    setInputValue,
    isAiTyping,
    pipelineResult,
    finalMarkdown,
    copied,
    agentStatuses,
    activeTab,
    setActiveTab,
    handleStartProject,
    handleSendChat,
    handleKeyDown,
    handleGenerateNow,
    handleRegenerate,
    handleRetryPipeline,
    handleCopy,
    handleExport,
    handleNewProject,
    resetPipeline,
  };
}
