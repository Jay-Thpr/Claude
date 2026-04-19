"use client";

import { useEffect, useRef, useState } from "react";
import CopilotPanel from "@/components/CopilotPanel";
import BrowserTaskArea, { type BrowserTaskAreaHandle } from "@/components/BrowserTaskArea";
import GoogleSearchEmbed from "@/components/GoogleSearchEmbed";
import TwilioCallPanel from "@/components/TwilioCallPanel";

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
        <GoogleSearchEmbed />

        <div className="home-browser-wrap">
          <BrowserTaskArea
            ref={browserAreaRef}
            onUrlChange={setCurrentUrl}
            onPageTitleChange={setCurrentPageTitle}
            panelTitle="Embedded Browser Trace"
            panelCopy="The pharmacy trace runs right here on the main page. Use the popup launcher to start it."
            examplePrompts={[
              "Go to my pharmacy website and look for refill options",
              "Search the pharmacy site for prescription status",
              "Find the contact or help page for the pharmacy",
            ]}
          />
        </div>
      </div>

      {panelOpen && (
        <div className={`overlay-panel${closing ? " overlay-panel-closing" : ""}`}>
          <CopilotPanel
            currentUrl={currentUrl}
            currentPageTitle={currentPageTitle}
            onClose={closePanel}
            onRunPharmacyTrace={runPharmacyTrace}
          />
        </div>
      )}

      <TwilioCallPanel
        currentUrl={currentUrl}
        currentPageTitle={currentPageTitle}
      />

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
