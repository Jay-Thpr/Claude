"use client";

import { useState } from "react";
import CopilotPanel from "@/components/CopilotPanel";
import BrowserTaskArea from "@/components/BrowserTaskArea";

export default function Home() {
  // Shared state between panels
  const [currentUrl, setCurrentUrl] = useState("");
  const [currentPageTitle, setCurrentPageTitle] = useState("");

  return (
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
  );
}
