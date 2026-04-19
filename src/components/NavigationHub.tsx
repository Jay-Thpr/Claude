"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type NavigationHubProps = {
  identityEmail?: string | null;
  identityName?: string | null;
  onboarded: boolean;
  loginCompletedAt?: string | null;
  profileCompletedAt?: string | null;
};

type ActionCardProps = {
  href: string;
  title: string;
  description: string;
  cta: string;
};

function ActionCard({ href, title, description, cta }: ActionCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-[24px] border border-surface-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-700">
        {title}
      </p>
      <p className="mt-3 text-base leading-7 text-text-secondary">{description}</p>
      <p className="mt-4 text-base font-semibold text-primary-700 transition group-hover:text-primary-600">
        {cta}
      </p>
    </Link>
  );
}

export default function NavigationHub({
  identityEmail,
  identityName,
  onboarded,
  loginCompletedAt,
  profileCompletedAt,
}: NavigationHubProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError(null);

    try {
      const res = await fetch("/api/gcal/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Unable to log out right now.");
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Unable to log out right now.");
      setLoggingOut(false);
    }
  };

  return (
    <main className="app-page px-4 py-6">
      <div className="app-page-inner min-h-[calc(100vh-3rem)]">
        <section className="app-surface overflow-hidden">
          <div className="border-b border-surface-200 bg-[radial-gradient(circle_at_top_left,_rgba(53,176,159,0.12),_transparent_40%)] px-6 py-5 sm:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="app-eyebrow">Navigation</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
                  Choose what you want to do next.
                </h1>
                <p className="app-copy mt-4 max-w-3xl">
                  Use this hub to sign in or out, open onboarding, paste medical-history notes,
                  and update the form whenever something changes.
                </p>
              </div>

              <div className="rounded-[22px] border border-surface-200 bg-white/90 px-4 py-4 text-sm text-text-secondary shadow-sm">
                <p className="font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Current status
                </p>
                <p className="mt-2 text-base font-semibold text-text-primary">
                  {identityName || identityEmail || "Not signed in"}
                </p>
                <p className="mt-1">
                  {onboarded ? "Onboarding is complete." : "Onboarding is not complete yet."}
                </p>
                <p className="mt-3">
                  {loginCompletedAt
                    ? "Google Calendar is connected."
                    : "Google Calendar is not connected."}
                </p>
                {profileCompletedAt ? (
                  <p className="mt-1">
                    Profile last saved on {new Date(profileCompletedAt).toLocaleDateString()}.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-6 sm:p-8 lg:grid-cols-2">
            <div className="rounded-[24px] border border-surface-200 bg-surface-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                Login and logout
              </p>
              <p className="mt-3 text-base leading-7 text-text-secondary">
                Connect your Google Calendar to sign in, or disconnect it to log out and clear the
                browser cookies SafeStep uses for access.
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Link href="/login" className="app-button-primary px-5 py-3 text-base">
                  Go to login
                </Link>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut || !identityEmail}
                  className="rounded-2xl border border-surface-200 bg-white px-5 py-3 text-base font-semibold text-text-primary transition hover:border-primary-300 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loggingOut ? "Logging out..." : "Log out"}
                </button>
              </div>

              {logoutError ? (
                <p className="mt-3 rounded-2xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm font-medium text-danger">
                  {logoutError}
                </p>
              ) : null}
            </div>

            <div className="rounded-[24px] border border-surface-200 bg-white p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                Quick actions
              </p>
              <div className="mt-5 grid gap-4">
                <ActionCard
                  href="/onboarding/paste"
                  title="Paste information"
                  description="Paste a short medical-history summary so SafeStep can turn it into a structured profile."
                  cta="Open paste form"
                />
                <ActionCard
                  href="/onboarding/basic-info"
                  title="Fill in the form"
                  description="Enter your name, timezone, support needs, preferences, and conditions directly."
                  cta="Open basic info form"
                />
                <ActionCard
                  href="/"
                  title="Return to SafeStep"
                  description="Go back to the main assistant view after you finish signing in or updating your profile."
                  cta="Open assistant"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
