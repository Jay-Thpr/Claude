# Browser-Use Implementation Guide (One-Shot Reference)

Everything an agent needs to implement a browser-use agent with FastAPI SSE streaming and a Next.js frontend. Based on a working implementation using browser-use 0.12.6 + Gemini 3.1 Flash Lite.

---

## Stack

| Layer | Tech |
|-------|------|
| Agent library | `browser-use` 0.12.6 (open-source pip package) |
| LLM | Gemini 3.1 Flash Lite via `google-genai` SDK |
| Backend | FastAPI + uvicorn |
| Frontend | Next.js 14 (App Router) |
| Streaming | Server-Sent Events (SSE) |
| Browser | Chromium via Playwright (headless=False) |

---

## Installation

```bash
# Create and activate venv first
python -m venv venv
source venv/bin/activate  # Mac/Linux

# Install all dependencies
pip install browser-use google-genai fastapi "uvicorn[standard]" python-dotenv

# Install Chromium (required — Playwright won't work without this)
python -m playwright install chromium
```

**Critical:** Do NOT install `langchain-google-genai`. Use browser-use's native `ChatGoogle` wrapper (see LLM section below).

**Critical:** Always install packages into the correct venv. If uvicorn is started from the venv, packages must be installed via `venv/bin/pip`, not a global pip.

---

## Project Structure

```
project/
├── backend/
│   ├── agent.py        # Agent logic, LLM init, step callback, submit guard
│   ├── main.py         # FastAPI: /api/start, /api/stream (SSE), /api/status
│   ├── .env            # ANTHROPIC_API_KEY=...
│   ├── requirements.txt
│   └── venv/
└── frontend/
    └── src/app/
        └── page.tsx    # Next.js UI: button, action log, SSE client
```

---

## LLM Setup — Use ChatGoogle, NOT LangChain

browser-use 0.12.6 has a **native** Gemini wrapper. Use it directly.

```python
from browser_use.llm.google.chat import ChatGoogle

llm = ChatGoogle(
    model="gemini-3.1-flash-lite",
    api_key=os.environ["ANTHROPIC_API_KEY"],
    temperature=0.0,
    max_output_tokens=16000,  # IMPORTANT: default 8096 is too small for thinking models
)
```

**Why not LangChain?**
- `langchain_google_genai.ChatGoogleGenerativeAI` is a LangChain wrapper
- browser-use 0.12.6 expects its own `BaseChatModel` interface, not LangChain's
- Using LangChain causes silent "items" Pydantic validation failures on every step
- The LangChain wrapper also requires hacky compatibility shims for `.provider`, `.model_name`, and `__setattr__` (all avoidable with the native wrapper)

**Why `max_output_tokens=16000`?**
- Gemini 3.1 Flash Lite uses thinking tokens (~7000-8000 tokens per step)
- Thinking tokens count against `max_output_tokens`
- Default 8096 gets consumed by thinking, leaving no room for the JSON response → truncated JSON → parse error
- If older runtime code still reads `GEMINI_API_KEY`, mirror the same value there during migration.

**Supported model strings:**
- `"gemini-3.1-flash-lite"` ✅
- `"gemini-2.5-flash"` ✅
- `"gemini-2.5-pro"` ✅

---

## Agent Initialization (0.12.6 API)

```python
from browser_use import Agent, BrowserProfile, BrowserSession

profile = BrowserProfile(headless=False)  # headless=True to run without a window
session = BrowserSession(browser_profile=profile)

agent = Agent(
    task=TASK,
    llm=llm,
    browser_session=session,
    max_failures=3,
)

await agent.run(max_steps=40, on_step_end=on_step_end)
```

**Always clean up the session in a finally block:**
```python
finally:
    try:
        await session.stop()
    except Exception:
        pass
```

---

## on_step_end Callback (0.12.6 API)

The callback receives the `Agent` object after each step. Key API changes from 0.11.x:

```python
async def on_step_end(agent: Agent) -> None:
    # 0.12.x: history lives on agent directly, NOT agent.state.history
    history = agent.history          # AgentHistoryList
    if not history.history:
        return

    last = history.history[-1]       # AgentHistory (last step)

    # 0.12.x: AgentOutput is flat — no .current_state.thought
    thought = ""
    if last.model_output:
        thought = (
            last.model_output.next_goal   # primary: what the agent plans to do next
            or last.model_output.thinking  # fallback: raw reasoning
            or ""
        )

    # Actions are a list of ActionModel objects
    actions = []
    if last.model_output and last.model_output.action:
        for action in last.model_output.action:
            d = action.model_dump(exclude_none=True)
            for action_name, params in d.items():
                # params is a dict with keys like: url, index, text, direction
                pass
```

**0.12.x API changes summary:**

| 0.11.x | 0.12.x |
|--------|--------|
| `agent.state.history` | `agent.history` |
| `last.model_output.current_state.thought` | `last.model_output.next_goal` or `.thinking` |
| `AgentOutput.thought` | removed — use `next_goal` / `thinking` |

---

## Action Parsing

Each action in `last.model_output.action` is an `ActionModel`. Use `.model_dump(exclude_none=True)` and iterate the keys:

```python
for action in last.model_output.action:
    d = action.model_dump(exclude_none=True)
    for action_name, params in d.items():
        if isinstance(params, dict):
            if "url" in params:
                # navigate_to action
                desc = f"navigate → {params['url']}"
            elif "text" in params and "index" in params:
                # input_text action
                desc = f"type '{params['text']}' into #{params['index']}"
            elif "index" in params:
                # click action
                desc = f"click element #{params['index']}"
            elif "direction" in params:
                # scroll action
                desc = f"scroll {params['direction']}"
            else:
                desc = action_name
        elif action_name == "done":
            desc = "done"
        else:
            desc = action_name
```

---

## Task Prompt Best Practices

- **Do not say "Search Google"** — the agent has a built-in `search` tool that defaults to DuckDuckGo
- **Say "Go to https://www.google.com and search for..."** to force browser navigation
- Be explicit about stopping before submit buttons
- List every field with its exact value

```python
TASK = """
Go to https://www.google.com and search for "LA County CalFresh pre-screening form",
then navigate to the official LA County DPSS CalFresh pre-screening or application form.

Once you find and open the form, fill out EVERY visible field on the first page:
- First Name: Maria
- Last Name: Garcia
...

Fill every visible field on page 1. When done, stop.
IMPORTANT: Do NOT click Submit, Apply, Send, or Final Submit.
"""
```

---

## Stopping Before Submit

Raise `StopIteration` inside `on_step_end` — browser-use catches it cleanly:

```python
SUBMIT_KEYWORDS = {"submit", "apply now", "final submit", "send application"}

async def on_step_end(agent: Agent) -> None:
    # ... parse thought and actions_desc ...

    if any(kw in thought.lower() for kw in SUBMIT_KEYWORDS):
        await emit({"type": "paused", "message": "Agent paused before submission"})
        raise StopIteration("paused before submit")
```

Catch it in the outer `try/except`:
```python
try:
    await agent.run(max_steps=40, on_step_end=on_step_end)
except StopIteration:
    pass  # clean exit, no error emitted
```

---

## FastAPI SSE Architecture

Key design: **one `asyncio.Queue` per SSE connection**, broadcast to all active connections. This prevents the EventSource auto-reconnect race condition where multiple connections fight over a single queue.

```python
_state = {
    "status": "idle",
    "subscribers": [],  # list[asyncio.Queue]
    "task": None,
}

async def _broadcast(event: dict) -> None:
    t = event.get("type")
    if t == "paused":   _state["status"] = "paused"
    elif t == "error":  _state["status"] = "failed"
    elif t == "done":   _state["status"] = "idle"
    for q in list(_state["subscribers"]):
        await q.put(event)

@app.post("/api/start")
async def start_agent():
    if _state["status"] == "running":
        raise HTTPException(409, "Agent already running")
    from agent import run_agent
    _state["subscribers"] = []
    _state["status"] = "running"
    async def _run():
        try:
            await run_agent(_broadcast)
        except Exception as e:
            await _broadcast({"type": "error", "message": str(e)})
        finally:
            if _state["status"] == "running":
                _state["status"] = "idle"
            for q in list(_state["subscribers"]):
                await q.put(None)  # signal connections to close
    _state["task"] = asyncio.create_task(_run())
    return {"status": "started"}

@app.get("/api/stream")
async def stream_events():
    q = asyncio.Queue()
    _state["subscribers"].append(q)
    async def _generator():
        try:
            # send current status immediately on connect/reconnect
            yield f"data: {json.dumps({'type': 'status', 'status': _state['status']})}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=25.0)
                except asyncio.TimeoutError:
                    yield 'data: {"type":"ping"}\n\n'
                    continue
                if event is None:
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"
                    break
                yield f"data: {json.dumps(event)}\n\n"
        finally:
            if q in _state["subscribers"]:
                _state["subscribers"].remove(q)
    return StreamingResponse(
        _generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

---

## Next.js SSE Client

```typescript
const eventSource = useRef<EventSource | null>(null);

function startAgent() {
  // POST to start
  fetch("http://localhost:8000/api/start", { method: "POST" })
    .then(async (res) => {
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const err = await res.json(); msg = err.detail ?? msg; }
        catch { msg = await res.text().catch(() => msg); }
        setStatus("failed");
        return;
      }
      // Open SSE stream
      const es = new EventSource("http://localhost:8000/api/stream");
      eventSource.current = es;
      es.onmessage = (e) => {
        const event = JSON.parse(e.data);
        if (event.type === "ping") return;
        if (event.type === "status") { setStatus(event.status); return; }
        if (event.type === "done" || event.type === "paused" || event.type === "error") {
          setStatus(event.type === "done" ? "idle" : event.type);
          es.close();
        }
        setActions((prev) => [...prev, event]);
      };
    });
}
```

---

## .env Setup

```
# backend/.env
ANTHROPIC_API_KEY=your_key_here
```

Load in FastAPI with:
```python
from dotenv import load_dotenv
load_dotenv()  # call before os.environ.get(...)
```

---

## Running Locally

```bash
# Terminal 1 — backend
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev   # runs on :3000

# Quick test (bypasses FastAPI, runs agent directly)
cd backend
source venv/bin/activate
python test_agent.py
```

---

## Errors Encountered and Fixed

### 1. `AttributeError: 'ChatGoogleGenerativeAI' object has no attribute 'provider'`
- **Cause:** Used LangChain wrapper. browser-use checks `llm.provider`.
- **Fix:** Switch to `browser_use.llm.google.chat.ChatGoogle`.

### 2. Silent "items" Pydantic validation failure on every step
- **Cause:** LangChain's `ainvoke` return type doesn't match browser-use's `BaseChatModel` interface.
- **Fix:** Switch to `ChatGoogle`. Do not use LangChain.

### 3. `❌ Failed to parse JSON response: Unterminated string`
- **Cause:** `max_output_tokens=8096` (default). Gemini 2.5 Flash thinking tokens (~7000-8000) eat up the budget, truncating the JSON response.
- **Fix:** Set `max_output_tokens=16000`.

### 4. Agent uses DuckDuckGo instead of Google
- **Cause:** Task says "Search Google" but browser-use has a built-in `search` tool that defaults to DuckDuckGo.
- **Fix:** Change task to "Go to https://www.google.com and search for..."

### 5. SSE multi-consumer race condition (0 events in frontend)
- **Cause:** EventSource auto-reconnects → multiple connections all reading from one `asyncio.Queue`. Events consumed by wrong connection.
- **Fix:** Per-connection subscriber queue list with broadcast pattern (see FastAPI section above).

### 6. Non-JSON 500 error swallowed by frontend
- **Cause:** `res.json()` throws on HTML error body; outer `catch` shows "Cannot reach backend."
- **Fix:** Try `res.json()`, fallback to `res.text()`, then fallback to generic message.

### 7. `AttributeError: 'AgentState' object has no attribute 'history'` (0.11.x code on 0.12.x)
- **Cause:** `agent.state.history` was removed in 0.12.x.
- **Fix:** Use `agent.history` directly.

---

## Key Links

| Resource | URL |
|----------|-----|
| browser-use GitHub | https://github.com/browser-use/browser-use |
| browser-use docs | https://docs.browser-use.com |
| browser-use LLM full docs | https://docs.browser-use.com/llms-full.txt |
| google-genai SDK | https://github.com/googleapis/python-genai |
| Gemini API usage (free tier) | https://aistudio.google.com |
| FastAPI SSE docs | https://fastapi.tiangolo.com/advanced/custom-response/ |
| Playwright Python | https://playwright.dev/python/docs/intro |

---

## Gotchas

- **Python 3.14 + Pydantic v1 warning**: LangChain uses `pydantic.v1` internally, which prints a deprecation warning on Python 3.14. Harmless — switching to `ChatGoogle` eliminates the warning.
- **Chrome warning "unsupported flag --extensions-on-chrome-urls"**: browser-use passes this flag intentionally. The warning is cosmetic; it does not affect functionality.
- **Gemini free tier**: API calls in small test runs won't appear as charges. Check usage at aistudio.google.com → API usage tab.
- **`session.stop()` in finally**: Always call this. If the browser process isn't cleaned up, you'll accumulate orphaned Chromium processes.
- **`max_failures=3`**: The agent retries up to 3 consecutive failures before stopping. Each retry is a real API call with billing implications on paid tiers.
