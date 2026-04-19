import { runBrowserTask } from "@/lib/browser-use";

const CVS_TASK = [
  "Go to https://www.cvs.com.",
  "Search for 'daily multivitamin'.",
  "Click the first product result.",
  "Click 'Add to Cart'.",
  "Go back to https://www.cvs.com.",
  "Search for 'blood pressure monitor'.",
  "Click the first product result.",
  "Click 'Add to Cart'.",
  "Go back to https://www.cvs.com.",
  "Search for 'bandages'.",
  "Click the first product result.",
  "Click 'Add to Cart'.",
  "Navigate to the cart page (https://www.cvs.com/cart) to confirm all 3 items are there.",
  "STOP. Do NOT proceed to checkout. Do NOT enter any payment or personal information.",
].join(" ");

export async function POST(): Promise<Response> {
  const result = await runBrowserTask(CVS_TASK, {
    url: "https://www.cvs.com",
    title: "CVS Pharmacy",
  }, { headless: false });

  if (!result.success) {
    return Response.json(
      { success: false, error: result.error ?? "Browser agent failed to start." },
      { status: 503 }
    );
  }

  return Response.json({
    success: true,
    task_id: result.task_id,
    message: "CVS order started. Adding multivitamin, blood pressure monitor, and bandages to your cart.",
  });
}
