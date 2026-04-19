"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import CopilotPanel from "@/components/CopilotPanel";
import BrowserTaskArea from "@/components/BrowserTaskArea";
import CalendarNoticeBanner from "@/components/CalendarNoticeBanner";
import GoogleSearchEmbed from "@/components/GoogleSearchEmbed";

export default function HomeShell() {
  const [currentUrl, setCurrentUrl] = useState("");
  const [currentPageTitle, setCurrentPageTitle] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pharmacyPanelOpen, setPharmacyPanelOpen] = useState(false);
  const [pharmacyClosing, setPharmacyClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pharmacyCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pharmacyTraceTask =
    "Go to my pharmacy website and look for refill options. Trace the path to the refill, prescription status, or contact page, and stop before submitting anything.";

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (pharmacyCloseTimer.current) clearTimeout(pharmacyCloseTimer.current);
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

  const openPharmacyPanel = () => {
    if (pharmacyClosing) {
      if (pharmacyCloseTimer.current) clearTimeout(pharmacyCloseTimer.current);
      setPharmacyClosing(false);
    }
    setPharmacyPanelOpen(true);
  };

  const closePharmacyPanel = () => {
    setPharmacyClosing(true);
    pharmacyCloseTimer.current = setTimeout(() => {
      setPharmacyPanelOpen(false);
      setPharmacyClosing(false);
    }, 200);
  };

  const togglePharmacyPanel = () => {
    if (pharmacyPanelOpen && !pharmacyClosing) {
      closePharmacyPanel();
    } else {
      openPharmacyPanel();
    }
  };

  return (
    <div className="app-shell">
      <Suspense fallback={null}>
        <CalendarNoticeBanner />
      </Suspense>

      <div className="home-stage">
        <GoogleSearchEmbed />

        <div className="home-browser-wrap">
          <BrowserTaskArea
            onUrlChange={setCurrentUrl}
            onPageTitleChange={setCurrentPageTitle}
          />
        </div>
      </div>

      {panelOpen && (
        <div className={`overlay-panel${closing ? " overlay-panel-closing" : ""}`}>
          <CopilotPanel
            currentUrl={currentUrl}
            currentPageTitle={currentPageTitle}
            onClose={closePanel}
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

      <button
        className="pharmacy-fab"
        onClick={togglePharmacyPanel}
        aria-label={pharmacyPanelOpen ? "Close pharmacy trace" : "Open pharmacy trace"}
        title={pharmacyPanelOpen ? "Close pharmacy trace" : "Open pharmacy trace"}
      >
        <span className="pharmacy-fab-icon">Rx</span>
        <span className="pharmacy-fab-label">Trace Pharmacy</span>
      </button>

      {pharmacyPanelOpen && (
        <div className={`trace-panel${pharmacyClosing ? " trace-panel-closing" : ""}`}>
          <div className="trace-panel-shell">
            <div className="trace-panel-topbar">
              <div>
                <p className="trace-panel-eyebrow">Side popup</p>
                <h3>Pharmacy Path Trace</h3>
                <p className="trace-panel-copy">
                  Follow the pharmacy path in the embedded browser and stop before any submit step.
                </p>
              </div>
              <button className="trace-panel-close" onClick={closePharmacyPanel} aria-label="Close pharmacy trace">
                ✕
              </button>
            </div>
            <div className="trace-panel-body">
              <BrowserTaskArea
                onUrlChange={setCurrentUrl}
                onPageTitleChange={setCurrentPageTitle}
                panelTitle="Pharmacy Path Trace"
                panelCopy="Use the quick trace button to follow the pharmacy path. I’ll keep the browser visible and show each step as it happens."
                examplePrompts={[
                  "Go to my pharmacy website and look for refill options",
                  "Search the pharmacy site for prescription status",
                  "Find the contact or help page for the pharmacy",
                ]}
                initialTask={pharmacyTraceTask}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
