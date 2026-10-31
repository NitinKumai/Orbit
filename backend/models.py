import secrets
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    String,
)
from sqlalchemy.orm import relationship

from database import Base


# ============================================================
# MEETING
# ============================================================

class Meeting(Base):
    __tablename__ = "meetings"

    # Unique meeting ID used in meeting URLs.
    id = Column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )

    title = Column(
        String,
        nullable=False,
        default="Instant Meeting",
    )

    # --------------------------------------------------------
    # HOST IDENTITY
    # --------------------------------------------------------
    #
    # host_id:
    # Persistent identifier for the meeting host.
    #
    # This is NOT the WebSocket participant ID because
    # WebSocket IDs change whenever somebody reconnects.
    #
    host_id = Column(
        String,
        nullable=False,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )

    # --------------------------------------------------------
    # HOST TOKEN
    # --------------------------------------------------------
    #
    # Secret credential given only to the person who creates
    # the meeting.
    #
    # Guests must never receive this value.
    #
    # Later WebSocket admin actions will require this token.
    #
    host_token = Column(
        String,
        nullable=False,
        default=lambda: secrets.token_urlsafe(32),
        unique=True,
        index=True,
    )

    # --------------------------------------------------------
    # WAITING ROOM
    # --------------------------------------------------------

    waiting_room_enabled = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    # --------------------------------------------------------
    # SCHEDULE
    # --------------------------------------------------------

    scheduled_at = Column(
        DateTime,
        nullable=True,
    )

    # --------------------------------------------------------
    # CREATED
    # --------------------------------------------------------

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    # --------------------------------------------------------
    # PARTICIPANTS
    # --------------------------------------------------------

    participants = relationship(
        "Participant",
        back_populates="meeting",
        cascade="all, delete-orphan",
    )


# ============================================================
# PARTICIPANT
# ============================================================

class Participant(Base):
    __tablename__ = "participants"

    id = Column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )

    meeting_id = Column(
        String,
        ForeignKey("meetings.id"),
        nullable=False,
        index=True,
    )

    name = Column(
        String,
        nullable=False,
    )

    # --------------------------------------------------------
    # HOST FLAG
    # --------------------------------------------------------

    is_host = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    # --------------------------------------------------------
    # ADMISSION STATE
    # --------------------------------------------------------
    #
    # The host is admitted immediately.
    #
    # Guests will only be persisted as admitted participants
    # after the waiting-room flow allows them into the room.
    #

    admitted = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    # --------------------------------------------------------
    # JOIN TIME
    # --------------------------------------------------------

    joined_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    # --------------------------------------------------------
    # RELATIONSHIP
    # --------------------------------------------------------

    meeting = relationship(
        "Meeting",
        back_populates="participants",
    )