import type { NextRequest } from "next/server";
import { updateAppointment } from "@/lib/google-calendar";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, startTime, durationMinutes, notes, location } = body;
    const parsedStartTime =
      typeof startTime === "string" && startTime.trim() ? new Date(startTime) : undefined;

    if (
      title === undefined &&
      startTime === undefined &&
      durationMinutes === undefined &&
      notes === undefined &&
      location === undefined
    ) {
      return Response.json(
        { error: "At least one field must be provided to update the appointment" },
        { status: 400 },
      );
    }

    if (parsedStartTime && Number.isNaN(parsedStartTime.getTime())) {
      return Response.json({ error: "startTime must be a valid date" }, { status: 400 });
    }

    await updateAppointment(id, {
      title,
      startTime: parsedStartTime,
      durationMinutes: typeof durationMinutes === "number" ? durationMinutes : undefined,
      notes,
      location,
    });
    return Response.json({ success: true, eventId: id });
  } catch (error) {
    console.error("Failed to update appointment:", error);
    return Response.json({ error: "Failed to update appointment" }, { status: 500 });
  }
}
