import { useCallback, useState } from "react";
import {
  createMeeting,
  getMeeting,
  joinMeeting,
  scheduleMeeting,
  Meeting,
  Participant,
} from "../utils/api";

export function useMeeting() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const create = useCallback(async (title?: string) => {
    setLoading(true);
    setError("");

    try {
      const meeting = await createMeeting(
        title || "Instant Meeting"
      );

      return meeting;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to create meeting";

      setError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback(async (meetingId: string) => {
    setLoading(true);
    setError("");

    try {
      const meeting = await getMeeting(meetingId);

      return meeting;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Meeting not found";

      setError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const join = useCallback(
    async (meetingId: string, name: string) => {
      setLoading(true);
      setError("");

      try {
        const participant = await joinMeeting(
          meetingId,
          name
        );

        return participant;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to join meeting";

        setError(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const schedule = useCallback(
    async (data: {
      title: string;
      date: string;
      time: string;
    }) => {
      setLoading(true);
      setError("");

      try {
        const meeting = await scheduleMeeting(data);

        return meeting;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to schedule meeting";

        setError(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    create,
    get,
    join,
    schedule,
  };
}