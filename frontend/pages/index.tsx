import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import {
  Video,
  CalendarDays,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import Button from "../components/Button";
import Input from "../components/Input";

export default function Home() {
  const router = useRouter();

  const [meetingCode, setMeetingCode] = useState("");

  const joinMeeting = () => {
    const code = meetingCode.trim();

    if (!code) return;

    const cleanedCode = code
      .replace(/^https?:\/\/[^/]+\/meet-now\?code=/, "")
      .replace(/^https?:\/\/[^/]+\/meeting\//, "")
      .replace(/^\/meeting\//, "");

    router.push(
      `/meet-now?code=${encodeURIComponent(cleanedCode)}`
    );
  };

  return (
    <>
      <Head>
        <title>Meetly — Video meetings made simple</title>
        <meta
          name="description"
          content="Professional video meetings with simple joining, scheduling and collaboration."
        />
      </Head>

      <main className="min-h-screen bg-white">
        <header className="border-b border-gray-100">
          <div className="page-container flex h-16 items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Video size={19} />
              </div>

              <span className="text-lg font-semibold tracking-tight text-gray-900">
                Meetly
              </span>
            </div>

            <div className="hidden items-center gap-2 text-sm text-gray-500 sm:flex">
              <ShieldCheck size={16} />
              Secure meetings
            </div>
          </div>
        </header>

        <section className="page-container flex min-h-[calc(100vh-64px)] items-center py-16">
          <div className="grid w-full items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Simple, secure video meetings
              </div>

              <h1 className="text-4xl font-semibold tracking-tight text-gray-950 sm:text-5xl lg:text-6xl">
                Video meetings,
                <br />
                without the clutter.
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-gray-500 sm:text-lg">
                Start a meeting instantly or schedule one for
                later. Join from any device with a simple
                meeting link.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  onClick={() =>
                    router.push("/meet-now")
                  }
                >
                  <Video size={18} />
                  New meeting
                </Button>

                <Button
                  variant="outline"
                  onClick={() =>
                    router.push("/schedule")
                  }
                >
                  <CalendarDays size={18} />
                  Schedule
                </Button>
              </div>
            </div>

            <div className="w-full lg:justify-self-end">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-soft">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Join a meeting
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Enter a meeting code or paste a meeting
                    link.
                  </p>
                </div>

                <div className="space-y-4">
                  <Input
                    value={meetingCode}
                    onChange={(e) =>
                      setMeetingCode(e.target.value)
                    }
                    placeholder="Meeting code or link"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        joinMeeting();
                      }
                    }}
                  />

                  <Button
                    className="w-full"
                    disabled={!meetingCode.trim()}
                    onClick={joinMeeting}
                  >
                    Join meeting
                    <ArrowRight size={17} />
                  </Button>
                </div>

                <div className="mt-6 border-t border-gray-100 pt-5">
                  <p className="text-xs leading-5 text-gray-400">
                    By joining a meeting, you agree to use the
                    service responsibly and respect other
                    participants.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}