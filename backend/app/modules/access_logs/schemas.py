"""Pydantic schemas for the access-logs API (access-logs spec).

``AccessLogOut`` exposes the immutable audit row: ``user_id``, the
``timestamp`` captured at write time, and the ``action`` (``<resource>.
<verb>`` or ``login``). Read-only projection — the endpoint never mutates.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AccessLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    timestamp: datetime
    action: str