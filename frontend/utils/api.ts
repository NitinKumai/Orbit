// ============================================================
// API CONFIGURATION
// ============================================================

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";


// ============================================================
// TYPES
// ============================================================

export interface Meeting {
  id: string;
  title: string;

  host_id?: string | null;

  waiting_room_enabled: boolean;

  scheduled_at?: string | null;
  created_at: string;
}


export interface CreatedMeeting
  extends Meeting {
  /*
   * IMPORTANT:
   *
   * This token is returned ONLY when a meeting
   * is created/scheduled.
   *
   * Never put this token inside the shareable
   * meeting link.
   */
  host_token: string;
}


export interface Participant {
  id: string;
  name: string;

  is_host: boolean;
  admitted: boolean;

  joined_at: string;
}


export interface HostVerification {
  valid: boolean;
  meeting_id: string;
  host_id?: string | null;
}


// ============================================================
// GENERIC API REQUEST
// ============================================================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response =
    await fetch(
      `${API_URL}${endpoint}`,
      {
        ...options,

        headers: {
          "Content-Type":
            "application/json",

          ...(options.headers || {}),
        },
      }
    );

  if (!response.ok) {
    let message =
      "Something went wrong.";

    try {
      const data =
        await response.json();

      if (
        typeof data?.detail ===
        "string"
      ) {
        message =
          data.detail;
      } else if (
        typeof data?.message ===
        "string"
      ) {
        message =
          data.message;
      }
    } catch {
      // Keep fallback message.
    }

    throw new Error(
      message
    );
  }

  return response.json();
}


// ============================================================
// CREATE MEETING
// ============================================================

export async function createMeeting(
  title = "Instant Meeting"
): Promise<CreatedMeeting> {
  return apiRequest<CreatedMeeting>(
    "/meetings",
    {
      method: "POST",

      body: JSON.stringify({
        title,
      }),
    }
  );
}


// ============================================================
// GET MEETING
// ============================================================

export async function getMeeting(
  meetingId: string
): Promise<Meeting> {
  return apiRequest<Meeting>(
    `/meetings/${encodeURIComponent(
      meetingId
    )}`
  );
}


// ============================================================
// REGISTER NORMAL PARTICIPANT
// ============================================================
//
// IMPORTANT:
//
// Once the waiting room is fully active,
// guests should not call this before being
// admitted.
//
// We keep this function because other pages
// may still use it.
// ============================================================

export async function joinMeeting(
  meetingId: string,
  name: string
): Promise<Participant> {
  return apiRequest<Participant>(
    `/meetings/${encodeURIComponent(
      meetingId
    )}/participants`,
    {
      method: "POST",

      body: JSON.stringify({
        name,
      }),
    }
  );
}


// ============================================================
// REGISTER HOST PARTICIPANT
// ============================================================

export async function registerHostParticipant(
  meetingId: string,
  name: string,
  hostToken: string
): Promise<Participant> {
  const params =
    new URLSearchParams({
      host_token:
        hostToken,
    });

  return apiRequest<Participant>(
    `/meetings/${encodeURIComponent(
      meetingId
    )}/host/participant?${params.toString()}`,
    {
      method: "POST",

      body: JSON.stringify({
        name,
      }),
    }
  );
}


// ============================================================
// GET PARTICIPANTS
// ============================================================

export async function getParticipants(
  meetingId: string
): Promise<Participant[]> {
  return apiRequest<
    Participant[]
  >(
    `/meetings/${encodeURIComponent(
      meetingId
    )}/participants`
  );
}


// ============================================================
// SCHEDULE MEETING
// ============================================================

export async function scheduleMeeting(
  title: string,
  date: string,
  time: string
): Promise<CreatedMeeting> {
  return apiRequest<CreatedMeeting>(
    "/meetings/schedule",
    {
      method: "POST",

      body: JSON.stringify({
        title,
        date,
        time,
      }),
    }
  );
}


// ============================================================
// VERIFY HOST
// ============================================================

export async function verifyHost(
  meetingId: string,
  hostToken: string
): Promise<HostVerification> {
  return apiRequest<HostVerification>(
    `/meetings/${encodeURIComponent(
      meetingId
    )}/verify-host`,
    {
      method: "POST",

      body: JSON.stringify({
        host_token:
          hostToken,
      }),
    }
  );
}


// ============================================================
// END MEETING
// ============================================================

export async function endMeeting(
  meetingId: string,
  hostToken: string
): Promise<{
  message: string;
  meeting_id: string;
}> {
  const params =
    new URLSearchParams({
      host_token:
        hostToken,
    });

  return apiRequest(
    `/meetings/${encodeURIComponent(
      meetingId
    )}?${params.toString()}`,
    {
      method: "DELETE",
    }
  );
}


// ============================================================
// WEBSOCKET URL
// ============================================================

export function getWebSocketUrl(
  meetingId: string
) {
  const wsBase =
    API_URL.replace(
      /^http/,
      "ws"
    );

  return `${wsBase}/ws/meetings/${encodeURIComponent(
    meetingId
  )}`;
}


// ============================================================
// SHAREABLE MEETING LINK
// ============================================================
//
// IMPORTANT:
//
// The host token must NEVER be included here.
//
// Anyone receiving this link is treated as
// a normal guest and must enter the waiting room.
// ============================================================

export function getMeetingLink(
  meetingId: string
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return "";
  }

  return `${
    window.location.origin
  }/meet-now?code=${encodeURIComponent(
    meetingId
  )}`;
}


// ============================================================
// HOST TOKEN STORAGE
// ============================================================
//
// sessionStorage is used instead of putting the
// secret credential in the meeting URL.
//
// The credential therefore:
//
// - is not copied in meeting links
// - is not sent to guests
// - survives page navigation/refresh in this tab
// - disappears when the browser tab/session ends
//
// This is sufficient for the current development
// stage. A production application should use
// authenticated server sessions instead.
// ============================================================

function getHostTokenKey(
  meetingId: string
) {
  return `meetly_host_token_${meetingId}`;
}


// ============================================================
// SAVE HOST TOKEN
// ============================================================

export function saveHostToken(
  meetingId: string,
  hostToken: string
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  sessionStorage.setItem(
    getHostTokenKey(
      meetingId
    ),
    hostToken
  );
}


// ============================================================
// READ HOST TOKEN
// ============================================================

export function getStoredHostToken(
  meetingId: string
): string | null {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  return sessionStorage.getItem(
    getHostTokenKey(
      meetingId
    )
  );
}


// ============================================================
// REMOVE HOST TOKEN
// ============================================================

export function removeHostToken(
  meetingId: string
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  sessionStorage.removeItem(
    getHostTokenKey(
      meetingId
    )
  );
}


// ============================================================
// API URL EXPORT
// ============================================================

export {
  API_URL,
};