"use client";

import { useEffect, useRef, useState } from "react";
import BrowserTaskArea, { type BrowserTaskAreaHandle } from "@/components/BrowserTaskArea";
import CopilotPanel from "@/components/CopilotPanel";

export default function HomeShell() {
  const browserAreaRef = useRef<BrowserTaskAreaHandle | null>(null);
  const [currentUrl, setCurrentUrl] = useState("");
  const [currentPageTitle, setCurrentPageTitle] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pharmacyTask =
    "Go to my pharmacy website and look for refill options. Trace the path to the refill, prescription status, or contact page, and stop before submitting anything.";

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

  const runPharmacyTrace = () => {
    browserAreaRef.current?.runTask(pharmacyTask);
  };

  return (
    <div className="app-shell">
      <div className="home-stage">
        <BrowserTaskArea
          ref={browserAreaRef}
          currentUrl={currentUrl}
          currentPageTitle={currentPageTitle}
          onUrlChange={setCurrentUrl}
          onPageTitleChange={setCurrentPageTitle}
        />
      </div>

      {panelOpen && (
        <div className={`overlay-panel${closing ? " overlay-panel-closing" : ""}`}>
          <CopilotPanel
            currentUrl={currentUrl}
            currentPageTitle={currentPageTitle}
            onClose={closePanel}
            onNavigateBanana={() => {
              const bananaUrl = "https://www.google.com/search?igu=1&hl=en&q=banana";
              setCurrentUrl(bananaUrl);
              setCurrentPageTitle("banana - Google Search");
            }}
            onRunPharmacyTrace={runPharmacyTrace}
          />
        </div>
      )}

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
