"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import CopilotPanel from "@/components/CopilotPanel";
import BrowserTaskArea from "@/components/BrowserTaskArea";
import CalendarNoticeBanner from "@/components/CalendarNoticeBanner";

export default function Home() {
  const [currentUrl, setCurrentUrl] = useState("");
  const [currentPageTitle, setCurrentPageTitle] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const openPanel = () => {
    if (closing) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setClosing(false);
    }
    setPanelOpen(true);
  };

  const closePanel = () => {
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setPanelOpen(false);
      setClosing(false);
    }, 200);
  };

  const togglePanel = () => {
    if (panelOpen && !closing) {
      closePanel();
    } else {
      openPanel();
    }
  };

  return (
    <div className="app-shell">
      <Suspense fallback={null}>
        <CalendarNoticeBanner />
      </Suspense>

      {/* Full-screen browser area */}
      <BrowserTaskArea
        onUrlChange={setCurrentUrl}
        onPageTitleChange={setCurrentPageTitle}
      />

      {/* Overlay copilot panel */}
      {panelOpen && (
        <div className={`overlay-panel${closing ? " overlay-panel-closing" : ""}`}>
          <CopilotPanel
            currentUrl={currentUrl}
            currentPageTitle={currentPageTitle}
            onClose={closePanel}
          />
        </div>
      )}

      {/* Floating Action Button */}
      <button
        className="fab"
        onClick={togglePanel}
        aria-label={panelOpen ? "Close SafeStep" : "Open SafeStep"}
        title={panelOpen ? "Close SafeStep" : "Open SafeStep"}
      >
        {panelOpen && !closing ? "✕" : "🦮"}
      </button>
    </div>
  );
}
