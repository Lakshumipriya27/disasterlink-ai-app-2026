"""Optional external AI enhancement (disabled by default).

Enabled only when AI_PROVIDER=anthropic, ANTHROPIC_API_KEY is set and the optional `anthropic`
package is installed. Any failure silently falls back to the local rule-based result, so the
platform never depends on this service.
"""
import json
import logging

from ..config import AI_MODEL, AI_PROVIDER, ANTHROPIC_API_KEY
from .classifier import CATEGORIES

log = logging.getLogger("disasterlink.ai")

PROMPT = """You classify disaster-relief requests for human coordinators.
Allowed categories: food, water, medicine, shelter, transport, clothing, rescue, other.
Return ONLY a JSON object: {"category": <primary>, "categories": [<primary first, then others>],
"keywords": [<up to 6 short keywords>], "rationale": "<one sentence>"}.

Request text:
"""


def status() -> dict:
    enabled = AI_PROVIDER == "anthropic" and bool(ANTHROPIC_API_KEY)
    installed = True
    try:
        import anthropic  # noqa: F401
    except ImportError:
        installed = False
    return {"provider": AI_PROVIDER, "configured": enabled, "package_installed": installed,
            "active": enabled and installed, "model": AI_MODEL if enabled else None}


def enhance(text: str, local: dict) -> dict:
    st = status()
    if not st["active"] or not text.strip():
        return local
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY, timeout=20.0, max_retries=1)
        resp = client.beta.messages.create(
            model=AI_MODEL,
            max_tokens=1024,
            output_config={"effort": "low"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            messages=[{"role": "user", "content": PROMPT + text[:4000]}],
        )
        if resp.stop_reason == "refusal":
            return local
        raw = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text").strip()
        raw = raw[raw.find("{"): raw.rfind("}") + 1]
        data = json.loads(raw)
        cats = [c for c in data.get("categories", []) if c in CATEGORIES]
        cat = data.get("category") if data.get("category") in CATEGORIES else local["category"]
        merged = dict(local)
        merged.update({
            "category": cat,
            "categories": cats or [cat],
            "keywords": (data.get("keywords") or local["keywords"])[:8],
            "explanation": [f"External AI ({AI_MODEL}): {data.get('rationale', '')}"] + local["explanation"],
            "engine": "external-ai+rule-based",
        })
        return merged
    except Exception as exc:  # noqa: BLE001 - any failure falls back to local
        log.warning("External AI unavailable, using local classifier: %s", exc)
        return local
