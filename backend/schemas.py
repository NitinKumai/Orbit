from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ============================================================
# CREATE MEETING
# ============================================================

class MeetingCreate(BaseModel):
    title: str = "Instant Meeting"


# ============================================================
# SCHEDULE MEETING
# ============================================================

class MeetingSchedule(BaseModel):
    title: str
    date: str
    time: str


# ============================================================
# PARTICIPANT
# ============================================================

class ParticipantCreate(BaseModel):
    name: str


class ParticipantResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: str
    name: str

    is_host: bool
    admitted: bool

    joined_at: datetime


# ============================================================
# PUBLIC MEETING RESPONSE
# ============================================================
#
# This response is safe to send to guests.
#
# IMPORTANT:
# host_token is intentionally NOT included.
# ============================================================

class MeetingResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: str
    title: str

    host_id: Optional[str] = None

    waiting_room_enabled: bool

    scheduled_at: Optional[datetime] = None
    created_at: datetime


# ============================================================
# MEETING CREATION RESPONSE
# ============================================================
#
# Only returned immediately after a meeting is created.
#
# The creator receives the secret host_token.
# Guests must never receive this response/token.
# ============================================================

class MeetingCreateResponse(BaseModel):
    id: str
    title: str

    host_id: str
    host_token: str

    waiting_room_enabled: bool

    scheduled_at: Optional[datetime] = None
    created_at: datetime


# ============================================================
# HOST VERIFICATION
# ============================================================

class HostVerifyRequest(BaseModel):
    host_token: str


class HostVerifyResponse(BaseModel):
    valid: bool
    meeting_id: str
    host_id: Optional[str] = None


# ============================================================
# WAITING ROOM
# ============================================================

class JoinRequestCreate(BaseModel):
    name: str


class WaitingParticipantResponse(BaseModel):
    participant_id: str
    name: str
    status: str = "waiting"


# ============================================================
# ADMISSION ACTION
# ============================================================

class AdmissionAction(BaseModel):
    participant_id: str
    host_token: str


# ============================================================
# GENERIC MESSAGE RESPONSE
# ============================================================

class MessageResponse(BaseModel):
    message: str