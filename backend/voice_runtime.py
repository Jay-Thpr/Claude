from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import urllib.error
import urllib.request
from array import array
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from fastapi import WebSocket
from fastapi.websockets import WebSocketDisconnect

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
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

from google import genai
from google.genai import types


DEFAULT_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"
DEFAULT_VOICE = "Kore"
TWILIO_SAMPLE_RATE = 8000
GEMINI_INPUT_RATE = 16000
GEMINI_OUTPUT_RATE = 24000
MULAW_BIAS = 0x84
MULAW_CLIP = 32635
MAX_TRANSCRIPT_CHARS = 4000
SPEECH_RMS_THRESHOLD = int(os.environ.get("TWILIO_SPEECH_RMS_THRESHOLD", "350"))
MODEL_STARTUP_QUIET_MS = int(os.environ.get("TWILIO_MODEL_STARTUP_QUIET_MS", "2000"))


@dataclass
class ProviderCallContext:
    session_id: str
    provider_name: str
    patient_name: str
    call_goal: str
    callback_number: str
    appointment_context: dict[str, Any] = field(default_factory=dict)
    constraints: list[str] = field(default_factory=list)
    stream_sid: str = ""
    transcript_lines: list[str] = field(default_factory=list)
    inbound_media_chunks: int = 0
    outbound_audio_chunks: int = 0

    def append_transcript(self, speaker: str, text: str) -> None:
        cleaned = " ".join(text.split())
        if not cleaned:
            return
        self.transcript_lines.append(f"{speaker}: {cleaned}")
        while len("\n".join(self.transcript_lines)) > MAX_TRANSCRIPT_CHARS:
            self.transcript_lines.pop(0)

    def transcript_excerpt(self) -> str | None:
        if not self.transcript_lines:
            return None
        return "\n".join(self.transcript_lines[-16:])


def _required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} is not set.")
    return value


def _resolve_api_key() -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set.")
    return api_key


def _resolve_live_model() -> str:
    return os.environ.get(
        "TWILIO_ANTHROPIC_LIVE_MODEL",
        os.environ.get("TWILIO_GEMINI_LIVE_MODEL", DEFAULT_MODEL),
    )


def _resolve_live_voice() -> str:
    return os.environ.get("TWILIO_ANTHROPIC_VOICE", os.environ.get("TWILIO_GEMINI_VOICE", DEFAULT_VOICE))


def _build_live_system_instruction(context: ProviderCallContext) -> str:
    callback_line = (
        f" If the office needs a callback number, use {context.callback_number}."
        if context.callback_number
        else ""
    )
    appointment_bits: list[str] = []
    for field_name, label in (
        ("summary", "summary"),
        ("whenLabel", "when"),
        ("timeLabel", "time"),
        ("location", "location"),
    ):
        value = str(context.appointment_context.get(field_name, "")).strip()
        if value:
            appointment_bits.append(f"{label}: {value}")

    appointment_line = (
        f" Appointment context: {'; '.join(appointment_bits)}."
        if appointment_bits
        else ""
    )
    constraints_line = (
        f" Additional constraints: {'; '.join(context.constraints)}."
        if context.constraints
        else ""
    )

    return (
        "You are SafeStep, an AI assistant on a live phone call with a healthcare provider office. "
        f"You are assisting patient {context.patient_name} regarding this goal: {context.call_goal}. "
        f"The office is {context.provider_name}.{callback_line}{appointment_line}{constraints_line} "
        "You must stay within low-risk administrative support. "
        "You must not provide medical advice, authorize treatment, commit to payments, discuss emergencies, "
        "or imply you are the patient. If asked to do something outside scope, explain that you are an AI "
        "assistant helping with administrative coordination only and ask for the best next administrative step. "
        "Do not speak first unless the person on the other side has spoken or the line has been silent for a while. "
        "Be concise, calm, and direct. Ask only one question at a time. "
        "If the office confirms an appointment detail or callback instruction, repeat it clearly."
    )


def _decode_mulaw_byte(value: int) -> int:
    value = ~value & 0xFF
    sign = value & 0x80
    exponent = (value >> 4) & 0x07
    mantissa = value & 0x0F
    sample = ((mantissa << 3) + MULAW_BIAS) << exponent
    return (MULAW_BIAS - sample) if sign else (sample - MULAW_BIAS)


def _encode_mulaw_sample(sample: int) -> int:
    sign = 0x80 if sample < 0 else 0
    magnitude = -sample if sample < 0 else sample
    if magnitude > MULAW_CLIP:
        magnitude = MULAW_CLIP
    magnitude += MULAW_BIAS

    exponent = 7
    mask = 0x4000
    while exponent > 0 and not (magnitude & mask):
        exponent -= 1
        mask >>= 1

    mantissa = (magnitude >> (exponent + 3)) & 0x0F
    return (~(sign | (exponent << 4) | mantissa)) & 0xFF


def _resample_pcm16(audio_bytes: bytes, src_rate: int, dst_rate: int) -> bytes:
    if src_rate == dst_rate or not audio_bytes:
        return audio_bytes

    source = array("h")
    source.frombytes(audio_bytes)
    if not source:
        return b""

    if dst_rate < src_rate:
        # Downsampling: average blocks of samples (box filter) to prevent aliasing.
        # The old linear-interpolation approach dropped samples without filtering,
        # causing audible distortion on the 24kHz→8kHz path.
        ratio = src_rate / dst_rate
        destination_length = max(1, int(len(source) / ratio))
        destination = array("h")
        for i in range(destination_length):
            start = int(i * ratio)
            end = min(int((i + 1) * ratio), len(source))
            if end <= start:
                end = start + 1
            block = source[start:end]
            destination.append(sum(block) // len(block))
        return destination.tobytes()
    else:
        # Upsampling: linear interpolation is fine here.
        destination_length = max(1, int(len(source) * dst_rate / src_rate))
        destination = array("h")
        if len(source) == 1:
            destination.extend([source[0]] * destination_length)
            return destination.tobytes()
        scale = (len(source) - 1) / max(destination_length - 1, 1)
        for index in range(destination_length):
            position = index * scale
            left = int(position)
            right = min(left + 1, len(source) - 1)
            fraction = position - left
            sample = int(source[left] * (1.0 - fraction) + source[right] * fraction)
            destination.append(sample)
        return destination.tobytes()


def _twilio_payload_to_pcm16(payload: str) -> bytes:
    mulaw_bytes = base64.b64decode(payload)
    pcm = array("h", (_decode_mulaw_byte(value) for value in mulaw_bytes))
    return _resample_pcm16(pcm.tobytes(), TWILIO_SAMPLE_RATE, GEMINI_INPUT_RATE)


def _parse_sample_rate(mime_type: str | None, default: int) -> int:
    if not mime_type:
        return default
    match = re.search(r"rate=(\d+)", mime_type)
    return int(match.group(1)) if match else default


def _pcm16_to_twilio_payload(audio_bytes: bytes, sample_rate: int) -> str:
    pcm_for_twilio = _resample_pcm16(audio_bytes, sample_rate, TWILIO_SAMPLE_RATE)
    samples = array("h")
    samples.frombytes(pcm_for_twilio)
    mulaw_bytes = bytes(_encode_mulaw_sample(sample) for sample in samples)
    return base64.b64encode(mulaw_bytes).decode("ascii")


def _chunk_rms(audio_bytes: bytes) -> int:
    if not audio_bytes:
        return 0
    samples = array("h")
    samples.frombytes(audio_bytes)
    if not samples:
        return 0
    mean_square = sum(sample * sample for sample in samples) / len(samples)
    return int(mean_square**0.5)


def _build_outcome_payload(context: ProviderCallContext) -> dict[str, Any]:
    transcript = context.transcript_excerpt() or ""
    lower = transcript.lower()
    callback_requested = "call back" in lower or "callback" in lower
    appointment_confirmed = (
        "appointment is confirmed" in lower
        or "confirmed for" in lower
        or "you are scheduled" in lower
    )
    voicemail_detected = (
        "leave a message" in lower
        or "voicemail" in lower
        or "after the tone" in lower
    )

    summary_parts: list[str] = []
    if appointment_confirmed:
        summary_parts.append("The office appears to have confirmed appointment details.")
    if callback_requested:
        summary_parts.append("The office appears to have requested a callback or follow-up.")
    if voicemail_detected:
        summary_parts.append("The call appears to have reached voicemail.")
    if not summary_parts:
        summary_parts.append("Voice runtime completed without a structured outcome classification.")

    return {
        "disposition": "voice-runtime-complete",
        "callback_requested": callback_requested,
        "appointment_confirmed": appointment_confirmed,
        "voicemail_detected": voicemail_detected,
        "transcript_excerpt": transcript or None,
        "outcome_summary": " ".join(summary_parts),
        "status_message": "Anthropic voice runtime finished.",
    }


async def _post_voice_event(session_id: str, payload: dict[str, Any]) -> None:
    base_url = os.environ.get("APP_BASE_URL")
    secret = os.environ.get("TWILIO_VOICE_EVENTS_SECRET")
    if not base_url or not secret:
        return

    url = f"{base_url}/api/calls/{session_id}/voice-events"
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-safestep-voice-secret": secret,
        },
        method="POST",
    )
    try:
        await asyncio.to_thread(urllib.request.urlopen, request, timeout=10)
    except urllib.error.URLError:
        return


async def _push_transcript_update(
    context: ProviderCallContext,
    *,
    status_message: str | None = None,
    outcome_summary: str | None = None,
) -> None:
    payload: dict[str, Any] = {
        "transcript_excerpt": context.transcript_excerpt(),
    }
    if status_message is not None:
        payload["status_message"] = status_message
    if outcome_summary is not None:
        payload["outcome_summary"] = outcome_summary
    await _post_voice_event(context.session_id, payload)


async def _receive_twilio_start(websocket: WebSocket) -> ProviderCallContext:
    while True:
        raw_message = await websocket.receive_text()
        message = json.loads(raw_message)
        event = message.get("event")
        if event == "connected":
            continue
        if event != "start":
            raise RuntimeError("Twilio media stream did not send a start event.")

        start = message.get("start", {})
        params = start.get("customParameters", {}) or {}
        session_id = params.get("sessionId") or ""
        if not session_id:
            raise RuntimeError("Twilio stream did not include a call session ID.")

        try:
            appointment_context = json.loads(params.get("appointmentContext", "{}") or "{}")
        except json.JSONDecodeError:
            appointment_context = {}
        if not isinstance(appointment_context, dict):
            appointment_context = {}

        try:
            constraints = json.loads(params.get("constraints", "[]") or "[]")
        except json.JSONDecodeError:
            constraints = []
        if not isinstance(constraints, list):
            constraints = []

        return ProviderCallContext(
            session_id=session_id,
            stream_sid=start.get("streamSid", ""),
            provider_name=params.get("providerName", "provider office"),
            patient_name=params.get("patientName", "the patient"),
            call_goal=params.get("callGoal", "administrative support"),
            callback_number=params.get("callbackNumber", ""),
            appointment_context=appointment_context,
            constraints=[str(item).strip() for item in constraints if str(item).strip()],
        )


async def bridge_twilio_to_gemini(websocket: WebSocket) -> None:
    await websocket.accept()
    context = await _receive_twilio_start(websocket)
    loop = asyncio.get_running_loop()
    connect_started_at = loop.time()

    client = genai.Client(api_key=_resolve_api_key())
    model = _resolve_live_model()
    voice_name = _resolve_live_voice()

    config = {
        "response_modalities": ["AUDIO"],
        "system_instruction": _build_live_system_instruction(context),
        "realtime_input_config": {
            "automatic_activity_detection": {
                "disabled": False,
                "start_of_speech_sensitivity": types.StartSensitivity.START_SENSITIVITY_LOW,
                "end_of_speech_sensitivity": types.EndSensitivity.END_SENSITIVITY_LOW,
                "prefix_padding_ms": 40,
                "silence_duration_ms": 300,
            }
        },
        "speech_config": {
            "voice_config": {
                "prebuilt_voice_config": {
                    "voice_name": voice_name,
                }
            }
        },
        "input_audio_transcription": {},
        "output_audio_transcription": {},
    }

    stop_event = asyncio.Event()
    # Tracks whether the live model is actively sending audio to the phone.
    # Used to gate echo from the model's own voice reflecting back through the mic.
    gemini_speaking = asyncio.Event()

    async with client.aio.live.connect(model=model, config=config) as session:
        await _post_voice_event(
            context.session_id,
            {"status_message": "Anthropic voice runtime connected to the Twilio media stream."},
        )

        async def twilio_to_gemini() -> None:
            # When the model is speaking, its audio echoes back through the phone mic.
            # Gate inbound audio at 2x the normal threshold to suppress that echo
            # while still allowing louder barge-in speech to pass through.
            echo_gate = SPEECH_RMS_THRESHOLD * 2

            try:
                while True:
                    raw_message = await websocket.receive_text()
                    message = json.loads(raw_message)
                    event = message.get("event")

                    if event == "media":
                        media = message.get("media", {})
                        payload = media.get("payload")
                        if not payload:
                            continue

                        context.inbound_media_chunks += 1
                        pcm_audio = _twilio_payload_to_pcm16(payload)
                        if not pcm_audio:
                            continue

                        if gemini_speaking.is_set() and _chunk_rms(pcm_audio) < echo_gate:
                            continue

                        await session.send_realtime_input(
                            audio=types.Blob(
                                data=pcm_audio,
                                mime_type=f"audio/pcm;rate={GEMINI_INPUT_RATE}",
                            )
                        )

                        if context.inbound_media_chunks in {1, 10, 25, 50}:
                            await _post_voice_event(
                                context.session_id,
                                {
                                    "status_message": (
                                        f"Forwarding caller audio to Anthropic runtime. "
                                        f"Chunks: {context.inbound_media_chunks}."
                                    ),
                                    "transcript_excerpt": context.transcript_excerpt(),
                                },
                            )

                    elif event == "stop":
                        stop_event.set()
                        await session.send_realtime_input(audio_stream_end=True)
                        return

            except WebSocketDisconnect:
                stop_event.set()
                try:
                    await session.send_realtime_input(audio_stream_end=True)
                except Exception:
                    pass

        async def gemini_to_twilio() -> None:
            heard_provider_speech = False
            suppressed_startup_audio = False

            async for message in session.receive():
                server_content = message.server_content
                if not server_content:
                    continue

                if server_content.input_transcription and server_content.input_transcription.text:
                    heard_provider_speech = True
                    context.append_transcript("Provider", server_content.input_transcription.text)
                    # Barge-in: caller spoke while the model was talking.
                    # Clear Twilio's audio queue so voices don't overlap,
                    # then drop the speaking flag so echo gating stops.
                    if gemini_speaking.is_set() and context.stream_sid:
                        await websocket.send_json(
                            {"event": "clear", "streamSid": context.stream_sid}
                        )
                        gemini_speaking.clear()
                    await _push_transcript_update(
                        context,
                        status_message="Anthropic runtime transcribed caller speech.",
                    )

                if server_content.output_transcription and server_content.output_transcription.text:
                    allow_transcript = heard_provider_speech or (
                        (loop.time() - connect_started_at) >= (MODEL_STARTUP_QUIET_MS / 1000)
                    )
                    if allow_transcript:
                        context.append_transcript(
                            "SafeStep", server_content.output_transcription.text
                        )
                        await _push_transcript_update(
                            context,
                            status_message="Anthropic runtime generated a spoken response.",
                        )

                model_turn = server_content.model_turn
                if model_turn and model_turn.parts and context.stream_sid:
                    allow_model_audio = heard_provider_speech or (
                        (loop.time() - connect_started_at) >= (MODEL_STARTUP_QUIET_MS / 1000)
                    )

                    for part in model_turn.parts:
                        inline_data = part.inline_data
                        if not inline_data or not inline_data.data:
                            continue
                        if not inline_data.mime_type or "audio/pcm" not in inline_data.mime_type:
                            continue
                        if not allow_model_audio:
                            if not suppressed_startup_audio:
                                suppressed_startup_audio = True
                                await _post_voice_event(
                                    context.session_id,
                                    {
                                        "status_message": (
                                            "Suppressed early Anthropic audio during startup quiet window."
                                        )
                                    },
                                )
                            continue

                        gemini_speaking.set()
                        context.outbound_audio_chunks += 1
                        payload = _pcm16_to_twilio_payload(
                            inline_data.data,
                            _parse_sample_rate(inline_data.mime_type, GEMINI_OUTPUT_RATE),
                        )
                        await websocket.send_json(
                            {
                                "event": "media",
                                "streamSid": context.stream_sid,
                                "media": {"payload": payload},
                            }
                        )
                        if context.outbound_audio_chunks in {1, 10, 25, 50}:
                            await _post_voice_event(
                                context.session_id,
                                {
                                    "status_message": (
                                        f"Streaming Anthropic audio back to Twilio. "
                                        f"Chunks sent: {context.outbound_audio_chunks}."
                                    ),
                                    "transcript_excerpt": context.transcript_excerpt(),
                                },
                            )

                if server_content.turn_complete:
                    gemini_speaking.clear()
                    if stop_event.is_set():
                        return

        tasks = [
            asyncio.create_task(twilio_to_gemini()),
            asyncio.create_task(gemini_to_twilio()),
        ]
        # FIRST_COMPLETED: when Twilio hangs up (twilio_to_gemini returns),
        # cancel gemini_to_twilio immediately rather than waiting for an exception.
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        for task in done:
            exc = task.exception()
            if exc:
                raise exc

    outcome = _build_outcome_payload(context)
    outcome["status_message"] = (
        "Anthropic voice runtime finished. "
        f"Twilio chunks in: {context.inbound_media_chunks}. "
        f"Anthropic audio chunks out: {context.outbound_audio_chunks}."
    )
    await _post_voice_event(context.session_id, outcome)
