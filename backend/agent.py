"""
Browser Use Agent for SafeStep
Runs a browser-use agent with Gemini and streams step events via a callback.
"""

import os
from typing import Callable, Awaitable
from dotenv import load_dotenv

load_dotenv()

from browser_use import Agent, BrowserProfile, BrowserSession
from browser_use.llm.google.chat import ChatGoogle

# Initialize LLM
llm = ChatGoogle(
    model="gemini-2.5-flash",
    api_key=os.environ["GEMINI_API_KEY"],
    temperature=0.0,
    max_output_tokens=16000,  # Required for thinking models
)

# Submit guard keywords
SUBMIT_KEYWORDS = {"submit", "apply now", "final submit", "send application", "confirm payment", "place order"}


async def run_agent(task: str, emit: Callable[[dict], Awaitable[None]]) -> None:
    """
    Run a browser-use agent for the given task.
    Emits step events via the emit callback for SSE streaming.
    """
    profile = BrowserProfile(headless=False)
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
