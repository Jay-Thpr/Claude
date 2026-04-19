import { logScamCheck, getRecentScamChecks } from "@/lib/scam-store";
import { updateTaskMemory, getTaskMemory } from "@/lib/memory-store";

const DEMO_USER_ID = "demo-user-001";

export async function GET() {
  const results: Record<string, unknown> = {};

  await logScamCheck({
    user_id: DEMO_USER_ID,
    url: "http://fake-medicare-alert.xyz",
    classification: "risky",
    explanation: "Test record — this is a fake scam check written by the test route.",
    risk_signals: ["suspicious TLD", "no HTTPS", "brand mismatch"],
  });

  const recent = await getRecentScamChecks(DEMO_USER_ID, 1);
  results.scam_check_write = recent.length > 0 ? "ok" : "error — nothing written";
  results.scam_check_record = recent[0] ?? null;

  await updateTaskMemory(DEMO_USER_ID, {
    current_task: "Supabase write test",
    task_type: "appointment-prep",
    task_goal: "Check that staged task memory is stored",
    current_stage_index: 1,
    current_stage_title: "Pack what you need",
    current_stage_detail: "Put the medication list and insurance card in a bag.",
    next_stage_title: "Leave the house",
    next_stage_detail: "Grab your keys and head out early.",
    stage_plan: [
      {
        title: "Check the doctor website",
        detail: "Open the portal and confirm the visit details.",
      },
      {
        title: "Pack what you need",
        detail: "Put the medication list and insurance card in a bag.",
      },
      {
        title: "Leave the house",
        detail: "Grab your keys and head out early.",
      },
    ],
    status: "active",
    last_step: "Wrote test scam check and task memory",
    current_url: "http://localhost:3000/api/test/supabase-write",
    page_title: "Test Page",
  });

  const memory = await getTaskMemory(DEMO_USER_ID);
  results.task_memory_write =
    memory?.current_task === "Supabase write test" &&
    memory?.current_stage_title === "Pack what you need"
      ? "ok"
      : "error — nothing written";
  results.task_memory_record = memory ?? null;

  const allOk = results.scam_check_write === "ok" && results.task_memory_write === "ok";

  return Response.json({
    status: allOk ? "ok" : "partial_failure",
    ...results,
  });
}
