import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getStoredHostToken,
  getWebSocketUrl,
} from "../utils/api";


// ============================================================
// TYPES
// ============================================================

export interface RemoteParticipant {
  id: string;
  name: string;
  stream?: MediaStream;

  micOn: boolean;
  cameraOn: boolean;

  isHost: boolean;
}


export interface WaitingParticipant {
  participantId: string;
  name: string;
}


export type AdmissionStatus =
  | "connecting"
  | "waiting"
  | "admitted"
  | "denied"
  | "removed"
  | "error";


interface RoomParticipant {
  id: string;
  name: string;

  is_host?: boolean;

  mic_on?: boolean;
  camera_on?: boolean;
}


interface SignalMessage {
  type: string;

  participant_id?: string;
  participant_name?: string;

  from?: string;
  to?: string;

  is_host?: boolean;

  participants?: RoomParticipant[];

  data?:
    | RTCSessionDescriptionInit
    | RTCIceCandidateInit;

  media?: {
    microphone?: boolean;
    camera?: boolean;
  };

  message?: string;
}


// ============================================================
// WEBRTC HOOK
// ============================================================

export function useWebRTC(
  meetingId: string,
  participantName: string
) {
  // ==========================================================
  // STATE
  // ==========================================================

  const [
    localStream,
    setLocalStream,
  ] =
    useState<MediaStream | null>(
      null
    );

  const [
    participants,
    setParticipants,
  ] =
    useState<
      RemoteParticipant[]
    >([]);

  const [
    waitingParticipants,
    setWaitingParticipants,
  ] =
    useState<
      WaitingParticipant[]
    >([]);

  const [
    micOn,
    setMicOn,
  ] =
    useState(false);

  const [
    cameraOn,
    setCameraOn,
  ] =
    useState(false);

  const [
    connected,
    setConnected,
  ] =
    useState(false);

  const [
    isHost,
    setIsHost,
  ] =
    useState(false);

  const [
    admissionStatus,
    setAdmissionStatus,
  ] =
    useState<AdmissionStatus>(
      "connecting"
    );

  const [
    admissionMessage,
    setAdmissionMessage,
  ] =
    useState(
      "Connecting to meeting..."
    );

  // ==========================================================
  // REFS
  // ==========================================================

  const socketRef =
    useRef<WebSocket | null>(
      null
    );

  const localStreamRef =
    useRef<MediaStream | null>(
      null
    );

  const peersRef =
    useRef(
      new Map<
        string,
        RTCPeerConnection
      >()
    );

  const namesRef =
    useRef(
      new Map<
        string,
        string
      >()
    );

  const pendingIceRef =
    useRef(
      new Map<
        string,
        RTCIceCandidateInit[]
      >()
    );

  /*
   * Prevent overlapping offers.
   */
  const negotiatingRef =
    useRef(
      new Set<string>()
    );

  /*
   * If tracks change during negotiation,
   * negotiate again after the current
   * offer/answer cycle finishes.
   */
  const renegotiateRef =
    useRef(
      new Set<string>()
    );

  /*
   * Important because media controls
   * should only signal after admission.
   */
  const admittedRef =
    useRef(false);

  /*
   * Always-current media state.
   *
   * React state inside WebSocket callbacks can be stale.
   * These refs always contain the latest real state.
   */
  const micOnRef =
    useRef(false);

  const cameraOnRef =
    useRef(false);

  /*
   * WebSocket participant ID assigned to THIS browser.
   *
   * We use this to ignore signaling/state messages
   * that refer back to ourselves.
   */
  const selfParticipantIdRef =
    useRef<string | null>(null);

  // ==========================================================
  // SEND SIGNAL
  // ==========================================================

  const sendSignal =
    useCallback(
      (
        message: object
      ) => {
        const socket =
          socketRef.current;

        if (
          socket &&
          socket.readyState ===
            WebSocket.OPEN
        ) {
          socket.send(
            JSON.stringify(
              message
            )
          );
        }
      },
      []
    );

  // ==========================================================
  // PARTICIPANT STATE
  // ==========================================================

  const upsertParticipant =
    useCallback(
      (
        participantId: string,
        values: Partial<
          RemoteParticipant
        >
      ) => {
        setParticipants(
          (current) => {
            const exists =
              current.some(
                (
                  participant
                ) =>
                  participant.id ===
                  participantId
              );

            if (exists) {
              return current.map(
                (
                  participant
                ) =>
                  participant.id ===
                  participantId
                    ? {
                        ...participant,
                        ...values,
                      }
                    : participant
              );
            }

            return [
              ...current,
              {
                id:
                  participantId,

                name:
                  values.name ||
                  namesRef.current.get(
                    participantId
                  ) ||
                  "Participant",

                stream:
                  values.stream,

                micOn:
                  values.micOn ??
                  false,

                cameraOn:
                  values.cameraOn ??
                  false,

                isHost:
                  values.isHost ??
                  false,
              },
            ];
          }
        );
      },
      []
    );

  // ==========================================================
  // WAITING PARTICIPANT HELPERS
  // ==========================================================

  const addWaitingParticipant =
    useCallback(
      (
        participantId: string,
        name: string
      ) => {
        setWaitingParticipants(
          (current) => {
            const exists =
              current.some(
                (
                  participant
                ) =>
                  participant.participantId ===
                  participantId
              );

            if (exists) {
              return current;
            }

            return [
              ...current,
              {
                participantId,
                name,
              },
            ];
          }
        );
      },
      []
    );


  const removeWaitingParticipant =
    useCallback(
      (
        participantId: string
      ) => {
        setWaitingParticipants(
          (current) =>
            current.filter(
              (
                participant
              ) =>
                participant.participantId !==
                participantId
            )
        );
      },
      []
    );

  // ==========================================================
  // PENDING ICE
  // ==========================================================

  const flushPendingIce =
    useCallback(
      async (
        participantId: string,
        peer:
          RTCPeerConnection
      ) => {
        if (
          !peer.remoteDescription
        ) {
          return;
        }

        const pending =
          pendingIceRef.current.get(
            participantId
          ) || [];

        for (
          const candidate
          of pending
        ) {
          try {
            await peer.addIceCandidate(
              new RTCIceCandidate(
                candidate
              )
            );
          } catch (error) {
            console.error(
              "Queued ICE error:",
              error
            );
          }
        }

        pendingIceRef.current.delete(
          participantId
        );
      },
      []
    );

  // ==========================================================
  // ADD EXISTING LOCAL TRACKS
  // ==========================================================

  const addLocalTracks =
    useCallback(
      (
        peer:
          RTCPeerConnection
      ) => {
        const stream =
          localStreamRef.current;

        if (!stream) {
          return;
        }

        for (
          const track
          of stream.getTracks()
        ) {
          const sender =
            peer
              .getSenders()
              .find(
                (
                  currentSender
                ) =>
                  currentSender.track
                    ?.kind ===
                  track.kind
              );

          if (!sender) {
            peer.addTrack(
              track,
              stream
            );
          }
        }
      },
      []
    );

  // ==========================================================
  // CREATE PEER CONNECTION
  // ==========================================================

  const createPeer =
    useCallback(
      (
        participantId: string
      ) => {
        const existing =
          peersRef.current.get(
            participantId
          );

        if (existing) {
          return existing;
        }

        const peer =
          new RTCPeerConnection({
            iceServers: [
              {
                urls:
                  "stun:stun.l.google.com:19302",
              },
            ],
          });

        addLocalTracks(
          peer
        );

        // ------------------------------------------------------
        // ICE
        // ------------------------------------------------------

        peer.onicecandidate =
          (
            event
          ) => {
            if (
              !event.candidate
            ) {
              return;
            }

            sendSignal({
              type:
                "ice-candidate",

              to:
                participantId,

              data:
                event.candidate.toJSON(),
            });
          };

        // ------------------------------------------------------
        // REMOTE STREAM
        // ------------------------------------------------------

        peer.ontrack =
          (
            event
          ) => {
            const stream =
              event.streams[0];

            if (!stream) {
              return;
            }

            upsertParticipant(
              participantId,
              {
                name:
                  namesRef.current.get(
                    participantId
                  ) ||
                  "Participant",

                stream,
              }
            );
          };

        // ------------------------------------------------------
        // CONNECTION STATE
        // ------------------------------------------------------

        peer.onconnectionstatechange =
          () => {
            console.log(
              "Peer:",
              participantId,
              peer.connectionState
            );

            if (
              peer.connectionState ===
                "failed" ||
              peer.connectionState ===
                "closed"
            ) {
              peer.close();

              peersRef.current.delete(
                participantId
              );

              negotiatingRef.current.delete(
                participantId
              );

              renegotiateRef.current.delete(
                participantId
              );
            }
          };

        peersRef.current.set(
          participantId,
          peer
        );

        return peer;
      },
      [
        addLocalTracks,
        sendSignal,
        upsertParticipant,
      ]
    );

  // ==========================================================
  // NEGOTIATE
  // ==========================================================

  const negotiate =
    useCallback(
      async (
        participantId: string
      ) => {
        /*
         * Waiting guests must never
         * initiate WebRTC.
         */
        if (
          !admittedRef.current
        ) {
          return;
        }

        const peer =
          createPeer(
            participantId
          );

        if (
          negotiatingRef.current.has(
            participantId
          ) ||
          peer.signalingState !==
            "stable"
        ) {
          renegotiateRef.current.add(
            participantId
          );

          return;
        }

        negotiatingRef.current.add(
          participantId
        );

        try {
          const offer =
            await peer.createOffer();

          if (
            peer.signalingState !==
            "stable"
          ) {
            renegotiateRef.current.add(
              participantId
            );

            negotiatingRef.current.delete(
              participantId
            );

            return;
          }

          await peer.setLocalDescription(
            offer
          );

          sendSignal({
            type: "offer",

            to:
              participantId,

            data:
              peer.localDescription ||
              offer,
          });

        } catch (error) {
          console.error(
            "Negotiation error:",
            error
          );

          negotiatingRef.current.delete(
            participantId
          );
        }
      },
      [
        createPeer,
        sendSignal,
      ]
    );

  // ==========================================================
  // WEBSOCKET CONNECTION
  // ==========================================================

  useEffect(() => {
    if (
      !meetingId ||
      !participantName
    ) {
      return;
    }

    admittedRef.current =
      false;

    setAdmissionStatus(
      "connecting"
    );

    setAdmissionMessage(
      "Connecting to meeting..."
    );

    const socket =
      new WebSocket(
        getWebSocketUrl(
          meetingId
        )
      );

    socketRef.current =
      socket;

    // ----------------------------------------------------------
    // OPEN
    // ----------------------------------------------------------

    socket.onopen =
      () => {
        setConnected(true);

        /*
         * Only the creator's browser
         * should have this credential.
         */
        const hostToken =
          getStoredHostToken(
            meetingId
          );

        socket.send(
          JSON.stringify({
            type: "join",

            name:
              participantName,

            /*
             * undefined values are omitted
             * by JSON.stringify.
             */
            host_token:
              hostToken ||
              undefined,
          })
        );
      };

    // ----------------------------------------------------------
    // MESSAGE
    // ----------------------------------------------------------

    socket.onmessage =
      async (
        event
      ) => {
        try {
          const message:
            SignalMessage =
            JSON.parse(
              event.data
            );

          // ====================================================
          // CONNECTED
          // ====================================================

          if (
          message.type ===
          "connected"
          ) {
            if (
              message.participant_id
            ) {
              selfParticipantIdRef.current =
                message.participant_id;
            }

            return;
          }

          // ====================================================
          // HOST AUTHENTICATED
          // ====================================================

          if (
            message.type ===
            "host-authenticated"
          ) {
            setIsHost(true);

            admittedRef.current =
              true;

            setAdmissionStatus(
              "admitted"
            );

            setAdmissionMessage(
              ""
            );

            return;
          }

          // ====================================================
          // GUEST WAITING
          // ====================================================

          if (
            message.type ===
            "waiting"
          ) {
            setIsHost(false);

            admittedRef.current =
              false;

            setAdmissionStatus(
              "waiting"
            );

            setAdmissionMessage(
              message.message ||
                "Waiting for the host to let you in."
            );

            return;
          }

          // ====================================================
          // HOST NOT CONNECTED
          // ====================================================

          if (
            message.type ===
            "host-not-connected"
          ) {
            setAdmissionStatus(
              "waiting"
            );

            setAdmissionMessage(
              message.message ||
                "Waiting for the host to join."
            );

            return;
          }

          // ====================================================
          // GUEST ADMITTED
          // ====================================================

          if (
            message.type ===
            "admitted"
          ) {
            admittedRef.current =
              true;

            setAdmissionStatus(
              "admitted"
            );

            setAdmissionMessage(
              ""
            );

            return;
          }

          // ====================================================
          // GUEST DENIED
          // ====================================================

          if (
            message.type ===
            "denied"
          ) {
            admittedRef.current =
              false;

            setAdmissionStatus(
              "denied"
            );

            setAdmissionMessage(
              message.message ||
                "The host did not admit you."
            );

            return;
          }

          // ====================================================
          // MEETING NOT FOUND
          // ====================================================

          if (
            message.type ===
            "meeting-not-found"
          ) {
            admittedRef.current =
              false;

            setAdmissionStatus(
              "error"
            );

            setAdmissionMessage(
              message.message ||
                "Meeting not found."
            );

            return;
          }

          // ====================================================
          // WAITING PARTICIPANTS LIST
          // ====================================================

          if (
            message.type ===
            "waiting-participants"
          ) {
            /*
             * Backend uses participant_id,
             * while our React interface uses
             * participantId.
             */
            const waiting =
              (
                message.participants ||
                []
              ).map(
                (
                  participant:
                    any
                ) => ({
                  participantId:
                    participant.participant_id ||
                    participant.id,

                  name:
                    participant.name ||
                    "Guest",
                })
              );

            setWaitingParticipants(
              waiting
            );

            return;
          }

          // ====================================================
          // NEW JOIN REQUEST
          // ====================================================

          if (
            message.type ===
            "join-request"
          ) {
            if (
              !message.participant_id
            ) {
              return;
            }

            addWaitingParticipant(
              message.participant_id,

              message.participant_name ||
                "Guest"
            );

            return;
          }

          // ====================================================
          // WAITING PARTICIPANT LEFT
          // ====================================================

          if (
            message.type ===
            "waiting-participant-left"
          ) {
            if (
              message.participant_id
            ) {
              removeWaitingParticipant(
                message.participant_id
              );
            }

            return;
          }

          // ====================================================
          // HOST CONFIRMED ADMISSION
          // ====================================================

          if (
            message.type ===
            "participant-admitted"
          ) {
            if (
              message.participant_id
            ) {
              removeWaitingParticipant(
                message.participant_id
              );
            }

            return;
          }

          // ====================================================
          // HOST CONFIRMED DENIAL
          // ====================================================

          if (
            message.type ===
            "participant-denied"
          ) {
            if (
              message.participant_id
            ) {
              removeWaitingParticipant(
                message.participant_id
              );
            }

            return;
          }

          // ====================================================
          // ADMIN ERROR
          // ====================================================

          if (
            message.type ===
            "admin-error"
          ) {
            console.error(
              "Admin action error:",
              message.message
            );

            return;
          }

          // ====================================================
          // HOST FORCED LOCAL MICROPHONE OFF
          // ====================================================

          if (message.type === "force-mute") {
            localStreamRef.current
              ?.getAudioTracks()
              .forEach((track) => {
                track.enabled = false;
              });

            micOnRef.current = false;
            setMicOn(false);

            sendSignal({
              type: "media-state",
              media: {
                microphone: false,
                camera: cameraOnRef.current,
              },
            });

            return;
          }

          // ====================================================
          // HOST FORCED LOCAL CAMERA OFF
          // ====================================================

          if (message.type === "force-camera-off") {
            localStreamRef.current
              ?.getVideoTracks()
              .forEach((track) => {
                track.enabled = false;
              });

            cameraOnRef.current = false;
            setCameraOn(false);

            sendSignal({
              type: "media-state",
              media: {
                microphone: micOnRef.current,
                camera: false,
              },
            });

            return;
          }

          // ====================================================
          // REMOVED BY HOST
          // ====================================================

          if (message.type === "removed") {
            admittedRef.current = false;

            localStreamRef.current
              ?.getTracks()
              .forEach((track) => {
                track.stop();
              });

            localStreamRef.current = null;

            peersRef.current.forEach((peer) => {
              peer.close();
            });

            peersRef.current.clear();
            pendingIceRef.current.clear();
            negotiatingRef.current.clear();
            renegotiateRef.current.clear();

            setLocalStream(null);
            setParticipants([]);

            micOnRef.current = false;
            cameraOnRef.current = false;

            setMicOn(false);
            setCameraOn(false);
            setAdmissionStatus("removed");
            setAdmissionMessage(
              message.message ||
                "The host removed you from the meeting."
            );

            setTimeout(() => {
              socketRef.current?.close();
            }, 100);

            return;
          }

          if (message.type === "admin-action-complete") {
            return;
          }

          /*
           * Nothing below this point should
           * run for a waiting participant.
           */
          if (
            !admittedRef.current
          ) {
            return;
          }

          // ====================================================
          // EXISTING ROOM PARTICIPANTS
          // ====================================================

          if (
            message.type ===
            "room-participants"
          ) {
            const existing =
              message.participants ||
              [];

            /*
             * New/admitted participant initiates
             * connections to everybody already
             * inside the room.
             */
            for (
              const participant
              of existing
            ) {
              namesRef.current.set(
                participant.id,
                participant.name
              );

              upsertParticipant(
                participant.id,
                {
                  name:
                    participant.name,

                  micOn:
                    participant.mic_on ??
                    false,

                  cameraOn:
                    participant.camera_on ??
                    false,

                  isHost:
                    participant.is_host ??
                    false,
                }
              );

              await negotiate(
                participant.id
              );
            }

            return;
          }

          // ====================================================
          // PARTICIPANT JOINED
          // ====================================================

          if (
            message.type ===
            "participant-joined"
          ) {
            const id =
              message.participant_id;

            if (!id) {
              return;
            }

            const remoteName =
              message.participant_name ||
              "Participant";

            namesRef.current.set(
              id,
              remoteName
            );

            upsertParticipant(
              id,
              {
                name:
                  remoteName,

                micOn:
                  (
                    message as any
                  ).mic_on ??
                  false,

                cameraOn:
                  (
                    message as any
                  ).camera_on ??
                  false,

                isHost:
                  message.is_host ??
                  false,
              }
            );

            /*
             * Existing participants do not
             * create another offer here.
             *
             * The newly admitted participant
             * receives room-participants and
             * creates the offers.
             */
            return;
          }

          // ====================================================
          // OFFER
          // ====================================================

          if (
            message.type ===
            "offer"
          ) {
            const from =
              message.from;

            if (
              !from ||
              !message.data
            ) {
              return;
            }

            if (
              message.participant_name
            ) {
              namesRef.current.set(
                from,
                message.participant_name
              );
            }

            upsertParticipant(
              from,
              {
                name:
                  message.participant_name ||
                  namesRef.current.get(
                    from
                  ) ||
                  "Participant",
              }
            );

            const peer =
              createPeer(
                from
              );

            const offer =
              message.data as
                RTCSessionDescriptionInit;

            /*
             * Handle offer collision.
             */
            if (
              peer.signalingState ===
              "have-local-offer"
            ) {
              try {
                await peer.setLocalDescription(
                  {
                    type:
                      "rollback",
                  }
                );
              } catch (error) {
                console.warn(
                  "Rollback failed:",
                  error
                );
              }

              negotiatingRef.current.delete(
                from
              );
            }

            if (
              peer.signalingState !==
              "stable"
            ) {
              console.warn(
                "Ignoring offer in state:",
                peer.signalingState
              );

              return;
            }

            await peer.setRemoteDescription(
              new RTCSessionDescription(
                offer
              )
            );

            await flushPendingIce(
              from,
              peer
            );

            const answer =
              await peer.createAnswer();

            await peer.setLocalDescription(
              answer
            );

            sendSignal({
              type: "answer",

              to:
                from,

              data:
                peer.localDescription ||
                answer,
            });

            return;
          }

          // ====================================================
          // ANSWER
          // ====================================================

          if (
            message.type ===
            "answer"
          ) {
            const from =
              message.from;

            if (
              !from ||
              !message.data
            ) {
              return;
            }

            const peer =
              peersRef.current.get(
                from
              );

            if (!peer) {
              return;
            }

            /*
             * Ignore stale/duplicate answers.
             */
            if (
              peer.signalingState !==
              "have-local-offer"
            ) {
              console.warn(
                "Ignoring stale answer from",
                from,
                "state:",
                peer.signalingState
              );

              negotiatingRef.current.delete(
                from
              );

              return;
            }

            await peer.setRemoteDescription(
              new RTCSessionDescription(
                message.data as
                  RTCSessionDescriptionInit
              )
            );

            await flushPendingIce(
              from,
              peer
            );

            negotiatingRef.current.delete(
              from
            );

            if (
              renegotiateRef.current.has(
                from
              )
            ) {
              renegotiateRef.current.delete(
                from
              );

              setTimeout(
                () => {
                  void negotiate(
                    from
                  );
                },
                0
              );
            }

            return;
          }

          // ====================================================
          // ICE CANDIDATE
          // ====================================================

          if (
            message.type ===
            "ice-candidate"
          ) {
            const from =
              message.from;

            if (
              !from ||
              !message.data
            ) {
              return;
            }

            const candidate =
              message.data as
                RTCIceCandidateInit;

            const peer =
              peersRef.current.get(
                from
              );

            if (
              !peer ||
              !peer.remoteDescription
            ) {
              const queue =
                pendingIceRef.current.get(
                  from
                ) || [];

              queue.push(
                candidate
              );

              pendingIceRef.current.set(
                from,
                queue
              );

              return;
            }

            try {
              await peer.addIceCandidate(
                new RTCIceCandidate(
                  candidate
                )
              );
            } catch (error) {
              console.error(
                "ICE candidate error:",
                error
              );
            }

            return;
          }

// ====================================================
// MEDIA STATE
// ====================================================

if (
  message.type ===
  "media-state"
) {
  const from =
    message.from;

  if (!from) {
    return;
  }

  /*
   * IMPORTANT:
   *
   * Never add our own WebSocket participant ID
   * to the remote participants array.
   *
   * Host admin actions can cause the server to
   * broadcast our own media-state back to us.
   *
   * Without this check React creates a fake
   * third participant called "Participant".
   */
  if (
    from ===
    selfParticipantIdRef.current
  ) {
    return;
  }

  upsertParticipant(
    from,
    {
      micOn:
        message.media
          ?.microphone ??
        false,

      cameraOn:
        message.media
          ?.camera ??
        false,
    }
  );

  return;
}

          // ====================================================
          // PARTICIPANT LEFT
          // ====================================================

          if (
            message.type ===
            "participant-left"
          ) {
            const id =
              message.participant_id;

            if (!id) {
              return;
            }

            peersRef.current
              .get(id)
              ?.close();

            peersRef.current.delete(
              id
            );

            namesRef.current.delete(
              id
            );

            pendingIceRef.current.delete(
              id
            );

            negotiatingRef.current.delete(
              id
            );

            renegotiateRef.current.delete(
              id
            );

            setParticipants(
              (current) =>
                current.filter(
                  (
                    participant
                  ) =>
                    participant.id !==
                    id
                )
            );

            return;
          }

        } catch (error) {
          console.error(
            "WebRTC signaling message error:",
            error
          );
        }
      };

    // ----------------------------------------------------------
    // CLOSE
    // ----------------------------------------------------------

    socket.onclose =
      () => {
        setConnected(false);
      };

    // ----------------------------------------------------------
    // ERROR
    // ----------------------------------------------------------

    socket.onerror =
      (
        error
      ) => {
        console.error(
          "WebSocket error:",
          error
        );
      };

    // ----------------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------------

    return () => {
      socket.close();

      peersRef.current.forEach(
        (
          peer
        ) => {
          peer.close();
        }
      );

      peersRef.current.clear();

      pendingIceRef.current.clear();

      negotiatingRef.current.clear();

      renegotiateRef.current.clear();

      admittedRef.current =
        false;
      selfParticipantIdRef.current =
        null;
      setConnected(false);
    };

  }, [
    meetingId,
    participantName,
    addWaitingParticipant,
    removeWaitingParticipant,
    createPeer,
    flushPendingIce,
    negotiate,
    upsertParticipant,
  ]);

  // ==========================================================
  // HOST: ADMIT
  // ==========================================================

  const admitParticipant =
    useCallback(
      (
        participantId: string
      ) => {
        if (!isHost) {
          return;
        }

        sendSignal({
          type:
            "admit-participant",

          participant_id:
            participantId,
        });
      },
      [
        isHost,
        sendSignal,
      ]
    );

  // ==========================================================
  // HOST: DENY
  // ==========================================================

  const denyParticipant =
    useCallback(
      (
        participantId: string
      ) => {
        if (!isHost) {
          return;
        }

        sendSignal({
          type:
            "deny-participant",

          participant_id:
            participantId,
        });
      },
      [
        isHost,
        sendSignal,
      ]
    );

  // ==========================================================
  // HOST: FORCE MUTE PARTICIPANT
  // ==========================================================

  const muteParticipant = useCallback(
    (participantId: string) => {
      if (!isHost) return;

      sendSignal({
        type: "force-mute",
        participant_id: participantId,
      });
    },
    [isHost, sendSignal]
  );

  // ==========================================================
  // HOST: FORCE CAMERA OFF
  // ==========================================================

  const disableParticipantCamera = useCallback(
    (participantId: string) => {
      if (!isHost) return;

      sendSignal({
        type: "force-camera-off",
        participant_id: participantId,
      });
    },
    [isHost, sendSignal]
  );

  // ==========================================================
  // HOST: REMOVE PARTICIPANT
  // ==========================================================

  const removeParticipant = useCallback(
    (participantId: string) => {
      if (!isHost) return;

      sendSignal({
        type: "remove-participant",
        participant_id: participantId,
      });
    },
    [isHost, sendSignal]
  );

  // ==========================================================
  // SYNCHRONIZE LOCAL TRACKS
  // ==========================================================

  const syncTracksToPeers =
    useCallback(
      async () => {
        /*
         * A waiting participant cannot
         * publish media.
         */
        if (
          !admittedRef.current
        ) {
          return;
        }

        const stream =
          localStreamRef.current;

        if (!stream) {
          return;
        }

        for (
          const [
            participantId,
            peer,
          ]
          of peersRef.current
        ) {
          let needsNegotiation =
            false;

          for (
            const track
            of stream.getTracks()
          ) {
            const sender =
              peer
                .getSenders()
                .find(
                  (
                    item
                  ) =>
                    item.track
                      ?.kind ===
                    track.kind
                );

            if (sender) {
              if (
                sender.track?.id !==
                track.id
              ) {
                try {
                  await sender.replaceTrack(
                    track
                  );
                } catch (error) {
                  console.error(
                    "replaceTrack failed:",
                    error
                  );
                }
              }
            } else {
              peer.addTrack(
                track,
                stream
              );

              needsNegotiation =
                true;
            }
          }

          if (
            needsNegotiation
          ) {
            await negotiate(
              participantId
            );
          }
        }
      },
      [
        negotiate,
      ]
    );

  // ==========================================================
  // ENABLE CAMERA
  // ==========================================================

  const enableCamera =
    useCallback(
      async () => {
        /*
         * Waiting guests should not activate
         * meeting media from the room.
         */
        if (
          !admittedRef.current
        ) {
          return;
        }

        try {
          const current =
            localStreamRef.current;

          const existing =
            current
              ?.getVideoTracks()[0];

          if (existing) {
            existing.enabled =
              true;

            cameraOnRef.current = true;
            setCameraOn(true);

            sendSignal({
              type:
                "media-state",

              media: {
                camera:
                  true,

                microphone:
                  micOnRef.current,
              },
            });

            return;
          }

          const cameraStream =
            await navigator
              .mediaDevices
              .getUserMedia({
                video: true,
                audio: false,
              });

          const videoTrack =
            cameraStream
              .getVideoTracks()[0];

          if (!videoTrack) {
            return;
          }

          let stream =
            current;

          if (!stream) {
            stream =
              new MediaStream();

            localStreamRef.current =
              stream;
          }

          stream.addTrack(
            videoTrack
          );

          setLocalStream(
            new MediaStream(
              stream.getTracks()
            )
          );

          cameraOnRef.current = true;
          setCameraOn(true);

          await syncTracksToPeers();

          sendSignal({
            type:
              "media-state",

            media: {
              camera:
                true,

              microphone:
                micOnRef.current,
            },
          });

        } catch (error) {
          console.error(
            "Camera error:",
            error
          );
        }
      },
      [
        micOn,
        sendSignal,
        syncTracksToPeers,
      ]
    );

  // ==========================================================
  // ENABLE MICROPHONE
  // ==========================================================

  const enableMicrophone =
    useCallback(
      async () => {
        if (
          !admittedRef.current
        ) {
          return;
        }

        try {
          const current =
            localStreamRef.current;

          const existing =
            current
              ?.getAudioTracks()[0];

          if (existing) {
            existing.enabled =
              true;

            micOnRef.current = true;
            setMicOn(true);

            sendSignal({
              type:
                "media-state",

              media: {
                camera:
                  cameraOnRef.current,

                microphone:
                  true,
              },
            });

            return;
          }

          const micStream =
            await navigator
              .mediaDevices
              .getUserMedia({
                video: false,
                audio: true,
              });

          const audioTrack =
            micStream
              .getAudioTracks()[0];

          if (!audioTrack) {
            return;
          }

          let stream =
            current;

          if (!stream) {
            stream =
              new MediaStream();

            localStreamRef.current =
              stream;
          }

          stream.addTrack(
            audioTrack
          );

          setLocalStream(
            new MediaStream(
              stream.getTracks()
            )
          );

          micOnRef.current = true;
          setMicOn(true);

          await syncTracksToPeers();

          sendSignal({
            type:
              "media-state",

            media: {
              camera:
                cameraOnRef.current,

              microphone:
                true,
            },
          });

        } catch (error) {
          console.error(
            "Microphone error:",
            error
          );
        }
      },
      [
        cameraOn,
        sendSignal,
        syncTracksToPeers,
      ]
    );

  // ==========================================================
  // TOGGLE CAMERA
  // ==========================================================

  const toggleCamera =
    useCallback(
      async () => {
        if (
          !admittedRef.current
        ) {
          return;
        }

        if (!cameraOn) {
          await enableCamera();

          return;
        }

        localStreamRef.current
          ?.getVideoTracks()
          .forEach(
            (
              track
            ) => {
              track.enabled =
                false;
            }
          );

        cameraOnRef.current = false;
        setCameraOn(false);

        sendSignal({
          type:
            "media-state",

          media: {
            camera:
              false,

            microphone:
              micOnRef.current,
          },
        });
      },
      [
        cameraOn,
        micOn,
        enableCamera,
        sendSignal,
      ]
    );

  // ==========================================================
  // TOGGLE MICROPHONE
  // ==========================================================

  const toggleMic =
    useCallback(
      async () => {
        if (
          !admittedRef.current
        ) {
          return;
        }

        if (!micOn) {
          await enableMicrophone();

          return;
        }

        localStreamRef.current
          ?.getAudioTracks()
          .forEach(
            (
              track
            ) => {
              track.enabled =
                false;
            }
          );

        micOnRef.current = false;
        setMicOn(false);

        sendSignal({
          type:
            "media-state",

          media: {
            camera:
              cameraOnRef.current,

            microphone:
              false,
          },
        });
      },
      [
        micOn,
        cameraOn,
        enableMicrophone,
        sendSignal,
      ]
    );

  // ==========================================================
  // SCREEN SHARE
  // ==========================================================

  const startScreenShare =
    useCallback(
      async () => {
        if (
          !admittedRef.current
        ) {
          return;
        }

        try {
          const screen =
            await navigator
              .mediaDevices
              .getDisplayMedia({
                video: true,
                audio: false,
              });

          const screenTrack =
            screen
              .getVideoTracks()[0];

          if (!screenTrack) {
            return;
          }

          for (
            const peer
            of peersRef.current.values()
          ) {
            const sender =
              peer
                .getSenders()
                .find(
                  (
                    item
                  ) =>
                    item.track
                      ?.kind ===
                    "video"
                );

            if (sender) {
              await sender.replaceTrack(
                screenTrack
              );
            }
          }

          screenTrack.onended =
            async () => {
              const cameraTrack =
                localStreamRef.current
                  ?.getVideoTracks()[0];

              if (!cameraTrack) {
                return;
              }

              for (
                const peer
                of peersRef.current.values()
              ) {
                const sender =
                  peer
                    .getSenders()
                    .find(
                      (
                        item
                      ) =>
                        item.track
                          ?.kind ===
                        "video"
                    );

                if (sender) {
                  await sender.replaceTrack(
                    cameraTrack
                  );
                }
              }
            };

        } catch (error) {
          console.error(
            "Screen sharing error:",
            error
          );
        }
      },
      []
    );

  // ==========================================================
  // LEAVE
  // ==========================================================

  const leaveMeeting =
    useCallback(
      () => {
        socketRef.current
          ?.close();

        peersRef.current.forEach(
          (
            peer
          ) => {
            peer.close();
          }
        );

        peersRef.current.clear();

        pendingIceRef.current.clear();

        negotiatingRef.current.clear();

        renegotiateRef.current.clear();

        localStreamRef.current
          ?.getTracks()
          .forEach(
            (
              track
            ) => {
              track.stop();
            }
          );

        localStreamRef.current =
          null;

        admittedRef.current =
          false;

        selfParticipantIdRef.current =
          null;

        setLocalStream(
          null
        );

        setParticipants(
          []
        );

        setWaitingParticipants(
          []
        );

        cameraOnRef.current =
          false;

        micOnRef.current =
          false;

        setCameraOn(
          false
        );

        setMicOn(
          false
        );

        setConnected(
          false
        );
      },
      []
    );

  // ==========================================================
  // RETURN
  // ==========================================================

  return {
    // Media
    localStream,
    participants,

    micOn,
    cameraOn,

    toggleMic,
    toggleCamera,

    startScreenShare,

    // Connection
    connected,

    // Admission
    admissionStatus,
    admissionMessage,

    // Host
    isHost,

    waitingParticipants,

    admitParticipant,
    denyParticipant,

    // Admin participant controls
    muteParticipant,
    disableParticipantCamera,
    removeParticipant,

    // Leave
    leaveMeeting,
  };
}
