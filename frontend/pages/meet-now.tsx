import Head from "next/head";
import { useRouter } from "next/router";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  Mic,
  MicOff,
  Video,
  VideoOff,
} from "lucide-react";

import Button from "../components/Button";
import Input from "../components/Input";
import IconButton from "../components/IconButton";

import {
  createMeeting,
  getMeeting,
  registerHostParticipant,
  saveHostToken,
} from "../utils/api";


export default function MeetNow() {
  const router = useRouter();

  const { code } = router.query;

  // ============================================================
  // REFS
  // ============================================================

  const videoRef =
    useRef<HTMLVideoElement>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  // ============================================================
  // MEETING TYPE
  // ============================================================

  /*
   * IMPORTANT:
   *
   * /meet-now
   * /meet-now?code=new
   *
   * both mean:
   *
   * CREATE A NEW MEETING
   *
   *
   * /meet-now?code=<REAL-MEETING-ID>
   *
   * means:
   *
   * JOIN AN EXISTING MEETING
   */

  const codeValue =
    typeof code === "string"
      ? code.trim()
      : "";

  const isExistingMeeting =
    codeValue !== "" &&
    codeValue.toLowerCase() !== "new";

  // ============================================================
  // STATE
  // ============================================================

  const [
    meetingId,
    setMeetingId,
  ] = useState("");

  const [
    name,
    setName,
  ] = useState("");

  const [
    cameraOn,
    setCameraOn,
  ] = useState(false);

  const [
    micOn,
    setMicOn,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    joining,
    setJoining,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  // ============================================================
  // INITIALIZE
  // ============================================================

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    let cancelled = false;

    const initialize =
      async () => {
        setLoading(true);
        setError("");

        try {
          // ====================================================
          // EXISTING MEETING
          // ====================================================

          if (
            isExistingMeeting
          ) {
            /*
             * Verify that the meeting really
             * exists before showing the
             * join screen.
             */
            await getMeeting(
              codeValue
            );

            if (cancelled) {
              return;
            }

            setMeetingId(
              codeValue
            );
          }

          // ====================================================
          // NEW MEETING
          // ====================================================

          else {
            /*
             * Don't create the meeting yet.
             *
             * Creation happens only when the
             * creator enters their name and
             * clicks "Create meeting".
             */
            setMeetingId("");
          }

          /*
           * Both devices always start OFF.
           */
          setCameraOn(false);
          setMicOn(false);

        } catch (err) {
          console.error(
            "Meeting initialization error:",
            err
          );

          if (!cancelled) {
            setError(
              err instanceof Error
                ? err.message
                : "Unable to load this meeting."
            );
          }

        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

    void initialize();

    // ==========================================================
    // CLEANUP
    // ==========================================================

    return () => {
      cancelled = true;

      streamRef.current
        ?.getTracks()
        .forEach(
          (track) => {
            track.stop();
          }
        );

      streamRef.current =
        null;
    };

  }, [
    router.isReady,
    codeValue,
    isExistingMeeting,
  ]);

  // ============================================================
  // START MEDIA
  // ============================================================

  const startMedia =
    async (
      enableCamera: boolean,
      enableMic: boolean
    ) => {
      try {
        setError("");

        const stream =
          await navigator.mediaDevices
            .getUserMedia({
              video: true,
              audio: true,
            });

        stream
          .getVideoTracks()
          .forEach(
            (track) => {
              track.enabled =
                enableCamera;
            }
          );

        stream
          .getAudioTracks()
          .forEach(
            (track) => {
              track.enabled =
                enableMic;
            }
          );

        streamRef.current =
          stream;

        setCameraOn(
          enableCamera
        );

        setMicOn(
          enableMic
        );

      } catch (err) {
        console.error(
          "Media permission error:",
          err
        );

        setError(
          "Unable to access your camera or microphone. Please check your browser permissions."
        );
      }
    };

  // ============================================================
  // ATTACH CAMERA PREVIEW
  // ============================================================

  useEffect(() => {
    const video =
      videoRef.current;

    const stream =
      streamRef.current;

    if (
      !video ||
      !stream ||
      !cameraOn
    ) {
      return;
    }

    video.srcObject =
      stream;

    void video
      .play()
      .catch(() => {});

  }, [cameraOn]);

  // ============================================================
  // TOGGLE CAMERA
  // ============================================================

  const toggleCamera =
    async () => {
      if (!cameraOn) {
        /*
         * No MediaStream exists yet.
         */
        if (!streamRef.current) {
          await startMedia(
            true,
            false
          );

          return;
        }

        streamRef.current
          .getVideoTracks()
          .forEach(
            (track) => {
              track.enabled =
                true;
            }
          );

        setCameraOn(true);

        return;
      }

      streamRef.current
        ?.getVideoTracks()
        .forEach(
          (track) => {
            track.enabled =
              false;
          }
        );

      setCameraOn(false);
    };

  // ============================================================
  // TOGGLE MICROPHONE
  // ============================================================

  const toggleMic =
    async () => {
      if (!micOn) {
        /*
         * No MediaStream exists yet.
         */
        if (!streamRef.current) {
          await startMedia(
            false,
            true
          );

          return;
        }

        streamRef.current
          .getAudioTracks()
          .forEach(
            (track) => {
              track.enabled =
                true;
            }
          );

        setMicOn(true);

        return;
      }

      streamRef.current
        ?.getAudioTracks()
        .forEach(
          (track) => {
            track.enabled =
              false;
          }
        );

      setMicOn(false);
    };

  // ============================================================
  // CREATE / REQUEST JOIN
  // ============================================================

  const handleMeetingAction =
    async () => {
      const displayName =
        name.trim();

      if (!displayName) {
        return;
      }

      setJoining(true);
      setError("");

      try {
        // ======================================================
        // CREATE NEW MEETING
        // ======================================================

        if (
          !isExistingMeeting
        ) {
          /*
           * Backend generates:
           *
           * meeting ID
           * host ID
           * secret host token
           */
          const meeting =
            await createMeeting(
              `${displayName}'s Meeting`
            );

          const id =
            meeting.id;

          setMeetingId(id);

          // ====================================================
          // STORE HOST CREDENTIAL
          // ====================================================

          /*
           * IMPORTANT:
           *
           * The host token stays in this browser
           * session.
           *
           * It is NEVER added to the shareable
           * meeting URL.
           */
          saveHostToken(
            id,
            meeting.host_token
          );

          // ====================================================
          // REGISTER HOST IN DATABASE
          // ====================================================

          await registerHostParticipant(
            id,
            displayName,
            meeting.host_token
          );

          // ====================================================
          // ENTER HOST ROOM
          // ====================================================

          const params =
            new URLSearchParams({
              name:
                displayName,
            });

          await router.push(
            `/meeting/${encodeURIComponent(
              id
            )}?${params.toString()}`
          );

          return;
        }

        // ======================================================
        // EXISTING MEETING / GUEST
        // ======================================================

        if (!meetingId) {
          throw new Error(
            "Meeting ID is missing."
          );
        }

        /*
         * Verify meeting again in case it
         * was ended while this page was open.
         */
        await getMeeting(
          meetingId
        );

        /*
         * IMPORTANT:
         *
         * DO NOT call joinMeeting() here.
         *
         * The guest must first go through
         * the WebSocket waiting room.
         *
         * The WebSocket server will decide
         * whether the guest is admitted.
         */

        const params =
          new URLSearchParams({
            name:
              displayName,
          });

        await router.push(
          `/meeting/${encodeURIComponent(
            meetingId
          )}?${params.toString()}`
        );

      } catch (err) {
        console.error(
          "Unable to enter meeting:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to enter the meeting."
        );

        setJoining(false);
      }
    };

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#111827]">

        <div className="text-center">

          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />

          <p className="mt-4 text-sm text-gray-400">
            Preparing your meeting...
          </p>

        </div>

      </main>
    );
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <>
      <Head>
        <title>
          {isExistingMeeting
            ? "Join meeting — Meetly"
            : "Create meeting — Meetly"}
        </title>
      </Head>

      <main className="min-h-screen bg-[#111827] text-white">

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <header className="flex h-16 items-center justify-between border-b border-white/10 px-5 sm:px-8">

          <button
            onClick={() =>
              router.push("/")
            }
            className="flex items-center gap-2 text-sm text-gray-300 transition hover:text-white"
          >

            <ArrowLeft
              size={17}
            />

            Back

          </button>

          <span className="text-sm font-medium text-gray-300">
            Meetly
          </span>

        </header>

        {/* ================================================== */}
        {/* CONTENT */}
        {/* ================================================== */}

        <section className="mx-auto flex max-w-6xl items-center px-5 py-10 sm:px-8">

          <div className="grid w-full gap-8 lg:grid-cols-[1.3fr_0.7fr]">

            {/* ================================================= */}
            {/* CAMERA PREVIEW */}
            {/* ================================================= */}

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">

              <div className="relative aspect-video">

                {/* CAMERA ON */}

                {cameraOn &&
                streamRef.current ? (

                  <video
                    ref={
                      videoRef
                    }
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />

                ) : (

                  /* CAMERA OFF */

                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#202124]">

                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-700 text-2xl font-semibold">

                      {name
                        .charAt(0)
                        .toUpperCase() ||
                        "Y"}

                    </div>

                    <p className="mt-4 text-sm text-gray-400">
                      Your camera is turned off
                    </p>

                  </div>

                )}

                {/* ============================================= */}
                {/* PRE-JOIN CONTROLS */}
                {/* ============================================= */}

                <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-3">

                  {/* MICROPHONE */}

                  <IconButton
                    label={
                      micOn
                        ? "Turn microphone off"
                        : "Turn microphone on"
                    }
                    active={
                      !micOn
                    }
                    onClick={
                      toggleMic
                    }
                  >

                    {micOn ? (
                      <Mic
                        size={19}
                      />
                    ) : (
                      <MicOff
                        size={19}
                      />
                    )}

                  </IconButton>

                  {/* CAMERA */}

                  <IconButton
                    label={
                      cameraOn
                        ? "Turn camera off"
                        : "Turn camera on"
                    }
                    active={
                      !cameraOn
                    }
                    onClick={
                      toggleCamera
                    }
                  >

                    {cameraOn ? (
                      <Video
                        size={19}
                      />
                    ) : (
                      <VideoOff
                        size={19}
                      />
                    )}

                  </IconButton>

                </div>

              </div>

              {/* PREVIEW FOOTER */}

              <div className="px-5 py-4">

                <p className="text-sm font-medium">
                  Ready?
                </p>

                <p className="mt-1 text-xs text-gray-400">

                  {isExistingMeeting
                    ? "The host will be asked to let you into the meeting."
                    : "You will enter as the meeting host."}

                </p>

              </div>

            </div>

            {/* ================================================= */}
            {/* RIGHT PANEL */}
            {/* ================================================= */}

            <div className="flex flex-col justify-center">

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">

                <h1 className="text-2xl font-semibold">

                  {isExistingMeeting
                    ? "Join meeting"
                    : "Create meeting"}

                </h1>

                <p className="mt-2 text-sm leading-6 text-gray-400">

                  {isExistingMeeting
                    ? "Enter your display name. The host will need to admit you before you can enter."
                    : "Enter your display name to create the meeting. You will become the host."}

                </p>

                <div className="mt-6 space-y-4">

                  <Input
                    label="Your name"
                    value={
                      name
                    }
                    onChange={(
                      event
                    ) =>
                      setName(
                        event.target.value
                      )
                    }
                    placeholder="Enter your name"
                    className="border-white/10 bg-white/5 text-white placeholder:text-gray-500"
                  />

                  <Button
                    className="w-full"
                    disabled={
                      !name.trim() ||
                      joining ||
                      Boolean(error)
                    }
                    loading={
                      joining
                    }
                    onClick={
                      handleMeetingAction
                    }
                  >

                    {isExistingMeeting
                      ? "Request to join"
                      : "Create meeting"}

                  </Button>

                </div>

                {/* ERROR */}

                {error && (
                  <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">

                    {error}

                  </div>
                )}

                {/* WAITING ROOM INFO */}

                {isExistingMeeting &&
                  !error && (

                    <div className="mt-5 border-t border-white/10 pt-5">

                      <p className="text-xs leading-5 text-gray-500">

                        You won't enter the call until the meeting host approves your request.

                      </p>

                    </div>

                  )}

              </div>

            </div>

          </div>

        </section>

      </main>
    </>
  );
}