"""
Browser Use Agent for SafeStep
Runs a browser-use agent with Gemini and streams step events via a callback.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Callable, Awaitable

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

# browser-use creates its own config/profile directories during import.
# Point those at a writable temp location so the agent can initialize safely.
os.environ.setdefault("BROWSER_USE_CONFIG_DIR", str(Path("/tmp") / "browseruse"))

try:
    from browser_use import Agent, BrowserProfile, BrowserSession
    from browser_use.llm.google.chat import ChatGoogle
    _IMPORT_ERROR: Exception | None = None
except ImportError as exc:  # pragma: no cover - optional browser agent dependency
    Agent = BrowserProfile = BrowserSession = ChatGoogle = None  # type: ignore[assignment]
    _IMPORT_ERROR = exc

# Submit guard keywords
SUBMIT_KEYWORDS = {
    "submit",
    "apply now",
    "final submit",
    "send application",
    "confirm payment",
    "place order",
}


def _build_llm() -> ChatGoogle:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set.")

    return ChatGoogle(
        model=os.environ.get("SAFESTEP_BROWSER_MODEL", "gemini-2.5-flash-lite"),
        api_key=api_key,
        temperature=0.0,
        max_output_tokens=16000,
    )


def _browser_headless() -> bool:
    value = os.environ.get("BROWSER_USE_HEADLESS", "false").strip().lower()
    return value in {"1", "true", "yes", "on"}


async def extract_from_page(task: str) -> str:
    """
    Run a browser-use agent for extraction tasks.
    Returns the agent's final text result.
    """
    if _IMPORT_ERROR is not None:
        raise RuntimeError(
            "browser-use is not installed in this environment, so the browser agent cannot run."
        ) from _IMPORT_ERROR

    llm = _build_llm()

    profile = BrowserProfile(headless=_browser_headless())
    session = BrowserSession(browser_profile=profile)

    try:
        agent = Agent(
            task=task,
            llm=llm,
            browser_session=session,
            max_failures=3,
        )
        result = await agent.run(max_steps=20)
        # browser_use returns an AgentHistoryList; final_result() extracts the last done action text
        return result.final_result() or ""
    finally:
        try:
            await session.stop()
        except Exception:
            pass


async def run_agent(task: str, emit: Callable[[dict], Awaitable[None]]) -> None:
    """
    Run a browser-use agent for the given task.
    Emits step events via the emit callback for SSE streaming.
    """
    if _IMPORT_ERROR is not None:
        raise RuntimeError(
            "browser-use is not installed in this environment, so the browser agent cannot run."
        ) from _IMPORT_ERROR

    llm = _build_llm()

    profile = BrowserProfile(headless=_browser_headless())
    session = BrowserSession(browser_profile=profile)

    step_count = 0

    async def on_step_end(agent_instance: Agent) -> None:
        nonlocal step_count

        history = agent_instance.history
        if not history.history:
            return

        last = history.history[-1]

        # Extract thought
        thought = ""
        if last.model_output:
            thought = (
                last.model_output.next_goal
                or last.model_output.thinking
                or ""
            )

        # Extract actions
        actions_desc = []
        if last.model_output and last.model_output.action:
            for action in last.model_output.action:
                d = action.model_dump(exclude_none=True)
                for action_name, params in d.items():
                    if isinstance(params, dict):
                        if "url" in params:
                            desc = f"navigate → {params['url']}"
                        elif "text" in params and "index" in params:
                            desc = f"type '{params['text']}' into #{params['index']}"
                        elif "index" in params:
                            desc = f"click element #{params['index']}"
                        elif "direction" in params:
                            desc = f"scroll {params['direction']}"
                        else:
                            desc = action_name
                    elif action_name == "done":
                        desc = "done"
                    else:
                        desc = action_name
                    actions_desc.append(desc)

        step_count += 1
        action_str = "; ".join(actions_desc) if actions_desc else None

        await emit({
            "type": "step",
            "step": step_count,
            "thought": thought,
            "action": action_str,
        })

        # Submit guard
        if any(kw in thought.lower() for kw in SUBMIT_KEYWORDS):
            await emit({
                "type": "paused",
                "message": "I stopped before submitting anything. Please review what's on the screen."
            })
            raise StopIteration("paused before submit")

    try:
        agent = Agent(
            task=task,
            llm=llm,
            browser_session=session,
            max_failures=3,
        )

        await agent.run(max_steps=40, on_step_end=on_step_end)
        await emit({"type": "done"})

    except StopIteration:
        pass  # Clean exit from submit guard

    except Exception as e:
        await emit({"type": "error", "message": str(e)})

    finally:
        try:
            await session.stop()
        except Exception:
            pass
