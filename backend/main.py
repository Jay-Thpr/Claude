"""
FastAPI server for SafeStep Browser Use integration.
Provides SSE streaming of browser agent steps.
"""

import asyncio
import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional during local backend boot
    load_dotenv = None

if load_dotenv is not None:
    backend_dir = Path(__file__).resolve().parent
    repo_root = backend_dir.parent
    for env_path in (
        backend_dir / ".env",
        repo_root / ".env.local",
        repo_root / ".env",
    ):
        if env_path.exists():
            load_dotenv(env_path, override=False)

app = FastAPI(title="SafeStep Browser Agent")

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    # Allow any local Next.js dev port so the frontend can be restarted on a
    # different port without breaking browser preflight requests.
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
_state = {
    "status": "idle",
    "subscribers": [],  # list[asyncio.Queue]
    "task": None,
}


class TaskRequest(BaseModel):
    task: str


async def _broadcast(event: dict) -> None:
    """Broadcast event to all SSE subscribers."""
    t = event.get("type")
    if t == "paused":
        _state["status"] = "paused"
    elif t == "error":
        _state["status"] = "error"
    elif t == "done":
        _state["status"] = "idle"

    for q in list(_state["subscribers"]):
        await q.put(event)


@app.post("/api/start")
async def start_agent(req: TaskRequest):
    """Start a browser agent with the given task."""
    if _state["status"] == "running":
        raise HTTPException(409, "Agent already running")

    from agent import run_agent

    _state["subscribers"] = []
    _state["status"] = "running"

    async def _run():
        try:
            await run_agent(req.task, _broadcast)
        except Exception as e:
            await _broadcast({"type": "error", "message": str(e)})
        finally:
            if _state["status"] == "running":
                _state["status"] = "idle"
            # Signal all subscribers to close
            for q in list(_state["subscribers"]):
                await q.put(None)

    _state["task"] = asyncio.create_task(_run())
    return {"status": "started"}


@app.get("/api/stream")
async def stream_events():
    """SSE endpoint — per-connection subscriber queue."""
    q: asyncio.Queue = asyncio.Queue()
    _state["subscribers"].append(q)

    async def _generator():
        try:
            # Send current status on connect
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


@app.post("/api/extract")
async def extract_info(req: TaskRequest):
    """Run a browser agent extraction task synchronously and return the result."""
    from agent import extract_from_page
    try:
        result = await extract_from_page(req.task)
        return {"result": result}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/status")
async def get_status():
    """Return current agent status."""
    return {"status": _state["status"]}


@app.get("/api/voice-runtime/health")
async def get_voice_runtime_health():
    """Return Gemini/Twilio media bridge readiness for self-call testing."""
    return {
        "status": "ok",
        "backend_url": os.environ.get("BACKEND_PUBLIC_BASE_URL"),
        "media_stream_url": os.environ.get("TWILIO_MEDIA_STREAM_URL"),
        "media_stream_endpoint_path": "/ws/twilio-media-stream",
        "gemini_api_key_configured": bool(os.environ.get("GEMINI_API_KEY")),
        "voice_events_secret_configured": bool(os.environ.get("TWILIO_VOICE_EVENTS_SECRET")),
        "twilio_gemini_live_model": os.environ.get(
            "TWILIO_GEMINI_LIVE_MODEL", "gemini-2.5-flash-native-audio-preview-12-2025"
        ),
        "twilio_gemini_voice": os.environ.get("TWILIO_GEMINI_VOICE", "Kore"),
        "ready_for_live_media_stream": bool(
            os.environ.get("GEMINI_API_KEY")
            and os.environ.get("TWILIO_VOICE_EVENTS_SECRET")
            and os.environ.get("TWILIO_MEDIA_STREAM_URL")
        ),
    }


@app.websocket("/ws/twilio-media-stream")
async def twilio_media_stream(websocket: WebSocket):
    """Bidirectional media bridge between Twilio Media Streams and Gemini Live."""
    from voice_runtime import bridge_twilio_to_gemini

    await bridge_twilio_to_gemini(websocket)
