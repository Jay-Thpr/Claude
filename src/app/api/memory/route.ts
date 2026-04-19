import { getTaskMemory, updateTaskMemory } from "../../../lib/memory-store";

type MemoryDependencies = {
  getTaskMemory?: typeof getTaskMemory;
  updateTaskMemory?: typeof updateTaskMemory;
};

const DEMO_USER_ID = "demo-user-001";

export async function GET() {
  return handleMemoryRequest(new Request("http://localhost/api/memory"));
}

export async function handleMemoryRequest(
  request: Request,
  deps: MemoryDependencies = {},
) {
  void request;
  const load = deps.getTaskMemory ?? getTaskMemory;
  const memory = await load(DEMO_USER_ID);
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
  return handleMemoryPostRequest(request);
}

export async function handleMemoryPostRequest(
  request: Request,
  deps: MemoryDependencies = {},
) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const save = deps.updateTaskMemory ?? updateTaskMemory;
    const userId =
      typeof body.user_id === "string" && body.user_id.trim() ? body.user_id : DEMO_USER_ID;
    const current_task = typeof body.current_task === "string" ? body.current_task : null;
    const task_type = typeof body.task_type === "string" ? body.task_type : null;
    const task_goal = typeof body.task_goal === "string" ? body.task_goal : null;
    const current_stage_index =
      typeof body.current_stage_index === "number" ? body.current_stage_index : null;
    const current_stage_title =
      typeof body.current_stage_title === "string" ? body.current_stage_title : null;
    const current_stage_detail =
      typeof body.current_stage_detail === "string" ? body.current_stage_detail : null;
    const next_stage_title =
      typeof body.next_stage_title === "string" ? body.next_stage_title : null;
    const next_stage_detail =
      typeof body.next_stage_detail === "string" ? body.next_stage_detail : null;
    const stage_plan = Array.isArray(body.stage_plan) ? body.stage_plan : null;
    const status = typeof body.status === "string" ? body.status : null;
    const last_step = typeof body.last_step === "string" ? body.last_step : null;
    const current_url = typeof body.current_url === "string" ? body.current_url : null;
    const page_title = typeof body.page_title === "string" ? body.page_title : null;
    await save(userId, {
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
