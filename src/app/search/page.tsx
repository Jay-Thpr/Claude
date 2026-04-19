import { Suspense } from "react";
import LocalSearchPage from "@/components/LocalSearchPage";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="local-search-shell" />}>
      <LocalSearchPage />
    </Suspense>
  );
}
