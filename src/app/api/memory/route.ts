import { getTaskMemory, updateTaskMemory } from "@/lib/memory-store";

const DEMO_USER_ID = "demo-user-001";

export async function GET() {
  const memory = await getTaskMemory(DEMO_USER_ID);
  return Response.json({
    current_task: memory?.current_task ?? null,
    task_type: memory?.task_type ?? null,
    task_goal: memory?.task_goal ?? null,
    current_stage_index: memory?.current_stage_index ?? null,
    current_stage_title: memory?.current_stage_title ?? null,
    current_stage_detail: memory?.current_stage_detail ?? null,
    next_stage_title: memory?.next_stage_title ?? null,
    next_stage_detail: memory?.next_stage_detail ?? null,
    stage_plan: memory?.stage_plan ?? [],
    status: memory?.status ?? null,
    last_step: memory?.last_step ?? null,
    current_url: memory?.current_url ?? null,
    page_title: memory?.page_title ?? null,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      current_task,
      task_type,
      task_goal,
      current_stage_index,
      current_stage_title,
      current_stage_detail,
      next_stage_title,
      next_stage_detail,
      stage_plan,
      status,
      last_step,
      current_url,
      page_title,
    } = body;
    await updateTaskMemory(DEMO_USER_ID, {
      current_task,
      task_type,
      task_goal,
      current_stage_index,
      current_stage_title,
      current_stage_detail,
      next_stage_title,
      next_stage_detail,
      stage_plan,
      status,
      last_step,
      current_url,
      page_title,
    });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed to update memory" }, { status: 500 });
  }
}
