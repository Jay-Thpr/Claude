"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

type BasicInfoFormState = {
  name: string;
  email: string;
  timezone: string;
  ageGroup: string;
  supportNeeds: string;
  preferences: string;
  conditions: string;
  notes: string;
  calendarConnected: boolean;
};

function splitTextList(text: string) {
  return text
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function BasicInfoForm() {
  const router = useRouter();
  const redirectedRef = useRef(false);
  const [form, setForm] = useState<BasicInfoFormState>({
    name: "",
    email: "",
    timezone: "America/Los_Angeles",
    ageGroup: "older adult",
    supportNeeds: "",
    preferences: "",
    conditions: "",
    notes: "",
    calendarConnected: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewLists = useMemo(
    () => ({
      supportNeeds: splitTextList(form.supportNeeds),
      preferences: splitTextList(form.preferences),
      conditions: splitTextList(form.conditions),
    }),
    [form.supportNeeds, form.preferences, form.conditions],
  );

  const updateField = <K extends keyof BasicInfoFormState>(key: K, value: BasicInfoFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding/basic-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email || undefined,
          timezone: form.timezone,
          ageGroup: form.ageGroup,
          supportNeeds: previewLists.supportNeeds,
          preferences: previewLists.preferences,
          conditions: previewLists.conditions,
          notes: form.notes,
          calendarConnected: form.calendarConnected,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to save your information.");
      }

      redirectedRef.current = true;
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your information.");
    } finally {
      if (!redirectedRef.current) {
        setSaving(false);
      }
    }
  };

  return (
    <main className="min-h-screen overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(53,176,159,0.16),_transparent_32%),linear-gradient(180deg,#fbf8f4_0%,#f1ede7_100%)] px-4 py-6 text-text-primary">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary-700">
              Onboarding
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">
              Basic information
            </h1>
          </div>
          <Link
            href="/onboarding"
            className="rounded-2xl border border-surface-200 bg-white px-4 py-3 text-base font-semibold text-text-primary transition hover:border-primary-300 hover:bg-primary-50"
          >
            Back
          </Link>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6 rounded-[28px] border border-surface-200 bg-white p-6 shadow-sm">
          <section className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                Name
              </span>
              <input
                required
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-lg outline-none transition focus:border-primary-400"
                placeholder="Maria Garcia"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                Email
              </span>
              <input
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-lg outline-none transition focus:border-primary-400"
                placeholder="maria@example.com"
              />
            </label>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                Age group
              </span>
              <select
                value={form.ageGroup}
                onChange={(event) => updateField("ageGroup", event.target.value)}
                className="w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-lg outline-none transition focus:border-primary-400"
              >
                <option value="">Choose one</option>
                <option value="older adult">Older adult</option>
                <option value="adult">Adult</option>
                <option value="caregiver">Caregiver</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                Timezone
              </span>
              <input
                value={form.timezone}
                onChange={(event) => updateField("timezone", event.target.value)}
                className="w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-lg outline-none transition focus:border-primary-400"
                placeholder="America/Los_Angeles"
              />
            </label>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                Support needs
              </span>
              <textarea
                value={form.supportNeeds}
                onChange={(event) => updateField("supportNeeds", event.target.value)}
                className="min-h-36 w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-lg outline-none transition focus:border-primary-400"
                placeholder="Short, calm directions, reminders about the last step"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                Preferences
              </span>
              <textarea
                value={form.preferences}
                onChange={(event) => updateField("preferences", event.target.value)}
                className="min-h-36 w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-lg outline-none transition focus:border-primary-400"
                placeholder="One step at a time, simple wording"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                Conditions
              </span>
              <textarea
                value={form.conditions}
                onChange={(event) => updateField("conditions", event.target.value)}
                className="min-h-36 w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-lg outline-none transition focus:border-primary-400"
                placeholder="Memory support, appointment tracking help"
              />
            </label>
          </section>

          <section className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                Notes
              </span>
              <textarea
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                className="min-h-36 w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-lg outline-none transition focus:border-primary-400"
                placeholder="Anything SafeStep should remember about how to help you."
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4 text-base font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={form.calendarConnected}
                onChange={(event) => updateField("calendarConnected", event.target.checked)}
                className="h-5 w-5 rounded border-surface-300"
              />
              Calendar connected
            </label>
          </section>

          <section className="rounded-[24px] border border-primary-100 bg-primary-50 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-700">
              Preview
            </p>
            <div className="mt-3 grid gap-2 text-base text-text-secondary md:grid-cols-3">
              <p><span className="font-semibold text-text-primary">Support:</span> {previewLists.supportNeeds.length || 0}</p>
              <p><span className="font-semibold text-text-primary">Preferences:</span> {previewLists.preferences.length || 0}</p>
              <p><span className="font-semibold text-text-primary">Conditions:</span> {previewLists.conditions.length || 0}</p>
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-primary-500 px-5 py-3 text-lg font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save basic info"}
            </button>
            <Link
              href="/"
              className="rounded-2xl border border-surface-200 bg-surface-50 px-5 py-3 text-lg font-semibold text-text-primary transition hover:border-primary-300 hover:bg-primary-50"
            >
              Back to SafeStep
            </Link>
          </div>

          {error ? (
            <p className="rounded-2xl border border-danger/20 bg-danger-bg px-4 py-3 text-base font-medium text-danger">
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </main>
  );
}
