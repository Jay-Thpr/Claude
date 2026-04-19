import { createServerSupabaseClient } from "./supabase-server";
import { logger } from "./logger";

export interface TaskMemory {
  user_id: string;
  current_task: string | null;
  last_step: string | null;
  current_url: string | null;
  page_title: string | null;
  updated_at: string;
}

export type TaskMemoryPatch = Partial<
  Pick<TaskMemory, "current_task" | "last_step" | "current_url" | "page_title">
>;

export async function getTaskMemory(userId: string): Promise<TaskMemory | null> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("task_memory")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      logger.error("memory-store", "getTaskMemory failed", error);
      return null;
    }

    return data ?? null;
  } catch (err) {
    logger.error("memory-store", "getTaskMemory threw", err);
    return null;
  }
}

export async function updateTaskMemory(
  userId: string,
  patch: TaskMemoryPatch
): Promise<void> {
  try {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from("task_memory").upsert(
      {
        user_id: userId,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      logger.error("memory-store", "updateTaskMemory failed", error);
    }
  } catch (err) {
    logger.error("memory-store", "updateTaskMemory threw", err);
  }
}
