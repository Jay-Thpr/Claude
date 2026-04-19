"""
FastAPI server for SafeStep Browser Use integration.
Provides SSE streaming of browser agent steps.
"""

import asyncio
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="SafeStep Browser Agent")

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
        _state["status"] = "failed"
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


@app.get("/api/status")
async def get_status():
    """Return current agent status."""
    return {"status": _state["status"]}
