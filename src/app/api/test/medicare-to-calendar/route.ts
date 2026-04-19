import { extractFromPage } from "@/lib/browser-use";
import { createAppointment } from "@/lib/google-calendar";

export async function GET() {
  // Step 1: Extract Medicare contact info via Browser Use
  const extracted = await extractFromPage(
    "Go to medicare.gov. Find the main customer service phone number. " +
    "Return only the phone number and a one-sentence description of what it is for."
  );

  if (!extracted) {
    return Response.json({
      status: "error",
      message: "Browser Use extraction failed. Is the Python backend running on port 8000?",
    }, { status: 503 });
  }

  // Step 2: Create a Google Calendar event with the extracted info
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  let eventId: string;
  try {
    eventId = await createAppointment(
      "Call Medicare",
      tomorrow,
      30,
      `Contact info found on medicare.gov:\n${extracted}`
    );
  } catch {
    return Response.json({
      status: "error",
      message: "Browser Use worked but Google Calendar write failed.",
      extracted,
    }, { status: 500 });
  }

  return Response.json({
    status: "ok",
    message: "Browser Use extracted Medicare info and created a Google Calendar event.",
    extracted,
    eventId,
    scheduledFor: tomorrow.toISOString(),
  });
}
