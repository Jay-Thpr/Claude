import { redirect } from "next/navigation";
import HomeShell from "@/components/HomeShell";
import { loadAppAccessState } from "@/lib/access-control";

export default async function Home() {
  const access = await loadAppAccessState();

  if (!access.identity) {
    redirect("/login");
  }

  if (!access.onboarded) {
    redirect("/onboarding");
  }

  return <HomeShell />;
}
