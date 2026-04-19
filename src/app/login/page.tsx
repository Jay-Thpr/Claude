import Link from "next/link";
import { redirect } from "next/navigation";
import { loadAppAccessState } from "@/lib/access-control";

export default async function LoginPage() {
  const access = await loadAppAccessState();

  if (access.identity && access.onboarded) {
    redirect("/");
  }

  if (access.identity && !access.onboarded) {
    redirect("/onboarding");
  }

  return (
    <main className="min-h-screen overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(53,176,159,0.18),_transparent_28%),linear-gradient(180deg,#fdfbf8_0%,#f2eee7_100%)] px-4 py-6 text-text-primary">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-4xl items-center">
        <section className="w-full rounded-[32px] border border-surface-200 bg-white/95 p-8 shadow-sm backdrop-blur sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary-700">
            SafeStep sign in
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
            Connect your Google account first.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-text-secondary">
            SafeStep uses Google Calendar as the login step. After you connect, we’ll take you to
            onboarding so you can save your profile before entering the main app.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/api/gcal/connect"
              className="inline-flex items-center justify-center rounded-2xl bg-primary-500 px-6 py-3 text-lg font-semibold text-white transition hover:bg-primary-600"
            >
              Continue with Google Calendar
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
