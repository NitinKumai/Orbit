import Head from "next/head";
import { useRouter } from "next/router";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Check,
  Copy,
  Crown,
  MessageSquare,
  MicOff,
  Send,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
  VideoOff,
  X,
} from "lucide-react";

import ControlBar from "../../components/ControlBar";
import IconButton from "../../components/IconButton";
import ParticipantVideo from "../../components/ParticipantVideo";

import {
  getMeeting,
  getMeetingLink,
} from "../../utils/api";

import { useWebRTC } from "../../hooks/useWebRTC";


// ============================================================
// TYPES
// ============================================================

interface ChatMessage {
  name: string;
  message: string;
}


// ============================================================
// MEETING ROOM
// ============================================================

export default function MeetingRoom() {
  const router = useRouter();

  const { id, name } =
    router.query;

  // ==========================================================
  // MEETING INFORMATION
  // ==========================================================

  const meetingId =
    typeof id === "string"
      ? id
      : "";

  const participantName =
    typeof name === "string" &&
    name.trim()
      ? name.trim()
      : "Guest";

  // ==========================================================
  // LOCAL UI STATE
  // ==========================================================

  const [
    meetingTitle,
    setMeetingTitle,
  ] = useState("Meeting");

  const [
    chatOpen,
    setChatOpen,
  ] = useState(false);

  const [
    participantsOpen,
    setParticipantsOpen,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    messages,
    setMessages,
  ] = useState<ChatMessage[]>([]);

  const [
    copied,
    setCopied,
  ] = useState(false);

  // ==========================================================
  // WEBRTC + WAITING ROOM + ADMIN
  // ==========================================================

  const {
    localStream,
    participants,

    micOn,
    cameraOn,

    connected,

    toggleMic,
    toggleCamera,

    startScreenShare,

    admissionStatus,
    admissionMessage,

    isHost,

    waitingParticipants,

    admitParticipant,
    denyParticipant,

    // Stage 2 admin controls
    muteParticipant,
    disableParticipantCamera,
    removeParticipant,

    leaveMeeting,
  } = useWebRTC(
    meetingId,
    participantName
  );

  // ==========================================================
  // LOAD MEETING
  // ==========================================================

  useEffect(() => {
    if (!meetingId) {
      return;
    }

    getMeeting(meetingId)
      .then((meeting) => {
        setMeetingTitle(
          meeting.title ||
            "Meeting"
        );
      })
      .catch((error) => {
        console.error(
          "Unable to load meeting:",
          error
        );
      });
  }, [meetingId]);

  // ==========================================================
  // COPY LINK
  // ==========================================================

  const copyLink =
    async () => {
      if (!meetingId) {
        return;
      }

      try {
        const link =
          getMeetingLink(
            meetingId
          );

        await navigator.clipboard.writeText(
          link
        );

        setCopied(true);

        setTimeout(() => {
          setCopied(false);
        }, 1800);
      } catch (error) {
        console.error(
          "Unable to copy meeting link:",
          error
        );
      }
    };

  // ==========================================================
  // LEAVE
  // ==========================================================

  const leave = () => {
    leaveMeeting();

    void router.push("/");
  };

  // ==========================================================
  // REMOVE PARTICIPANT
  // ==========================================================

  const handleRemoveParticipant = (
    participantId: string,
    participantDisplayName: string
  ) => {
    if (!isHost) {
      return;
    }

    const confirmed =
      window.confirm(
        `Remove ${participantDisplayName} from the meeting?`
      );

    if (!confirmed) {
      return;
    }

    removeParticipant(
      participantId
    );
  };

  // ==========================================================
  // CHAT
  // ==========================================================

  const sendMessage = () => {
    const text =
      message.trim();

    if (!text) {
      return;
    }

    /*
     * Chat is still local UI for now.
     * We can connect this to the WebSocket
     * chat event in the next feature stage.
     */
    setMessages(
      (current) => [
        ...current,
        {
          name:
            participantName,

          message:
            text,
        },
      ]
    );

    setMessage("");
  };

  // ==========================================================
  // PARTICIPANT COUNT
  // ==========================================================

  const totalParticipants =
    participants.length + 1;

  // ==========================================================
  // VIDEO PARTICIPANTS
  // ==========================================================

  const videoParticipants =
    useMemo(
      () => [
        // ------------------------------------------------------
        // LOCAL
        // ------------------------------------------------------

        {
          id: "local",

          name:
            `${participantName} (You)`,

          stream:
            localStream ||
            undefined,

          /*
           * Prevent local microphone echo.
           */
          muted: true,

          micOn,

          cameraOn,

          isHost,
        },

        // ------------------------------------------------------
        // REMOTE
        // ------------------------------------------------------

        ...participants.map(
          (participant) => ({
            id:
              participant.id,

            name:
              participant.name,

            stream:
              participant.stream,

            muted: false,

            micOn:
              participant.micOn,

            cameraOn:
              participant.cameraOn,

            isHost:
              participant.isHost,
          })
        ),
      ],
      [
        participantName,
        localStream,
        micOn,
        cameraOn,
        isHost,
        participants,
      ]
    );

  // ==========================================================
  // CONNECTING SCREEN
  // ==========================================================

  if (
    admissionStatus ===
    "connecting"
  ) {
    return (
      <>
        <Head>
          <title>
            Connecting — Meetly
          </title>
        </Head>

        <main className="flex min-h-screen items-center justify-center bg-[#111827] px-5 text-white">
          <div className="text-center">

            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-white" />

            <h1 className="mt-5 text-lg font-semibold">
              Connecting to meeting
            </h1>

            <p className="mt-2 text-sm text-gray-400">
              Please wait a moment.
            </p>

          </div>
        </main>
      </>
    );
  }

  // ==========================================================
  // WAITING ROOM
  // ==========================================================

  if (
    admissionStatus ===
    "waiting"
  ) {
    return (
      <>
        <Head>
          <title>
            Waiting for host — Meetly
          </title>
        </Head>

        <main className="flex min-h-screen items-center justify-center bg-[#111827] px-5 text-white">

          <div className="w-full max-w-md text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10">

              <ShieldCheck
                size={28}
                className="text-indigo-400"
              />

            </div>

            <h1 className="mt-6 text-2xl font-semibold">
              Waiting for the host
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-400">

              {admissionMessage ||
                "The host has been notified. You'll join the meeting when they let you in."}

            </p>

            <div className="mt-8 flex items-center justify-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold">

                {participantName
                  .charAt(0)
                  .toUpperCase()}

              </div>

              <div className="text-left">

                <p className="text-sm font-medium">
                  {participantName}
                </p>

                <p className="text-xs text-gray-500">
                  Request pending
                </p>

              </div>

            </div>

            <button
              onClick={leave}
              className="mt-8 rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-white/5 hover:text-white"
            >
              Cancel request
            </button>

          </div>

        </main>
      </>
    );
  }

  // ==========================================================
  // DENIED SCREEN
  // ==========================================================

  if (
    admissionStatus ===
    "denied"
  ) {
    return (
      <>
        <Head>
          <title>
            Request denied — Meetly
          </title>
        </Head>

        <main className="flex min-h-screen items-center justify-center bg-[#111827] px-5 text-white">

          <div className="w-full max-w-md text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">

              <UserX
                size={28}
                className="text-red-400"
              />

            </div>

            <h1 className="mt-6 text-2xl font-semibold">
              You weren't admitted
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-400">

              {admissionMessage ||
                "The host did not admit you to this meeting."}

            </p>

            <button
              onClick={() =>
                void router.push("/")
              }
              className="mt-8 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-100"
            >
              Return home
            </button>

          </div>

        </main>
      </>
    );
  }

  // ==========================================================
  // REMOVED BY HOST
  // ==========================================================

  if (
    admissionStatus ===
    "removed"
  ) {
    return (
      <>
        <Head>
          <title>
            Removed from meeting — Meetly
          </title>
        </Head>

        <main className="flex min-h-screen items-center justify-center bg-[#111827] px-5 text-white">

          <div className="w-full max-w-md text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">

              <UserX
                size={28}
                className="text-red-400"
              />

            </div>

            <h1 className="mt-6 text-2xl font-semibold">
              You were removed
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-400">

              {admissionMessage ||
                "The host removed you from this meeting."}

            </p>

            <button
              onClick={() =>
                void router.push("/")
              }
              className="mt-8 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-100"
            >
              Return home
            </button>

          </div>

        </main>
      </>
    );
  }

  // ==========================================================
  // ERROR SCREEN
  // ==========================================================

  if (
    admissionStatus ===
    "error"
  ) {
    return (
      <>
        <Head>
          <title>
            Meeting unavailable — Meetly
          </title>
        </Head>

        <main className="flex min-h-screen items-center justify-center bg-[#111827] px-5 text-white">

          <div className="w-full max-w-md text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">

              <X
                size={28}
                className="text-red-400"
              />

            </div>

            <h1 className="mt-6 text-2xl font-semibold">
              Meeting unavailable
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-400">

              {admissionMessage ||
                "We couldn't connect you to this meeting."}

            </p>

            <button
              onClick={() =>
                void router.push("/")
              }
              className="mt-8 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-100"
            >
              Return home
            </button>

          </div>

        </main>
      </>
    );
  }

  // ==========================================================
  // ADMITTED MEETING
  // ==========================================================

  return (
    <>
      <Head>
        <title>
          {meetingTitle} — Meetly
        </title>
      </Head>

      <main className="flex h-screen flex-col overflow-hidden bg-[#111827] text-white">

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4 sm:px-6">

          <div className="min-w-0">

            <div className="flex items-center gap-2">

              <h1 className="truncate text-sm font-medium">
                {meetingTitle}
              </h1>

              {isHost && (
                <span className="hidden items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-300 ring-1 ring-indigo-500/20 sm:flex">

                  <Crown
                    size={11}
                  />

                  Host

                </span>
              )}

            </div>

            <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">

              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connected
                    ? "bg-green-500"
                    : "bg-yellow-500"
                }`}
              />

              {connected
                ? "Connected"
                : "Connecting..."}

            </div>

          </div>

          {/* HEADER ACTIONS */}

          <div className="flex items-center gap-2">

            {isHost &&
              waitingParticipants.length >
                0 && (

                <button
                  onClick={() => {
                    setChatOpen(false);
                    setParticipantsOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-500"
                >

                  <UserCheck
                    size={15}
                  />

                  {waitingParticipants.length}

                  <span className="hidden sm:inline">
                    waiting
                  </span>

                </button>

              )}

            <button
              onClick={copyLink}
              className="hidden items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-white/5 sm:flex"
            >

              {copied ? (
                <Check size={15} />
              ) : (
                <Copy size={15} />
              )}

              {copied
                ? "Copied"
                : "Copy meeting link"}

            </button>

            <button
              onClick={() => {
                setChatOpen(false);

                setParticipantsOpen(
                  !participantsOpen
                );
              }}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300 transition hover:bg-white/5"
            >

              <Users size={15} />

              {totalParticipants}

            </button>

          </div>

        </header>

        {/* ================================================== */}
        {/* MAIN AREA */}
        {/* ================================================== */}

        <div className="relative flex min-h-0 flex-1">

          {/* ================================================= */}
          {/* VIDEO GRID */}
          {/* ================================================= */}

          <section className="flex min-w-0 flex-1 flex-col p-3 sm:p-5">

            <div
              className={`
                mx-auto
                grid
                min-h-0
                w-full
                flex-1
                gap-3

                ${
                  videoParticipants.length === 1
                    ? "max-w-4xl grid-cols-1"
                    : ""
                }

                ${
                  videoParticipants.length === 2
                    ? "max-w-7xl grid-cols-1 lg:grid-cols-2"
                    : ""
                }

                ${
                  videoParticipants.length >= 3 &&
                  videoParticipants.length <= 4
                    ? "max-w-7xl grid-cols-1 sm:grid-cols-2"
                    : ""
                }

                ${
                  videoParticipants.length > 4
                    ? "grid-cols-2 lg:grid-cols-3"
                    : ""
                }
              `}
            >

              {videoParticipants.map(
                (participant) => (

                  <div
                    key={participant.id}
                    className="relative min-h-0 min-w-0"
                  >

                    <ParticipantVideo
                      stream={
                        participant.stream
                      }

                      name={
                        participant.name
                      }

                      muted={
                        participant.muted
                      }

                      micOn={
                        participant.micOn
                      }

                      cameraOff={
                        !participant.cameraOn
                      }
                    />

                    {participant.isHost && (

                      <div className="absolute right-3 top-3 z-30 flex items-center gap-1.5 rounded-md bg-black/65 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">

                        <Crown
                          size={11}
                          className="text-amber-300"
                        />

                        Host

                      </div>

                    )}

                  </div>

                )
              )}

            </div>

            {/* =============================================== */}
            {/* CONTROL BAR */}
            {/* =============================================== */}

            <div className="flex shrink-0 justify-center pt-4">

              <ControlBar
                micOn={micOn}

                cameraOn={
                  cameraOn
                }

                onToggleMic={
                  toggleMic
                }

                onToggleCamera={
                  toggleCamera
                }

                onShareScreen={
                  startScreenShare
                }

                onChat={() => {
                  setParticipantsOpen(false);

                  setChatOpen(
                    !chatOpen
                  );
                }}

                onParticipants={() => {
                  setChatOpen(false);

                  setParticipantsOpen(
                    !participantsOpen
                  );
                }}

                onCopyLink={
                  copyLink
                }

                onLeave={
                  leave
                }
              />

            </div>

          </section>

          {/* ================================================= */}
          {/* SIDE PANEL */}
          {/* ================================================= */}

          {(chatOpen ||
            participantsOpen) && (

            <aside className="absolute bottom-3 right-3 top-3 z-40 flex w-[min(390px,calc(100%-24px))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1f2937] shadow-2xl sm:bottom-5 sm:right-5 sm:top-5">

              {/* HEADER */}

              <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">

                <div className="flex items-center gap-2">

                  {chatOpen ? (
                    <MessageSquare
                      size={17}
                    />
                  ) : (
                    <Users
                      size={17}
                    />
                  )}

                  <span className="text-sm font-medium">

                    {chatOpen
                      ? "Meeting chat"
                      : `Participants (${totalParticipants})`}

                  </span>

                </div>

                <IconButton
                  label="Close panel"
                  onClick={() => {
                    setChatOpen(false);
                    setParticipantsOpen(false);
                  }}
                >

                  <X size={17} />

                </IconButton>

              </div>

              {/* ============================================= */}
              {/* CHAT */}
              {/* ============================================= */}

              {chatOpen ? (
                <>

                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">

                    {messages.length ===
                    0 ? (

                      <div className="flex h-full items-center justify-center text-center">

                        <div>

                          <MessageSquare
                            className="mx-auto text-gray-500"
                            size={28}
                          />

                          <p className="mt-3 text-sm text-gray-300">
                            No messages yet
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            Start the conversation.
                          </p>

                        </div>

                      </div>

                    ) : (

                      messages.map(
                        (
                          item,
                          index
                        ) => (

                          <div
                            key={index}
                            className="text-sm"
                          >

                            <p className="font-medium text-gray-300">
                              {item.name}
                            </p>

                            <p className="mt-1 text-gray-400">
                              {item.message}
                            </p>

                          </div>

                        )
                      )

                    )}

                  </div>

                  <div className="border-t border-white/10 p-3">

                    <div className="flex gap-2">

                      <input
                        value={message}

                        onChange={(
                          event
                        ) =>
                          setMessage(
                            event.target.value
                          )
                        }

                        onKeyDown={(
                          event
                        ) => {
                          if (
                            event.key ===
                            "Enter"
                          ) {
                            sendMessage();
                          }
                        }}

                        placeholder="Send a message..."

                        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-500 focus:border-indigo-500"
                      />

                      <button
                        onClick={
                          sendMessage
                        }
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 transition hover:bg-indigo-500"
                      >

                        <Send
                          size={16}
                        />

                      </button>

                    </div>

                  </div>

                </>
              ) : (

                /* =========================================== */
                /* PARTICIPANTS PANEL */
                /* =========================================== */

                <div className="min-h-0 flex-1 overflow-y-auto">

                  {/* ========================================= */}
                  {/* WAITING ROOM */}
                  {/* ========================================= */}

                  {isHost &&
                    waitingParticipants.length >
                      0 && (

                    <div className="border-b border-white/10 p-3">

                      <div className="mb-3 flex items-center justify-between px-1">

                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Waiting to join
                        </p>

                        <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">

                          {
                            waitingParticipants.length
                          }

                        </span>

                      </div>

                      <div className="space-y-2">

                        {waitingParticipants.map(
                          (waiting) => (

                            <div
                              key={
                                waiting.participantId
                              }
                              className="rounded-xl border border-white/10 bg-white/[0.035] p-3"
                            >

                              <div className="flex items-center gap-3">

                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-700 text-sm font-medium">

                                  {waiting.name
                                    .charAt(0)
                                    .toUpperCase()}

                                </div>

                                <div className="min-w-0 flex-1">

                                  <p className="truncate text-sm font-medium">
                                    {waiting.name}
                                  </p>

                                  <p className="mt-0.5 text-xs text-gray-500">
                                    Wants to join
                                  </p>

                                </div>

                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2">

                                <button
                                  onClick={() =>
                                    denyParticipant(
                                      waiting.participantId
                                    )
                                  }
                                  className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-white/5 hover:text-white"
                                >

                                  <UserX
                                    size={14}
                                  />

                                  Deny

                                </button>

                                <button
                                  onClick={() =>
                                    admitParticipant(
                                      waiting.participantId
                                    )
                                  }
                                  className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-500"
                                >

                                  <UserCheck
                                    size={14}
                                  />

                                  Admit

                                </button>

                              </div>

                            </div>

                          )
                        )}

                      </div>

                    </div>

                  )}

                  {/* ========================================= */}
                  {/* PEOPLE */}
                  {/* ========================================= */}

                  <div className="p-3">

                    <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      In this meeting
                    </p>

                    <div className="space-y-2">

                      {/* ===================================== */}
                      {/* LOCAL USER */}
                      {/* ===================================== */}

                      <div className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-white/5">

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-medium">

                          {participantName
                            .charAt(0)
                            .toUpperCase()}

                        </div>

                        <div className="min-w-0 flex-1">

                          <div className="flex items-center gap-2">

                            <p className="truncate text-sm font-medium">
                              {participantName}
                            </p>

                            {isHost && (

                              <Crown
                                size={13}
                                className="shrink-0 text-amber-300"
                              />

                            )}

                          </div>

                          <p className="text-xs text-gray-500">

                            {isHost
                              ? "You · Host"
                              : "You"}

                          </p>

                        </div>

                        <span
                          className={`text-xs ${
                            micOn
                              ? "text-green-400"
                              : "text-gray-500"
                          }`}
                        >

                          {micOn
                            ? "Mic on"
                            : "Muted"}

                        </span>

                      </div>

                      {/* ===================================== */}
                      {/* REMOTE PARTICIPANTS */}
                      {/* ===================================== */}

                      {participants.map(
                        (participant) => (

                          <div
                            key={
                              participant.id
                            }
                            className="rounded-xl border border-transparent px-3 py-3 transition hover:border-white/5 hover:bg-white/[0.035]"
                          >

                            {/* PERSON */}

                            <div className="flex items-center gap-3">

                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-700 text-sm font-medium">

                                {participant.name
                                  .charAt(0)
                                  .toUpperCase()}

                              </div>

                              <div className="min-w-0 flex-1">

                                <div className="flex items-center gap-2">

                                  <p className="truncate text-sm font-medium">
                                    {
                                      participant.name
                                    }
                                  </p>

                                  {participant.isHost && (

                                    <Crown
                                      size={13}
                                      className="shrink-0 text-amber-300"
                                    />

                                  )}

                                </div>

                                <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">

                                  {participant.isHost && (
                                    <span>
                                      Host
                                    </span>
                                  )}

                                  <span>
                                    {participant.micOn
                                      ? "Mic on"
                                      : "Muted"}
                                  </span>

                                  <span>
                                    {participant.cameraOn
                                      ? "Camera on"
                                      : "Camera off"}
                                  </span>

                                </div>

                              </div>

                            </div>

                            {/* ================================= */}
                            {/* HOST ADMIN CONTROLS */}
                            {/* ================================= */}

                            {isHost &&
                              !participant.isHost && (

                              <div className="mt-3 grid grid-cols-3 gap-2">

                                {/* FORCE MUTE */}

                                <button
                                  type="button"
                                  disabled={
                                    !participant.micOn
                                  }
                                  onClick={() =>
                                    muteParticipant(
                                      participant.id
                                    )
                                  }
                                  title={
                                    participant.micOn
                                      ? `Mute ${participant.name}`
                                      : `${participant.name} is already muted`
                                  }
                                  className="
                                    flex
                                    items-center
                                    justify-center
                                    gap-1.5
                                    rounded-lg
                                    border
                                    border-white/10
                                    px-2
                                    py-2
                                    text-[11px]
                                    font-medium
                                    text-gray-300
                                    transition
                                    hover:bg-white/5
                                    hover:text-white
                                    disabled:cursor-not-allowed
                                    disabled:opacity-40
                                  "
                                >

                                  <MicOff
                                    size={13}
                                  />

                                  Mute

                                </button>

                                {/* CAMERA OFF */}

                                <button
                                  type="button"
                                  disabled={
                                    !participant.cameraOn
                                  }
                                  onClick={() =>
                                    disableParticipantCamera(
                                      participant.id
                                    )
                                  }
                                  title={
                                    participant.cameraOn
                                      ? `Turn off ${participant.name}'s camera`
                                      : `${participant.name}'s camera is already off`
                                  }
                                  className="
                                    flex
                                    items-center
                                    justify-center
                                    gap-1.5
                                    rounded-lg
                                    border
                                    border-white/10
                                    px-2
                                    py-2
                                    text-[11px]
                                    font-medium
                                    text-gray-300
                                    transition
                                    hover:bg-white/5
                                    hover:text-white
                                    disabled:cursor-not-allowed
                                    disabled:opacity-40
                                  "
                                >

                                  <VideoOff
                                    size={13}
                                  />

                                  Camera

                                </button>

                                {/* REMOVE */}

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveParticipant(
                                      participant.id,
                                      participant.name
                                    )
                                  }
                                  title={`Remove ${participant.name}`}
                                  className="
                                    flex
                                    items-center
                                    justify-center
                                    gap-1.5
                                    rounded-lg
                                    border
                                    border-red-500/20
                                    bg-red-500/5
                                    px-2
                                    py-2
                                    text-[11px]
                                    font-medium
                                    text-red-300
                                    transition
                                    hover:bg-red-500/10
                                    hover:text-red-200
                                  "
                                >

                                  <UserX
                                    size={13}
                                  />

                                  Remove

                                </button>

                              </div>

                            )}

                          </div>

                        )
                      )}

                    </div>

                  </div>

                </div>

              )}

            </aside>

          )}

        </div>

      </main>
    </>
  );
}