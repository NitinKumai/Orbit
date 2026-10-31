from datetime import datetime

from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    WebSocket,
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Meeting, Participant
from schemas import (
    HostVerifyRequest,
    HostVerifyResponse,
    MeetingCreate,
    MeetingCreateResponse,
    MeetingResponse,
    MeetingSchedule,
    ParticipantCreate,
    ParticipantResponse,
)
from websocket import handle_websocket


# ============================================================
# DATABASE
# ============================================================

Base.metadata.create_all(bind=engine)


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="Meetly API",
    description=(
        "Backend API for the Meetly "
        "video meeting application."
    ),
    version="1.1.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# BASIC ROUTES
# ============================================================

@app.get("/")
def root():
    return {
        "message": "Meetly backend is running",
        "status": "ok",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
    }


# ============================================================
# CREATE MEETING
# ============================================================
#
# IMPORTANT:
#
# This is the ONLY normal endpoint that returns host_token.
#
# The person creating the meeting receives the secret token.
# A guest fetching the meeting later will NOT receive it.
# ============================================================

@app.post(
    "/meetings",
    response_model=MeetingCreateResponse,
)
def create_meeting(
    meeting_data: MeetingCreate,
    db: Session = Depends(get_db),
):
    title = meeting_data.title.strip()

    if not title:
        title = "Instant Meeting"

    meeting = Meeting(
        title=title,
        waiting_room_enabled=True,
    )

    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    return meeting


# ============================================================
# GET PUBLIC MEETING INFORMATION
# ============================================================
#
# host_token is intentionally excluded by MeetingResponse.
# ============================================================

@app.get(
    "/meetings/{meeting_id}",
    response_model=MeetingResponse,
)
def get_meeting(
    meeting_id: str,
    db: Session = Depends(get_db),
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found",
        )

    return meeting


# ============================================================
# VERIFY HOST TOKEN
# ============================================================
#
# Frontend can use this to verify whether the credential
# stored in the creator's browser is still valid.
# ============================================================

@app.post(
    "/meetings/{meeting_id}/verify-host",
    response_model=HostVerifyResponse,
)
def verify_host(
    meeting_id: str,
    request: HostVerifyRequest,
    db: Session = Depends(get_db),
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found",
        )

    valid = (
        request.host_token
        == meeting.host_token
    )

    return HostVerifyResponse(
        valid=valid,
        meeting_id=meeting.id,
        host_id=(
            meeting.host_id
            if valid
            else None
        ),
    )


# ============================================================
# REGISTER PARTICIPANT
# ============================================================
#
# NOTE:
#
# Once the waiting-room WebSocket flow is active,
# ordinary guests should NOT call this before admission.
#
# The endpoint remains available because the existing frontend
# and other flows may still use it during this transition.
# ============================================================

@app.post(
    "/meetings/{meeting_id}/participants",
    response_model=ParticipantResponse,
)
def join_meeting(
    meeting_id: str,
    participant_data: ParticipantCreate,
    db: Session = Depends(get_db),
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found",
        )

    name = (
        participant_data.name.strip()
    )

    if not name:
        raise HTTPException(
            status_code=400,
            detail=(
                "Participant name "
                "cannot be empty"
            ),
        )

    participant = Participant(
        meeting_id=meeting_id,
        name=name,

        # REST participant registration
        # never grants host privileges.
        is_host=False,

        # This endpoint represents an
        # already-admitted participant.
        admitted=True,
    )

    db.add(participant)
    db.commit()
    db.refresh(participant)

    return participant


# ============================================================
# REGISTER HOST AS PARTICIPANT
# ============================================================
#
# Only somebody with the correct host token can use this.
#
# This gives the creator a persistent participant DB record.
# ============================================================

@app.post(
    "/meetings/{meeting_id}/host/participant",
    response_model=ParticipantResponse,
)
def register_host_participant(
    meeting_id: str,
    participant_data: ParticipantCreate,
    host_token: str,
    db: Session = Depends(get_db),
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found",
        )

    if (
        host_token
        != meeting.host_token
    ):
        raise HTTPException(
            status_code=403,
            detail="Invalid host credentials",
        )

    name = (
        participant_data.name.strip()
    )

    if not name:
        raise HTTPException(
            status_code=400,
            detail=(
                "Host name cannot be empty"
            ),
        )

    # Avoid creating duplicate host records
    # if the creator refreshes/re-enters.
    existing_host = (
        db.query(Participant)
        .filter(
            Participant.meeting_id
            == meeting_id,
            Participant.is_host
            == True,
        )
        .first()
    )

    if existing_host:
        existing_host.name = name
        existing_host.admitted = True

        db.commit()
        db.refresh(existing_host)

        return existing_host

    participant = Participant(
        meeting_id=meeting_id,
        name=name,
        is_host=True,
        admitted=True,
    )

    db.add(participant)
    db.commit()
    db.refresh(participant)

    return participant


# ============================================================
# GET PARTICIPANTS
# ============================================================

@app.get(
    "/meetings/{meeting_id}/participants",
    response_model=list[ParticipantResponse],
)
def get_participants(
    meeting_id: str,
    db: Session = Depends(get_db),
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found",
        )

    participants = (
        db.query(Participant)
        .filter(
            Participant.meeting_id
            == meeting_id,
            Participant.admitted
            == True,
        )
        .order_by(
            Participant.joined_at.asc()
        )
        .all()
    )

    return participants


# ============================================================
# SCHEDULE MEETING
# ============================================================

@app.post(
    "/meetings/schedule",
    response_model=MeetingCreateResponse,
)
def schedule_meeting(
    meeting_data: MeetingSchedule,
    db: Session = Depends(get_db),
):
    try:
        scheduled_at = (
            datetime.strptime(
                (
                    f"{meeting_data.date} "
                    f"{meeting_data.time}"
                ),
                "%Y-%m-%d %H:%M",
            )
        )

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid date or "
                "time format"
            ),
        )

    title = (
        meeting_data.title.strip()
    )

    if not title:
        raise HTTPException(
            status_code=400,
            detail=(
                "Meeting title "
                "cannot be empty"
            ),
        )

    meeting = Meeting(
        title=title,
        scheduled_at=scheduled_at,
        waiting_room_enabled=True,
    )

    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    # The person scheduling the meeting
    # is treated as its creator and therefore
    # receives the host token.
    return meeting


# ============================================================
# END MEETING
# ============================================================
#
# Host token is REQUIRED.
# A normal participant cannot delete/end the meeting.
# ============================================================

@app.delete(
    "/meetings/{meeting_id}",
)
def delete_meeting(
    meeting_id: str,
    host_token: str,
    db: Session = Depends(get_db),
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found",
        )

    if (
        host_token
        != meeting.host_token
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Only the host can "
                "end this meeting"
            ),
        )

    db.delete(meeting)
    db.commit()

    return {
        "message": "Meeting ended",
        "meeting_id": meeting_id,
    }


# ============================================================
# WEBSOCKET SIGNALING
# ============================================================
#
# Stage 1 waiting-room authorization will be enforced
# inside websocket.py.
#
# host_token will be supplied through the WebSocket's
# initial join message rather than exposed in the meeting URL.
# ============================================================

@app.websocket(
    "/ws/meetings/{meeting_id}"
)
async def meeting_websocket(
    websocket: WebSocket,
    meeting_id: str,
):
    await handle_websocket(
        websocket,
        meeting_id,
    )