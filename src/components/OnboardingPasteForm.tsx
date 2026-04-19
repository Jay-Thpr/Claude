"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export default function OnboardingPasteForm() {
  const router = useRouter();
  const redirectedRef = useRef(false);
  const [intakeText, setIntakeText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = intakeText.trim();
    if (!trimmed) {
      setMessage("Paste your medical history or notes first.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/onboarding/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intakeText: trimmed }),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Unable to save your profile.");
      }

      redirectedRef.current = true;
      router.push("/navigate");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save your profile.");
    } finally {
      if (!redirectedRef.current) {
        setSaving(false);
      }
    }
  };

  return (
    <main className="app-page px-4 py-6">
      <div className="app-page-inner flex min-h-[calc(100vh-3rem)] items-center">
        <section className="app-surface w-full p-8 sm:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="app-eyebrow">Paste intake</p>
              <h1 className="mt-3 app-title">Paste your information.</h1>
              <p className="app-copy mt-4 max-w-3xl">
                Add a short medical-history summary, medication list, or any notes you want SafeStep
                to remember. We will turn it into a structured profile.
              </p>
            </div>
            <Link
              href="/navigate"
              className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-base font-semibold text-text-primary transition hover:border-primary-300 hover:bg-primary-50"
            >
              Back to navigation
            </Link>
          </div>

          <textarea
            value={intakeText}
            onChange={(event) => setIntakeText(event.target.value)}
            placeholder="Example: I have a cardiology follow-up tomorrow. I take blood pressure medicine and need reminders about the steps..."
            className="mt-8 min-h-56 w-full rounded-[24px] border border-surface-200 bg-surface-50 px-4 py-4 text-lg outline-none transition focus:border-primary-400"
          />

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving}
              className="app-button-primary px-6 py-3 text-lg"
            >
              {saving ? "Saving..." : "Save pasted information"}
            </button>
            <Link
              href="/onboarding/basic-info"
              className="rounded-2xl border border-surface-200 bg-white px-6 py-3 text-lg font-semibold text-text-primary transition hover:border-primary-300 hover:bg-primary-50"
            >
              Use the form instead
            </Link>
          </div>

          {message ? (
            <p className="mt-4 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-base text-text-secondary">
              {message}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
