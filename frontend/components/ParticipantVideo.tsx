import React from "react";
import {
  Mic,
  MicOff,
  VideoOff,
} from "lucide-react";

interface ParticipantVideoProps {
  stream?: MediaStream;

  name: string;

  /*
   * Controls audio playback.
   *
   * Local user:
   * muted = true
   *
   * Remote user:
   * muted = false
   */
  muted?: boolean;

  /*
   * REAL microphone state.
   *
   * true  = microphone ON
   * false = microphone OFF
   */
  micOn?: boolean;

  speaking?: boolean;

  cameraOff?: boolean;
}

export default function ParticipantVideo({
  stream,
  name,
  muted = false,
  micOn = false,
  speaking = false,
  cameraOff = false,
}: ParticipantVideoProps) {
  const videoRef =
    React.useRef<HTMLVideoElement>(null);

  // ============================================================
  // ATTACH MEDIA STREAM
  // ============================================================

  React.useEffect(() => {
    const video =
      videoRef.current;

    if (!video || !stream) {
      return;
    }

    /*
     * Keep the media stream attached even when
     * the participant's camera is OFF.
     *
     * This is important because the same element
     * also plays the remote microphone audio.
     */
    if (
      video.srcObject !== stream
    ) {
      video.srcObject =
        stream;
    }

    const startPlayback =
      async () => {
        try {
          await video.play();
        } catch (error) {
          console.warn(
            "Media playback could not start:",
            error
          );
        }
      };

    void startPlayback();

    return () => {
      if (
        video.srcObject ===
        stream
      ) {
        video.srcObject =
          null;
      }
    };
  }, [stream]);

  // ============================================================
  // PARTICIPANT NAME / INITIAL
  // ============================================================

  const cleanName =
    name
      .replace("(You)", "")
      .trim();

  const initial =
    cleanName
      .charAt(0)
      .toUpperCase() || "?";

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      className={`
        relative
        flex
        h-full
        min-h-[220px]
        w-full
        overflow-hidden
        rounded-xl
        bg-[#202124]

        ${
          speaking
            ? "ring-2 ring-indigo-500"
            : "ring-1 ring-white/10"
        }
      `}
    >
      {/* ====================================================== */}
      {/* VIDEO / AUDIO ELEMENT */}
      {/* ====================================================== */}

      {stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline

          /*
           * IMPORTANT:
           *
           * This is ONLY audio playback muting.
           *
           * Local participant = true
           * Remote participant = false
           */
          muted={muted}

          /*
           * Never remove this element when
           * camera is OFF.
           *
           * We only hide the picture.
           *
           * Remote microphone audio therefore
           * continues working.
           */
          className={`
            absolute
            inset-0
            h-full
            w-full
            object-cover
            transition-opacity
            duration-200

            ${
              cameraOff
                ? "opacity-0"
                : "opacity-100"
            }
          `}
        />
      )}

      {/* ====================================================== */}
      {/* CAMERA OFF PLACEHOLDER */}
      {/* ====================================================== */}

      {cameraOff && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#202124]">

          {/* Avatar */}

          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#3c4043] text-2xl font-medium text-white shadow-lg">

            {initial}

          </div>

          {/* Camera off text */}

          <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">

            <VideoOff
              size={14}
            />

            <span>
              Camera off
            </span>

          </div>

        </div>
      )}

      {/* ====================================================== */}
      {/* NO STREAM PLACEHOLDER */}
      {/* ====================================================== */}

      {!stream &&
        !cameraOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#202124]">

            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#3c4043] text-2xl font-medium text-white">

              {initial}

            </div>

          </div>
        )}

      {/* ====================================================== */}
      {/* PARTICIPANT NAME + MICROPHONE STATUS */}
      {/* ====================================================== */}

      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-md bg-black/65 px-2.5 py-1.5 text-xs text-white backdrop-blur-sm">

        {/* Name */}

        <span className="max-w-[180px] truncate">

          {name}

        </span>

        {/* ================================================== */}
        {/* REAL MICROPHONE STATE */}
        {/* ================================================== */}

        {micOn ? (

          /*
           * MICROPHONE ON
           */
          <span
            title="Microphone on"
            className="flex items-center text-green-400"
          >

            <Mic
              size={13}
              strokeWidth={2.2}
            />

          </span>

        ) : (

          /*
           * MICROPHONE OFF
           */
          <span
            title="Microphone off"
            className="flex items-center text-gray-300"
          >

            <MicOff
              size={13}
              strokeWidth={2.2}
            />

          </span>

        )}

      </div>

      {/* ====================================================== */}
      {/* CAMERA OFF ICON — TOP RIGHT */}
      {/* ====================================================== */}

      {cameraOff && (
        <div
          title="Camera off"
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-gray-300 backdrop-blur-sm"
        >

          <VideoOff
            size={15}
          />

        </div>
      )}

    </div>
  );
}