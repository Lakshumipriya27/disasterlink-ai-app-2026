"""Tiny in-memory per-IP rate limiter for unauthenticated public POST endpoints."""
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_hits: dict[str, deque] = defaultdict(deque)


def public_rate_limit(request: Request, limit: int = 120, window: int = 60):
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    q = _hits[ip]
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(429, "Too many requests from this device. Please wait a minute and try again.")
    q.append(now)
