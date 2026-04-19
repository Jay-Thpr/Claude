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
    <main className="app-page px-4 py-6">
      <div className="app-page-inner flex min-h-[calc(100vh-3rem)] items-center">
        <section className="app-surface w-full p-8 sm:p-10">
          <p className="app-eyebrow">
            SafeStep sign in
          </p>
          <h1 className="app-title mt-3">
            Connect your Google account first.
          </h1>
          <p className="app-copy mt-4 max-w-2xl">
            SafeStep uses Google Calendar as the login step. After you connect, we’ll take you to
            onboarding so you can save your profile before entering the main app.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/api/gcal/connect"
              className="app-button-primary px-6 py-3 text-lg"
            >
              Continue with Google Calendar
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
