// ===========================================
// Agent OS — Main Workspace Page (thin shell)
// ===========================================
// This file only composes components.
// All state lives in useWorkspace + useProject.
// All API calls live in features/workspace/services/.

"use client";

import { Suspense } from "react";
import { useProject } from "@/features/workspace/hooks/useProject";
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace";
import { Header } from "@/features/workspace/components/Header";
import { Sidebar } from "@/features/workspace/components/Sidebar";
import { IdeaInput } from "@/features/workspace/components/IdeaInput";
import { ChatPanel } from "@/features/workspace/components/ChatPanel";
import { BriefPanel } from "@/features/workspace/components/BriefPanel";

function WorkspaceInner() {
  const {
    projectId,
    setProjectId,
    pastProjects,
    setPastProjects,
    isLoadingHistory,
    loadProjectContext,
  } = useProject();

  const ws = useWorkspace(projectId, setProjectId);

  const handleSelectProject = (id: string, idea: string) => {
    loadProjectContext(
      id,
      idea,
      ws.setPhase,
      ws.setMessages,
      ws.setRawIdea,
      ws.resetPipeline
    );
  };

  const isActivePhase =
    ws.phase === "chatting" ||
    ws.phase === "processing" ||
    ws.phase === "done" ||
    ws.phase === "error";

  return (
    <div className="h-screen flex flex-col">
      <Header phase={ws.phase} onNewProject={ws.handleNewProject} />

      <div className="flex-1 flex overflow-hidden">
        {ws.phase === "idea" && (
          <IdeaInput
            rawIdea={ws.rawIdea}
            onIdeaChange={ws.setRawIdea}
            onSubmit={ws.handleStartProject}
            onKeyDown={ws.handleKeyDown}
            pastProjects={pastProjects}
            isLoadingHistory={isLoadingHistory}
            onSelectProject={handleSelectProject}
          />
        )}

        {isActivePhase && (
          <>
            <Sidebar
              phase={ws.phase}
              projectId={projectId}
              pastProjects={pastProjects}
              agentStatuses={ws.agentStatuses}
              messageCount={ws.messages.length}
              onNewProject={ws.handleNewProject}
              onSelectProject={handleSelectProject}
              onGenerateNow={ws.handleGenerateNow}
              onRetryPipeline={ws.handleRetryPipeline}
            />
            <ChatPanel
              messages={ws.messages}
              isAiTyping={ws.isAiTyping}
              phase={ws.phase}
              inputValue={ws.inputValue}
              onInputChange={ws.setInputValue}
              onKeyDown={ws.handleKeyDown}
              onSend={ws.handleSendChat}
              onRetry={ws.handleRetryPipeline}
            />
            <BriefPanel
              phase={ws.phase}
              pipelineResult={ws.pipelineResult}
              finalMarkdown={ws.finalMarkdown}
              activeTab={ws.activeTab}
              copied={ws.copied}
              onTabChange={ws.setActiveTab}
              onCopy={ws.handleCopy}
              onExport={ws.handleExport}
              onRegenerate={ws.handleRegenerate}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense>
      <WorkspaceInner />
    </Suspense>
  );
}
