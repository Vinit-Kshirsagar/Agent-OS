// ===========================================
// Agent OS — useProject Hook
// ===========================================
// Manages project history, loading, and the
// active project context. Connects to project.service.ts.

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Project, ChatMessage } from "@/types";
import type { WorkspacePhase } from "@/types/workspace";
import {
  fetchProjectHistory,
  loadProjectMessages,
} from "../services/project.service";

export interface UseProjectReturn {
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  pastProjects: Project[];
  setPastProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  isLoadingHistory: boolean;
  loadProjectContext: (
    id: string,
    initialIdea: string,
    setPhase: (p: WorkspacePhase) => void,
    setMessages: (m: ChatMessage[]) => void,
    setRawIdea: (s: string) => void,
    resetPipeline: () => void
  ) => Promise<void>;
}

export function useProject(): UseProjectReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("id");

  const [projectId, setProjectId] = useState<string | null>(null);
  const [pastProjects, setPastProjects] = useState<Project[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    async function init() {
      setIsLoadingHistory(true);
      const projects = await fetchProjectHistory();
      setPastProjects(projects);

      const targetId =
        queryProjectId ?? localStorage.getItem("agent_os_current_project");

      if (targetId) {
        const found = projects.find((p) => p.id === targetId);
        if (found) setProjectId(found.id);
      }

      setIsLoadingHistory(false);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryProjectId]);

  const loadProjectContext = async (
    id: string,
    initialIdea: string,
    setPhase: (p: WorkspacePhase) => void,
    setMessages: (m: ChatMessage[]) => void,
    setRawIdea: (s: string) => void,
    resetPipeline: () => void
  ) => {
    setProjectId(id);
    localStorage.setItem("agent_os_current_project", id);
    router.replace(`/?id=${id}`, { scroll: false });

    const { messages, hasMessages } = await loadProjectMessages(id);

    if (hasMessages) {
      setMessages(messages);
      setPhase("chatting");
    } else {
      setMessages([]);
      setRawIdea(initialIdea);
      setPhase("idea");
    }

    resetPipeline();
  };

  return {
    projectId,
    setProjectId,
    pastProjects,
    setPastProjects,
    isLoadingHistory,
    loadProjectContext,
  };
}
