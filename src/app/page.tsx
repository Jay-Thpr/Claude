"use client";

import { Suspense, useState } from "react";
import CopilotPanel from "@/components/CopilotPanel";
import BrowserTaskArea from "@/components/BrowserTaskArea";
import CalendarNoticeBanner from "@/components/CalendarNoticeBanner";

export default function Home() {
  // Shared state between panels
  const [currentUrl, setCurrentUrl] = useState("");
  const [currentPageTitle, setCurrentPageTitle] = useState("");

  return (
    <div className="app-shell">
      <Suspense fallback={null}>
        <CalendarNoticeBanner />
      </Suspense>
      <div className="app-layout">
        {/* Left: Browser Use Task Area */}
        <BrowserTaskArea
          onUrlChange={setCurrentUrl}
          onPageTitleChange={setCurrentPageTitle}
        />

        {/* Right: AI Copilot Panel */}
        <CopilotPanel
          currentUrl={currentUrl}
          currentPageTitle={currentPageTitle}
        />
      </div>
    </div>
  );
}
