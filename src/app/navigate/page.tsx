import NavigationHub from "@/components/NavigationHub";
import { loadAppAccessState } from "@/lib/access-control";

export default async function NavigatePage() {
  const access = await loadAppAccessState();

  return (
    <NavigationHub
      identityEmail={access.identity?.email || null}
      identityName={access.identity?.name || null}
      onboarded={access.onboarded}
      loginCompletedAt={access.loginCompletedAt}
      profileCompletedAt={access.profileCompletedAt}
    />
  );
}
