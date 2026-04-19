import { redirect } from "next/navigation";
import BasicInfoForm from "@/components/BasicInfoForm";
import { loadAppAccessState } from "@/lib/access-control";

export default async function OnboardingPage() {
  const access = await loadAppAccessState();

  if (!access.identity) {
    redirect("/login");
  }

  return <BasicInfoForm />;
}
