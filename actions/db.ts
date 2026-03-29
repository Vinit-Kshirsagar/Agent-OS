"use server";

import { createClient } from "@supabase/supabase-js";
import type { Project, Message, AgentOutput, FinalPrompt } from "@/types";

// Note: Server actions must aggressively rebuild the client with the Service Role key if modifying 
// secured tables in a real setting, however since we are in MVP Guest Mode we just use the anon key.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Creates a new project in Supabase
 */
export async function createProjectAction(title: string, idea_raw: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .insert([{ title, idea_raw }])
    .select()
    .single();

  if (error) {
    console.error("Supabase create project error:", error);
    return null;
  }
  return data as Project;
}

/**
 * Saves a batch of chat messages directly to Supabase
 */
export async function saveMessagesAction(projectId: string, messages: Message[]) {
  const insertData = messages.map((m) => ({
    project_id: projectId,
    role: m.role,
    sender_type: m.sender_type,
    content: m.content,
  }));

  const { error } = await supabase.from("messages").insert(insertData);

  if (error) {
    console.error("Supabase save messages error:", error);
  }
}

/**
 * Saves structured agent outputs to Supabase
 */
export async function saveAgentOutputAction(projectId: string, agent_name: string, output_json: any) {
  const { error } = await supabase
    .from("agent_outputs")
    .insert([{ project_id: projectId, agent_name, output_json }]);

  if (error) {
    console.error(`Supabase save agent output (${agent_name}) error:`, error);
  }
}

/**
 * Saves the final markdown prompt to Supabase
 */
export async function saveFinalPromptAction(projectId: string, prompt_markdown: string): Promise<FinalPrompt | null> {
  const { data, error } = await supabase
    .from("final_prompts")
    .insert([{ project_id: projectId, prompt_markdown, version: 1 }])
    .select()
    .single();

  if (error) {
    console.error("Supabase save final prompt error:", error);
    return null;
  }
  return data as FinalPrompt;
}

/**
 * Fetch all projects for the dashboard history
 */
export async function getProjectsAction(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase get projects error:", error);
    return [];
  }
  return data as Project[];
}

/**
 * Fetch messages for a specific project
 */
export async function getProjectMessagesAction(projectId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Supabase get messages error:", error);
    return [];
  }
  return data as Message[];
}
