import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Copy,
} from "lucide-react";
import Button from "../components/Button";
import Input from "../components/Input";
import { scheduleMeeting, getMeetingLink } from "../utils/api";

export default function Schedule() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const [loading, setLoading] = useState(false);
  const [meeting, setMeeting] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!title.trim() || !date || !time) {
      setError("Please complete all fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await scheduleMeeting({
        title: title.trim(),
        date,
        time,
      });

      setMeeting(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to schedule meeting."
      );
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!meeting?.id) return;

    await navigator.clipboard.writeText(
      getMeetingLink(meeting.id)
    );

    setCopied(true);

    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <Head>
        <title>Schedule meeting — Meetly</title>
      </Head>

      <main className="min-h-screen bg-gray-50">
        <header className="border-b border-gray-200 bg-white">
          <div className="page-container flex h-16 items-center">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={17} />
              Back
            </button>
          </div>
        </header>

        <section className="page-container flex justify-center py-12">
          <div className="w-full max-w-xl">
            {!meeting ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-soft">
                <div className="mb-7">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <CalendarDays size={21} />
                  </div>

                  <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                    Schedule a meeting
                  </h1>

                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    Choose a title and time. You&apos;ll get a
                    shareable meeting link after scheduling.
                  </p>
                </div>

                <div className="space-y-5">
                  <Input
                    label="Meeting title"
                    value={title}
                    onChange={(e) =>
                      setTitle(e.target.value)
                    }
                    placeholder="Team discussion"
                  />

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Input
                      label="Date"
                      type="date"
                      value={date}
                      onChange={(e) =>
                        setDate(e.target.value)
                      }
                    />

                    <Input
                      label="Time"
                      type="time"
                      value={time}
                      onChange={(e) =>
                        setTime(e.target.value)
                      }
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <Button
                    className="w-full"
                    loading={loading}
                    onClick={submit}
                  >
                    Schedule meeting
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-soft">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600">
                  <Check size={23} />
                </div>

                <h1 className="mt-5 text-2xl font-semibold text-gray-900">
                  Meeting scheduled
                </h1>

                <p className="mt-2 text-sm text-gray-500">
                  Your meeting has been created successfully.
                </p>

                <div className="mt-7 space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-5">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Meeting
                    </p>

                    <p className="mt-1 font-medium text-gray-900">
                      {meeting.title || title}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Date & time
                    </p>

                    <p className="mt-1 text-sm text-gray-700">
                      {date} at {time}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Meeting ID
                    </p>

                    <p className="mt-1 font-mono text-sm text-gray-700">
                      {meeting.id}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex gap-3">
                  <Button
                    className="flex-1"
                    onClick={copyLink}
                  >
                    {copied ? (
                      <Check size={17} />
                    ) : (
                      <Copy size={17} />
                    )}

                    {copied
                      ? "Link copied"
                      : "Copy meeting link"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => router.push("/")}
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}