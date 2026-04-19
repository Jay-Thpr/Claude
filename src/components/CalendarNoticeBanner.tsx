"use client";

import { useSearchParams } from "next/navigation";

export default function CalendarNoticeBanner() {
  const searchParams = useSearchParams();
  const gcalNotice = searchParams.get("gcal");
  const gcalMessage = searchParams.get("message");

  if (
    gcalNotice !== "connected" &&
    gcalNotice !== "error" &&
    gcalNotice !== "denied"
  ) {
    return null;
  }

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-surface-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-base font-semibold text-text-primary">
        {gcalNotice === "connected"
          ? "Google Calendar connected."
          : gcalNotice === "denied"
            ? "Google Calendar connection was canceled."
            : "Google Calendar connection needs attention."}
      </p>
      {gcalMessage ? (
        <p className="mt-1 text-sm text-text-secondary">{gcalMessage}</p>
      ) : null}
    </div>
  );
}
