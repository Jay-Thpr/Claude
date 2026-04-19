import { redirect } from "next/navigation";
import OnboardingPasteForm from "@/components/OnboardingPasteForm";
import { loadAppAccessState } from "@/lib/access-control";

export default async function PasteOnboardingPage() {
  const access = await loadAppAccessState();

  if (!access.identity) {
    redirect("/login");
  }

  return <OnboardingPasteForm />;
}
