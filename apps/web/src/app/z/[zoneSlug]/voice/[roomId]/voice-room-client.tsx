"use client";

import {
  Captions,
  CircleDot,
  Hand,
  Lock,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Radio,
  ShieldCheck,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type Participant = {
  id?: string;
  user_id?: string;
  participant_role?: string;
  muted_at?: string | null;
  deafen_at?: string | null;
  left_at?: string | null;
  profiles?: {
    username?: string | null;
    display_name?: string | null;
  } | null;
};

type VoiceRoomResponse = {
  room?: {
    id?: string;
    title?: string;
    recording_enabled?: boolean;
    transcription_enabled?: boolean;
    waiting_room_enabled?: boolean;
    screen_share_enabled?: boolean;
    metadata?: Record<string, unknown>;
  };
  participants?: Participant[];
  permissions?: {
    canJoin?: boolean;
    canModerate?: boolean;
    waitingRoom?: boolean;
  };
};

export function VoiceRoomClient({ zoneSlug, roomId }: { zoneSlug: string; roomId: string }) {
  const [roomState, setRoomState] = useState<VoiceRoomResponse | null>(null);
  const [status, setStatus] = useState("Idle");
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [pushToTalk, setPushToTalk] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [transcriptionConsent, setTranscriptionConsent] = useState(false);

  const recordingActive = roomState?.room?.recording_enabled === true;
  const transcriptionActive = roomState?.room?.transcription_enabled === true;
  const consentReady =
    (!recordingActive || recordingConsent) && (!transcriptionActive || transcriptionConsent);
  const participantCount = useMemo(
    () => (roomState?.participants ?? []).filter((participant) => !participant.left_at).length,
    [roomState],
  );

  useEffect(() => {
    let ignore = false;
    fetch(`/api/voice/rooms/${roomId}`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Room load failed: ${response.status}`);
        }
        return (await response.json()) as VoiceRoomResponse;
      })
      .then((data) => {
        if (!ignore) {
          setRoomState(data);
          setStatus("Room loaded");
        }
      })
      .catch((error: unknown) => {
        if (!ignore) {
          setStatus(error instanceof Error ? error.message : "Room load failed");
        }
      });
    return () => {
      ignore = true;
    };
  }, [roomId]);

  async function joinRoom() {
    setStatus("Joining");
    const response = await fetch("/api/voice/token", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        recordingConsentAccepted: recordingConsent,
        transcriptionConsentAccepted: transcriptionConsent,
        deafen: deafened,
        pushToTalkEnabled: pushToTalk,
      }),
    });
    const data = (await response.json().catch(() => null)) as { detail?: string } | null;
    setStatus(
      response.ok ? "Connected token issued" : (data?.detail ?? `Join failed: ${response.status}`),
    );
  }

  async function sendControl(action: string) {
    setStatus(`${action} pending`);
    const response = await fetch(`/api/voice/rooms/${roomId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: "voice room control" }),
    });
    setStatus(response.ok ? `${action} applied` : `${action} failed: ${response.status}`);
  }

  return (
    <main
      aria-labelledby="voice-room-title"
      className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 md:px-6 md:py-8 xl:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <section className="min-w-0 space-y-6">
        <header className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent-strong)]">
              Zone / {zoneSlug}
            </div>
            <h1
              id="voice-room-title"
              className="text-2xl font-semibold tracking-normal text-[var(--color-text)] md:text-3xl"
            >
              {roomState?.room?.title ?? "Voice room"}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              active={recordingActive}
              icon={<CircleDot size={16} />}
              label="Recording"
            />
            <StatusBadge
              active={transcriptionActive}
              icon={<Captions size={16} />}
              label="Transcript"
            />
            <span className="status-pill" data-status="ready">
              {participantCount} live
            </span>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
            <div className="grid min-h-[20rem] place-items-center rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-panel-strong)] p-6 text-center">
              <div className="space-y-3">
                <Radio className="mx-auto text-[var(--color-accent)]" size={36} />
                <p className="text-sm font-semibold text-[var(--color-text)]">{status}</p>
                <p className="mx-auto max-w-md text-sm leading-6 text-[var(--color-text-muted)]">
                  Media authorization pending.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
            <h2 className="text-sm font-semibold">Pre-join</h2>
            <div className="mt-4 space-y-3 text-sm text-[var(--color-text-muted)]">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  disabled={!recordingActive}
                  checked={!recordingActive || recordingConsent}
                  onChange={(event) => setRecordingConsent(event.currentTarget.checked)}
                />
                <span>Recording consent</span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  disabled={!transcriptionActive}
                  checked={!transcriptionActive || transcriptionConsent}
                  onChange={(event) => setTranscriptionConsent(event.currentTarget.checked)}
                />
                <span>Transcript consent</span>
              </label>
            </div>
            <button
              type="button"
              className="button-primary mt-5 w-full gap-2"
              disabled={!consentReady}
              onClick={() => {
                void joinRoom();
              }}
            >
              <Mic size={16} />
              Join
            </button>
          </div>
        </section>

        <section
          aria-label="Voice controls"
          className="flex flex-wrap gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-3"
        >
          <IconToggle
            active={!muted}
            label={muted ? "Unmute" : "Mute"}
            onClick={() => setMuted((value) => !value)}
            icon={muted ? <MicOff size={18} /> : <Mic size={18} />}
          />
          <IconToggle
            active={!deafened}
            label={deafened ? "Undeafen" : "Deafen"}
            onClick={() => {
              const next = !deafened;
              setDeafened(next);
              void sendControl(next ? "deafen" : "undeafen");
            }}
            icon={deafened ? <VolumeX size={18} /> : <Volume2 size={18} />}
          />
          <IconToggle
            active={pushToTalk}
            label="Push to talk"
            onClick={() => {
              const next = !pushToTalk;
              setPushToTalk(next);
              void sendControl(next ? "push_to_talk_on" : "push_to_talk_off");
            }}
            icon={<Hand size={18} />}
          />
          <IconToggle
            active={roomState?.room?.screen_share_enabled === true}
            label="Screen share"
            onClick={() => {
              void sendControl(
                roomState?.room?.screen_share_enabled === true
                  ? "disable_screen_share"
                  : "enable_screen_share",
              );
            }}
            icon={<MonitorUp size={18} />}
          />
          <IconToggle
            active={false}
            label="Leave"
            onClick={() => setStatus("Left locally")}
            icon={<PhoneOff size={18} />}
          />
        </section>
      </section>

      <aside className="space-y-4">
        <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
          <div className="flex items-center gap-2">
            <Users size={18} />
            <h2 className="text-sm font-semibold">Participants</h2>
          </div>
          <ul className="mt-4 space-y-2">
            {(roomState?.participants ?? []).slice(0, 12).map((participant) => (
              <li
                key={participant.id ?? participant.user_id}
                className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  {participant.profiles?.display_name ??
                    participant.profiles?.username ??
                    participant.user_id ??
                    "Participant"}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {participant.participant_role ?? "speaker"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} />
            <h2 className="text-sm font-semibold">Moderator</h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="button-secondary gap-2"
              onClick={() => {
                void sendControl("mute_all");
              }}
            >
              <MicOff size={16} />
              Mute all
            </button>
            <button
              type="button"
              className="button-secondary gap-2"
              onClick={() => {
                void sendControl("lock");
              }}
            >
              <Lock size={16} />
              Lock
            </button>
          </div>
        </section>
      </aside>
    </main>
  );
}

function StatusBadge({ active, icon, label }: { active: boolean; icon: ReactNode; label: string }) {
  return (
    <span
      className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--color-border)] px-2 text-xs font-semibold"
      data-active={active}
    >
      {icon}
      {label}: {active ? "On" : "Off"}
    </span>
  );
}

function IconToggle({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className="grid h-10 w-10 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] transition hover:bg-[var(--color-panel-strong)] aria-pressed:bg-[var(--color-accent-soft)]"
    >
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  );
}
