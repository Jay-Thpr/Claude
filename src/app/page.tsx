"use client";

import { useState } from "react";
import BrowserTaskArea from "@/components/BrowserTaskArea";

export default function Home() {
  const [currentUrl, setCurrentUrl] = useState("");
  const [currentTask, setCurrentTask] = useState("");

  return (
    <main className="test-harness-shell">
      <section className="test-harness-header">
        <div>
          <p className="test-harness-eyebrow">Browser Agent Test Harness</p>
          <h1>Run browser-use tasks against a real browser session</h1>
          <p className="test-harness-copy">
            This page is for technical validation only. It starts the Python
            backend agent, streams step events, and surfaces the latest browser
            navigation the agent reports.
          </p>
        </div>
        <div className="test-harness-meta">
          <div>
            <span className="test-harness-label">Current task</span>
            <p>{currentTask || "No task running"}</p>
          </div>
          <div>
            <span className="test-harness-label">Latest URL</span>
            <p>{currentUrl || "No navigation reported yet"}</p>
          </div>
        </div>
      </section>

      <section className="test-harness-frame">
        <BrowserTaskArea
          onUrlChange={setCurrentUrl}
          onPageTitleChange={setCurrentTask}
        />
      </section>
    </main>
  );
}
