import uuid
from dataclasses import dataclass
from typing import Dict, Optional

from fastapi import WebSocket, WebSocketDisconnect

from database import SessionLocal
from models import Meeting


# ============================================================
# CONNECTED PARTICIPANT
# ============================================================

@dataclass
class ConnectedParticipant:
    id: str
    name: str
    websocket: WebSocket

    is_host: bool = False
    admitted: bool = False

    mic_on: bool = False
    camera_on: bool = False


# ============================================================
# CONNECTION MANAGER
# ============================================================

class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[
            str,
            Dict[str, ConnectedParticipant],
        ] = {}

    # ========================================================
    # CONNECT
    # ========================================================

    async def connect(
        self,
        meeting_id: str,
        websocket: WebSocket,
    ) -> str:
        await websocket.accept()

        participant_id = str(
            uuid.uuid4()
        )

        if meeting_id not in self.rooms:
            self.rooms[meeting_id] = {}

        participant = ConnectedParticipant(
            id=participant_id,
            name="Guest",
            websocket=websocket,
            is_host=False,
            admitted=False,
            mic_on=False,
            camera_on=False,
        )

        self.rooms[meeting_id][
            participant_id
        ] = participant

        return participant_id

    # ========================================================
    # GET PARTICIPANT
    # ========================================================

    def get_participant(
        self,
        meeting_id: str,
        participant_id: str,
    ) -> Optional[ConnectedParticipant]:
        room = self.rooms.get(
            meeting_id
        )

        if not room:
            return None

        return room.get(
            participant_id
        )

    # ========================================================
    # GET HOST
    # ========================================================

    def get_host(
        self,
        meeting_id: str,
    ) -> Optional[ConnectedParticipant]:
        room = self.rooms.get(
            meeting_id,
            {},
        )

        for participant in room.values():
            if (
                participant.is_host
                and participant.admitted
            ):
                return participant

        return None

    # ========================================================
    # GET ADMITTED PARTICIPANTS
    # ========================================================

    def get_admitted_participants(
        self,
        meeting_id: str,
        exclude_id: Optional[str] = None,
    ):
        room = self.rooms.get(
            meeting_id,
            {},
        )

        participants = []

        for participant in room.values():
            if not participant.admitted:
                continue

            if (
                exclude_id
                and participant.id
                == exclude_id
            ):
                continue

            participants.append(
                {
                    "id": participant.id,
                    "name": participant.name,
                    "is_host": participant.is_host,
                    "mic_on": participant.mic_on,
                    "camera_on": participant.camera_on,
                }
            )

        return participants

    # ========================================================
    # GET WAITING PARTICIPANTS
    # ========================================================

    def get_waiting_participants(
        self,
        meeting_id: str,
    ):
        room = self.rooms.get(
            meeting_id,
            {},
        )

        waiting = []

        for participant in room.values():
            if (
                not participant.admitted
                and not participant.is_host
                and participant.name != "Guest"
            ):
                waiting.append(
                    {
                        "participant_id": participant.id,
                        "name": participant.name,
                        "status": "waiting",
                    }
                )

        return waiting

    # ========================================================
    # UPDATE PARTICIPANT
    # ========================================================

    def set_name(
        self,
        meeting_id: str,
        participant_id: str,
        name: str,
    ):
        participant = self.get_participant(
            meeting_id,
            participant_id,
        )

        if participant:
            participant.name = name

    def set_host(
        self,
        meeting_id: str,
        participant_id: str,
        is_host: bool,
    ):
        participant = self.get_participant(
            meeting_id,
            participant_id,
        )

        if participant:
            participant.is_host = is_host

    def set_admitted(
        self,
        meeting_id: str,
        participant_id: str,
        admitted: bool,
    ):
        participant = self.get_participant(
            meeting_id,
            participant_id,
        )

        if participant:
            participant.admitted = admitted

    # ========================================================
    # MEDIA STATE
    # ========================================================

    def set_media_state(
        self,
        meeting_id: str,
        participant_id: str,
        microphone: bool,
        camera: bool,
    ):
        participant = self.get_participant(
            meeting_id,
            participant_id,
        )

        if not participant:
            return

        participant.mic_on = microphone
        participant.camera_on = camera

    # ========================================================
    # SEND TO PARTICIPANT
    # ========================================================

    async def send_to_participant(
        self,
        meeting_id: str,
        participant_id: str,
        message: dict,
    ):
        participant = self.get_participant(
            meeting_id,
            participant_id,
        )

        if not participant:
            return False

        try:
            await participant.websocket.send_json(
                message
            )

            return True

        except Exception:
            return False

    # ========================================================
    # SEND TO HOST
    # ========================================================

    async def send_to_host(
        self,
        meeting_id: str,
        message: dict,
    ):
        host = self.get_host(
            meeting_id
        )

        if not host:
            return False

        try:
            await host.websocket.send_json(
                message
            )

            return True

        except Exception:
            return False

    # ========================================================
    # BROADCAST TO ADMITTED PARTICIPANTS
    # ========================================================

    async def broadcast_admitted(
        self,
        meeting_id: str,
        message: dict,
        exclude_id: Optional[str] = None,
    ):
        room = self.rooms.get(
            meeting_id,
            {},
        )

        disconnected = []

        for (
            participant_id,
            participant,
        ) in list(room.items()):

            if not participant.admitted:
                continue

            if (
                exclude_id
                and participant_id
                == exclude_id
            ):
                continue

            try:
                await participant.websocket.send_json(
                    message
                )

            except Exception:
                disconnected.append(
                    participant_id
                )

        for participant_id in disconnected:
            room.pop(
                participant_id,
                None,
            )

    # ========================================================
    # DISCONNECT
    # ========================================================

    def disconnect(
        self,
        meeting_id: str,
        participant_id: str,
    ):
        room = self.rooms.get(
            meeting_id
        )

        if not room:
            return

        room.pop(
            participant_id,
            None,
        )

        if not room:
            self.rooms.pop(
                meeting_id,
                None,
            )


# ============================================================
# MANAGER
# ============================================================

manager = ConnectionManager()


# ============================================================
# DATABASE HELPERS
# ============================================================

def get_meeting_from_database(
    meeting_id: str,
):
    db = SessionLocal()

    try:
        meeting = (
            db.query(Meeting)
            .filter(
                Meeting.id == meeting_id
            )
            .first()
        )

        if not meeting:
            return None

        return {
            "id": meeting.id,
            "host_id": meeting.host_id,
            "host_token": meeting.host_token,
            "waiting_room_enabled":
                meeting.waiting_room_enabled,
        }

    finally:
        db.close()


def verify_host_token(
    meeting_id: str,
    host_token: Optional[str],
) -> bool:
    if not host_token:
        return False

    meeting = get_meeting_from_database(
        meeting_id
    )

    if not meeting:
        return False

    return (
        host_token
        == meeting["host_token"]
    )


# ============================================================
# WEBSOCKET HANDLER
# ============================================================

async def handle_websocket(
    websocket: WebSocket,
    meeting_id: str,
):
    # ========================================================
    # CHECK MEETING
    # ========================================================

    meeting = get_meeting_from_database(
        meeting_id
    )

    if not meeting:
        await websocket.accept()

        await websocket.send_json(
            {
                "type": "meeting-not-found",
                "message":
                    "This meeting does not exist.",
            }
        )

        await websocket.close(
            code=4004
        )

        return

    # ========================================================
    # CONNECT
    # ========================================================

    participant_id = await manager.connect(
        meeting_id,
        websocket,
    )

    joined = False

    try:
        await websocket.send_json(
            {
                "type": "connected",
                "participant_id":
                    participant_id,
            }
        )

        # ====================================================
        # MESSAGE LOOP
        # ====================================================

        while True:
            message = (
                await websocket.receive_json()
            )

            message_type = message.get(
                "type"
            )

            # =================================================
            # JOIN
            # =================================================

            if message_type == "join":
                if joined:
                    continue

                name = str(
                    message.get(
                        "name",
                        "Guest",
                    )
                ).strip()

                if not name:
                    name = "Guest"

                host_token = message.get(
                    "host_token"
                )

                manager.set_name(
                    meeting_id,
                    participant_id,
                    name,
                )

                is_host = verify_host_token(
                    meeting_id,
                    host_token,
                )

                manager.set_host(
                    meeting_id,
                    participant_id,
                    is_host,
                )

                joined = True

                # =============================================
                # HOST
                # =============================================

                if is_host:
                    manager.set_admitted(
                        meeting_id,
                        participant_id,
                        True,
                    )

                    await websocket.send_json(
                        {
                            "type":
                                "host-authenticated",
                            "participant_id":
                                participant_id,
                            "is_host": True,
                        }
                    )

                    existing_participants = (
                        manager.get_admitted_participants(
                            meeting_id,
                            exclude_id=
                                participant_id,
                        )
                    )

                    await websocket.send_json(
                        {
                            "type":
                                "room-participants",
                            "participant_id":
                                participant_id,
                            "participants":
                                existing_participants,
                        }
                    )

                    waiting = (
                        manager.get_waiting_participants(
                            meeting_id
                        )
                    )

                    await websocket.send_json(
                        {
                            "type":
                                "waiting-participants",
                            "participants":
                                waiting,
                        }
                    )

                    await manager.broadcast_admitted(
                        meeting_id,
                        {
                            "type":
                                "participant-joined",
                            "participant_id":
                                participant_id,
                            "participant_name":
                                name,
                            "is_host": True,
                            "mic_on": False,
                            "camera_on": False,
                        },
                        exclude_id=
                            participant_id,
                    )

                    continue

                # =============================================
                # GUEST WITHOUT WAITING ROOM
                # =============================================

                if not meeting[
                    "waiting_room_enabled"
                ]:
                    manager.set_admitted(
                        meeting_id,
                        participant_id,
                        True,
                    )

                    existing_participants = (
                        manager.get_admitted_participants(
                            meeting_id,
                            exclude_id=
                                participant_id,
                        )
                    )

                    await websocket.send_json(
                        {
                            "type": "admitted",
                            "participant_id":
                                participant_id,
                        }
                    )

                    await websocket.send_json(
                        {
                            "type":
                                "room-participants",
                            "participant_id":
                                participant_id,
                            "participants":
                                existing_participants,
                        }
                    )

                    await manager.broadcast_admitted(
                        meeting_id,
                        {
                            "type":
                                "participant-joined",
                            "participant_id":
                                participant_id,
                            "participant_name":
                                name,
                            "is_host": False,
                            "mic_on": False,
                            "camera_on": False,
                        },
                        exclude_id=
                            participant_id,
                    )

                    continue

                # =============================================
                # WAITING ROOM
                # =============================================

                manager.set_admitted(
                    meeting_id,
                    participant_id,
                    False,
                )

                await websocket.send_json(
                    {
                        "type": "waiting",
                        "participant_id":
                            participant_id,
                        "message":
                            "Waiting for the host to let you in.",
                    }
                )

                host_available = (
                    await manager.send_to_host(
                        meeting_id,
                        {
                            "type":
                                "join-request",
                            "participant_id":
                                participant_id,
                            "participant_name":
                                name,
                        },
                    )
                )

                if not host_available:
                    await websocket.send_json(
                        {
                            "type":
                                "host-not-connected",
                            "message":
                                "Waiting for the host to join the meeting.",
                        }
                    )

                continue

            # =================================================
            # MUST JOIN FIRST
            # =================================================

            if not joined:
                continue

            current_participant = (
                manager.get_participant(
                    meeting_id,
                    participant_id,
                )
            )

            if not current_participant:
                continue

            # =================================================
            # HOST: ADMIT
            # =================================================

            if (
                message_type
                == "admit-participant"
            ):
                if not current_participant.is_host:
                    await websocket.send_json(
                        {
                            "type":
                                "admin-error",
                            "message":
                                "Only the host can admit participants.",
                        }
                    )

                    continue

                target_id = message.get(
                    "participant_id"
                )

                if not target_id:
                    continue

                target = (
                    manager.get_participant(
                        meeting_id,
                        target_id,
                    )
                )

                if not target:
                    await websocket.send_json(
                        {
                            "type":
                                "admin-error",
                            "message":
                                "Participant is no longer waiting.",
                        }
                    )

                    continue

                if target.admitted:
                    continue

                existing_participants = (
                    manager.get_admitted_participants(
                        meeting_id,
                        exclude_id=target_id,
                    )
                )

                target.admitted = True

                await manager.send_to_participant(
                    meeting_id,
                    target_id,
                    {
                        "type":
                            "admitted",
                        "participant_id":
                            target_id,
                    },
                )

                await manager.send_to_participant(
                    meeting_id,
                    target_id,
                    {
                        "type":
                            "room-participants",
                        "participant_id":
                            target_id,
                        "participants":
                            existing_participants,
                    },
                )

                await manager.broadcast_admitted(
                    meeting_id,
                    {
                        "type":
                            "participant-joined",
                        "participant_id":
                            target.id,
                        "participant_name":
                            target.name,
                        "is_host": False,
                        "mic_on":
                            target.mic_on,
                        "camera_on":
                            target.camera_on,
                    },
                    exclude_id=target_id,
                )

                await websocket.send_json(
                    {
                        "type":
                            "participant-admitted",
                        "participant_id":
                            target_id,
                        "participant_name":
                            target.name,
                    }
                )

                continue

            # =================================================
            # HOST: DENY
            # =================================================

            if (
                message_type
                == "deny-participant"
            ):
                if not current_participant.is_host:
                    await websocket.send_json(
                        {
                            "type":
                                "admin-error",
                            "message":
                                "Only the host can deny participants.",
                        }
                    )

                    continue

                target_id = message.get(
                    "participant_id"
                )

                if not target_id:
                    continue

                target = (
                    manager.get_participant(
                        meeting_id,
                        target_id,
                    )
                )

                if not target:
                    continue

                if target.admitted:
                    continue

                await manager.send_to_participant(
                    meeting_id,
                    target_id,
                    {
                        "type": "denied",
                        "message":
                            "The host did not admit you to this meeting.",
                    },
                )

                await websocket.send_json(
                    {
                        "type":
                            "participant-denied",
                        "participant_id":
                            target_id,
                        "participant_name":
                            target.name,
                    }
                )

                manager.disconnect(
                    meeting_id,
                    target_id,
                )

                continue

            # =================================================
            # HOST: FORCE MUTE
            # =================================================

            if message_type == "force-mute":
                if not current_participant.is_host:
                    await websocket.send_json(
                        {
                            "type":
                                "admin-error",
                            "message":
                                "Only the host can mute participants.",
                        }
                    )

                    continue

                target_id = message.get(
                    "participant_id"
                )

                if not target_id:
                    continue

                if (
                    target_id
                    == participant_id
                ):
                    continue

                target = (
                    manager.get_participant(
                        meeting_id,
                        target_id,
                    )
                )

                if (
                    not target
                    or not target.admitted
                    or target.is_host
                ):
                    continue

                # -------------------------------------------------
                # IMPORTANT
                # -------------------------------------------------
                #
                # We change ONLY the microphone state here.
                #
                # We DO NOT broadcast camera state because the
                # server's stored camera value may be stale.
                #
                # The target browser receives force-mute,
                # disables its real microphone, and then sends
                # its complete REAL media-state back.
                # -------------------------------------------------

                target.mic_on = False

                await manager.send_to_participant(
                    meeting_id,
                    target_id,
                    {
                        "type":
                            "force-mute",
                        "message":
                            "The host muted your microphone.",
                    },
                )

                await websocket.send_json(
                    {
                        "type":
                            "admin-action-complete",
                        "action":
                            "force-mute",
                        "participant_id":
                            target_id,
                    }
                )

                continue

            # =================================================
            # HOST: FORCE CAMERA OFF
            # =================================================

            if (
                message_type
                == "force-camera-off"
            ):
                if not current_participant.is_host:
                    await websocket.send_json(
                        {
                            "type":
                                "admin-error",
                            "message":
                                "Only the host can turn off participant cameras.",
                        }
                    )

                    continue

                target_id = message.get(
                    "participant_id"
                )

                if not target_id:
                    continue

                if (
                    target_id
                    == participant_id
                ):
                    continue

                target = (
                    manager.get_participant(
                        meeting_id,
                        target_id,
                    )
                )

                if (
                    not target
                    or not target.admitted
                    or target.is_host
                ):
                    continue

                # -------------------------------------------------
                # IMPORTANT
                # -------------------------------------------------
                #
                # Change ONLY camera state here.
                #
                # Do NOT broadcast the server's stored microphone
                # value because it may be stale.
                #
                # The participant browser will disable the actual
                # video track and send its complete REAL state.
                # -------------------------------------------------

                target.camera_on = False

                await manager.send_to_participant(
                    meeting_id,
                    target_id,
                    {
                        "type":
                            "force-camera-off",
                        "message":
                            "The host turned off your camera.",
                    },
                )

                await websocket.send_json(
                    {
                        "type":
                            "admin-action-complete",
                        "action":
                            "force-camera-off",
                        "participant_id":
                            target_id,
                    }
                )

                continue

            # =================================================
            # HOST: REMOVE PARTICIPANT
            # =================================================

            if (
                message_type
                == "remove-participant"
            ):
                if not current_participant.is_host:
                    await websocket.send_json(
                        {
                            "type":
                                "admin-error",
                            "message":
                                "Only the host can remove participants.",
                        }
                    )

                    continue

                target_id = message.get(
                    "participant_id"
                )

                if not target_id:
                    continue

                if (
                    target_id
                    == participant_id
                ):
                    continue

                target = (
                    manager.get_participant(
                        meeting_id,
                        target_id,
                    )
                )

                if (
                    not target
                    or not target.admitted
                    or target.is_host
                ):
                    continue

                target_name = (
                    target.name
                )

                # Tell participant first.
                await manager.send_to_participant(
                    meeting_id,
                    target_id,
                    {
                        "type":
                            "removed",
                        "message":
                            "The host removed you from the meeting.",
                    },
                )

                # Remove from server room.
                manager.disconnect(
                    meeting_id,
                    target_id,
                )

                # Tell remaining participants.
                await manager.broadcast_admitted(
                    meeting_id,
                    {
                        "type":
                            "participant-left",
                        "participant_id":
                            target_id,
                        "participant_name":
                            target_name,
                        "removed_by_host":
                            True,
                    },
                    exclude_id=None,
                )

                await websocket.send_json(
                    {
                        "type":
                            "admin-action-complete",
                        "action":
                            "remove-participant",
                        "participant_id":
                            target_id,
                    }
                )

                continue

            # =================================================
            # WAITING USERS CANNOT SIGNAL
            # =================================================

            current_participant = (
                manager.get_participant(
                    meeting_id,
                    participant_id,
                )
            )

            if (
                not current_participant
                or not current_participant.admitted
            ):
                continue

            # =================================================
            # WEBRTC OFFER
            # =================================================

            if message_type == "offer":
                target_id = message.get(
                    "to"
                )

                if not target_id:
                    continue

                target = (
                    manager.get_participant(
                        meeting_id,
                        target_id,
                    )
                )

                if (
                    not target
                    or not target.admitted
                ):
                    continue

                await manager.send_to_participant(
                    meeting_id,
                    target_id,
                    {
                        "type": "offer",
                        "from":
                            participant_id,
                        "participant_name":
                            current_participant.name,
                        "data":
                            message.get(
                                "data"
                            ),
                    },
                )

                continue

            # =================================================
            # WEBRTC ANSWER
            # =================================================

            if message_type == "answer":
                target_id = message.get(
                    "to"
                )

                if not target_id:
                    continue

                target = (
                    manager.get_participant(
                        meeting_id,
                        target_id,
                    )
                )

                if (
                    not target
                    or not target.admitted
                ):
                    continue

                await manager.send_to_participant(
                    meeting_id,
                    target_id,
                    {
                        "type":
                            "answer",
                        "from":
                            participant_id,
                        "data":
                            message.get(
                                "data"
                            ),
                    },
                )

                continue

            # =================================================
            # ICE
            # =================================================

            if (
                message_type
                == "ice-candidate"
            ):
                target_id = message.get(
                    "to"
                )

                if not target_id:
                    continue

                target = (
                    manager.get_participant(
                        meeting_id,
                        target_id,
                    )
                )

                if (
                    not target
                    or not target.admitted
                ):
                    continue

                await manager.send_to_participant(
                    meeting_id,
                    target_id,
                    {
                        "type":
                            "ice-candidate",
                        "from":
                            participant_id,
                        "data":
                            message.get(
                                "data"
                            ),
                    },
                )

                continue

            # =================================================
            # MEDIA STATE
            # =================================================

            if (
                message_type
                == "media-state"
            ):
                media = message.get(
                    "media",
                    {},
                )

                microphone = bool(
                    media.get(
                        "microphone",
                        False,
                    )
                )

                camera = bool(
                    media.get(
                        "camera",
                        False,
                    )
                )

                # This is now the authoritative
                # participant media state.
                manager.set_media_state(
                    meeting_id,
                    participant_id,
                    microphone,
                    camera,
                )

                # Broadcast REAL state to everybody
                # except the sender.
                await manager.broadcast_admitted(
                    meeting_id,
                    {
                        "type":
                            "media-state",
                        "from":
                            participant_id,
                        "media": {
                            "microphone":
                                microphone,
                            "camera":
                                camera,
                        },
                    },
                    exclude_id=
                        participant_id,
                )

                continue

            # =================================================
            # CHAT
            # =================================================

            if message_type == "chat":
                chat_message = str(
                    message.get(
                        "message",
                        "",
                    )
                ).strip()

                if not chat_message:
                    continue

                await manager.broadcast_admitted(
                    meeting_id,
                    {
                        "type":
                            "chat",
                        "from":
                            participant_id,
                        "name":
                            current_participant.name,
                        "message":
                            chat_message,
                    },
                    exclude_id=None,
                )

                continue

    # ========================================================
    # DISCONNECT
    # ========================================================

    except WebSocketDisconnect:
        pass

    except Exception as error:
        print(
            "WebSocket error:",
            error,
        )

    finally:
        participant = (
            manager.get_participant(
                meeting_id,
                participant_id,
            )
        )

        if participant:
            participant_name = (
                participant.name
            )

            was_admitted = (
                participant.admitted
            )

            was_host = (
                participant.is_host
            )

        else:
            participant_name = (
                "Participant"
            )

            was_admitted = False
            was_host = False

        manager.disconnect(
            meeting_id,
            participant_id,
        )

        if (
            joined
            and was_admitted
        ):
            await manager.broadcast_admitted(
                meeting_id,
                {
                    "type":
                        "participant-left",
                    "participant_id":
                        participant_id,
                    "participant_name":
                        participant_name,
                    "was_host":
                        was_host,
                },
            )

        elif joined:
            await manager.send_to_host(
                meeting_id,
                {
                    "type":
                        "waiting-participant-left",
                    "participant_id":
                        participant_id,
                },
            )