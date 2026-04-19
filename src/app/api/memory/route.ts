import { getTaskMemory, updateTaskMemory } from "@/lib/memory-store";

const DEMO_USER_ID = "demo-user-001";

export async function GET() {
  const memory = await getTaskMemory(DEMO_USER_ID);
  return Response.json({
    current_task: memory?.current_task ?? null,
    last_step: memory?.last_step ?? null,
    current_url: memory?.current_url ?? null,
    page_title: memory?.page_title ?? null,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { current_task, last_step, current_url, page_title } = body;
    await updateTaskMemory(DEMO_USER_ID, { current_task, last_step, current_url, page_title });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed to update memory" }, { status: 500 });
  }
}
