import { createServerSupabaseClient } from "@/lib/supabase-server";

// For hackathon MVP, use a fixed demo user ID
const DEMO_USER_ID = "demo-user-001";

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("task_memory")
      .select("*")
      .eq("user_id", DEMO_USER_ID)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned, which is fine
      console.error("Memory fetch error:", error);
    }

    return Response.json({
      current_task: data?.current_task || null,
      last_step: data?.last_step || null,
      current_url: data?.current_url || null,
      page_title: data?.page_title || null,
    });
  } catch (err) {
    console.error("Memory route error:", err);
    return Response.json(
      { error: "Failed to fetch memory" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { current_task, last_step, current_url, page_title } = body;

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.from("task_memory").upsert(
      {
        user_id: DEMO_USER_ID,
        current_task,
        last_step,
        current_url,
        page_title,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("Memory update error:", error);
      return Response.json(
        { error: "Failed to update memory" },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Memory route error:", err);
    return Response.json(
      { error: "Failed to update memory" },
      { status: 500 }
    );
  }
}
