export const PACKAGE_NAME = "@ai-oss/voice" as const;

export const VOICE_ROOM_TYPES = [
  "zone",
  "paper_review",
  "event_seminar",
  "moderator",
  "temporary_invite",
] as const;
export type VoiceRoomType = (typeof VOICE_ROOM_TYPES)[number];

export const VOICE_VISIBILITIES = ["public", "zone", "private", "moderator", "admin"] as const;
export type VoiceVisibility = (typeof VOICE_VISIBILITIES)[number];

export const VOICE_PARTICIPANT_ROLES = ["listener", "speaker", "moderator", "host"] as const;
export type VoiceParticipantRole = (typeof VOICE_PARTICIPANT_ROLES)[number];

export const VOICE_CONTROL_ACTIONS = [
  "lock",
  "unlock",
  "anti_raid_lock",
  "enable_screen_share",
  "disable_screen_share",
  "enable_recording",
  "disable_recording",
  "enable_transcription",
  "disable_transcription",
  "mute_all",
  "mute",
  "unmute",
  "deafen",
  "undeafen",
  "push_to_talk_on",
  "push_to_talk_off",
  "kick",
  "ban",
  "cooldown",
] as const;
export type VoiceControlAction = (typeof VOICE_CONTROL_ACTIONS)[number];

export interface VoiceRoomInput {
  title: string;
  createdBy: string;
  roomType?: VoiceRoomType;
  visibility?: VoiceVisibility;
  zoneId?: string | null;
  chatRoomId?: string | null;
  linkedPaperId?: string | null;
  eventStartsAt?: string | null;
  waitingRoomEnabled?: boolean;
  screenShareEnabled?: boolean;
  pushToTalkDefault?: boolean;
  liveKitRoomName?: string | null;
  now?: Date;
}

export interface VoiceRoomInsertRow {
  zone_id: string | null;
  chat_room_id: string | null;
  room_type: VoiceRoomType;
  livekit_room_name: string;
  title: string;
  visibility: VoiceVisibility;
  created_by: string;
  is_active: true;
  recording_enabled: false;
  transcription_enabled: false;
  waiting_room_enabled: boolean;
  screen_share_enabled: boolean;
  metadata: Record<string, unknown>;
}

export interface VoiceParticipantUpsertRow {
  voice_room_id: string;
  user_id: string;
  participant_role: VoiceParticipantRole;
  joined_at: string;
  left_at: null;
  muted_at: string | null;
  banned_at: null;
  deafen_at: string | null;
  push_to_talk_enabled: boolean;
  cooldown_until: string | null;
  metadata: Record<string, unknown>;
}

export interface LiveKitAccessClaims {
  iss: string;
  sub: string;
  nbf: number;
  exp: number;
  name?: string;
  video: {
    roomJoin: true;
    room: string;
    canPublish: boolean;
    canSubscribe: boolean;
    canPublishData: boolean;
    canUpdateOwnMetadata: boolean;
    roomAdmin: boolean;
    roomRecord: boolean;
    canPublishSources: string[];
  };
  metadata: string;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  limit: number;
  windowSeconds: number;
}

export interface ConsentDecision {
  allowed: boolean;
  required: boolean;
  missing: ("recording" | "transcription")[];
  notice: string | null;
}

export function parseVoiceRoomType(value: unknown): VoiceRoomType {
  return VOICE_ROOM_TYPES.includes(value as VoiceRoomType) ? (value as VoiceRoomType) : "zone";
}

export function parseVoiceVisibility(value: unknown, roomType: VoiceRoomType): VoiceVisibility {
  if (VOICE_VISIBILITIES.includes(value as VoiceVisibility)) {
    return value as VoiceVisibility;
  }
  if (roomType === "moderator") {
    return "moderator";
  }
  if (roomType === "temporary_invite") {
    return "private";
  }
  return "zone";
}

export function buildVoiceRoomInsertRow(input: VoiceRoomInput): VoiceRoomInsertRow {
  const title = normalizeText(input.title);
  const createdBy = normalizeText(input.createdBy);
  const roomType = parseVoiceRoomType(input.roomType);
  const visibility = parseVoiceVisibility(input.visibility, roomType);

  if (title.length < 3 || title.length > 120) {
    throw new Error("Voice room title length is invalid.");
  }
  if (!createdBy) {
    throw new Error("Voice room creator is required.");
  }
  if (roomType === "paper_review" && !normalizeNullable(input.linkedPaperId)) {
    throw new Error("Paper review voice rooms require a linked paper.");
  }

  const livekitRoomName =
    normalizeNullable(input.liveKitRoomName) ??
    buildLiveKitRoomName({
      title,
      createdBy,
      now: input.now,
    });

  return {
    zone_id: normalizeNullable(input.zoneId),
    chat_room_id: normalizeNullable(input.chatRoomId),
    room_type: roomType,
    livekit_room_name: livekitRoomName,
    title,
    visibility,
    created_by: createdBy,
    is_active: true,
    recording_enabled: false,
    transcription_enabled: false,
    waiting_room_enabled: input.waitingRoomEnabled === true,
    screen_share_enabled: input.screenShareEnabled === true,
    metadata: {
      room_type: roomType,
      linked_paper_id: normalizeNullable(input.linkedPaperId),
      event_starts_at: normalizeNullable(input.eventStartsAt),
      push_to_talk_default: input.pushToTalkDefault === true,
      recording_notice: null,
      retention_policy_days: 0,
      automated_transcript_label: "automated",
      report_delete_controls: false,
      abuse_metadata_audio_recorded: false,
    },
  };
}

export function buildLiveKitRoomName(input: {
  title: string;
  createdBy: string;
  now?: Date;
}): string {
  const slug = slugify(input.title).slice(0, 48) || "voice-room";
  const stamp = (input.now ?? new Date()).getTime().toString(36);
  const digest = stableHash(`${input.createdBy}:${input.title}:${stamp}`).toString(36);
  return `voice-${slug}-${digest}`.slice(0, 96);
}

export function evaluateRoomCreationRateLimit(input: {
  recentRoomCreatedAts: readonly (string | Date)[];
  now?: Date;
  limit?: number;
  windowSeconds?: number;
}): RateLimitDecision {
  return evaluateWindowLimit({
    timestamps: input.recentRoomCreatedAts,
    now: input.now,
    limit: input.limit ?? 3,
    windowSeconds: input.windowSeconds ?? 10 * 60,
  });
}

export function evaluateJoinRateLimit(input: {
  recentJoinAts: readonly (string | Date)[];
  now?: Date;
  limit?: number;
  windowSeconds?: number;
}): RateLimitDecision {
  return evaluateWindowLimit({
    timestamps: input.recentJoinAts,
    now: input.now,
    limit: input.limit ?? 8,
    windowSeconds: input.windowSeconds ?? 60,
  });
}

export function evaluateHostReputation(input: {
  visibility: VoiceVisibility;
  trustScore?: number | null;
  requiredTrustScore?: number;
}) {
  const required = input.requiredTrustScore ?? 25;
  if (input.visibility !== "public") {
    return { allowed: true as const, requiredTrustScore: required, actualTrustScore: null };
  }
  const actual = Number(input.trustScore ?? 0);
  return {
    allowed: actual >= required,
    requiredTrustScore: required,
    actualTrustScore: actual,
  };
}

export function evaluateRecordingConsent(input: {
  recordingEnabled: boolean;
  transcriptionEnabled: boolean;
  recordingConsentAccepted?: boolean;
  transcriptionConsentAccepted?: boolean;
  notice?: string | null;
}): ConsentDecision {
  const missing: ConsentDecision["missing"] = [];
  if (input.recordingEnabled && input.recordingConsentAccepted !== true) {
    missing.push("recording");
  }
  if (input.transcriptionEnabled && input.transcriptionConsentAccepted !== true) {
    missing.push("transcription");
  }
  return {
    allowed: missing.length === 0,
    required: input.recordingEnabled || input.transcriptionEnabled,
    missing,
    notice: normalizeNullable(input.notice),
  };
}

export function buildRecordingSettingsPatch(input: {
  existingMetadata?: unknown;
  recordingEnabled: boolean;
  transcriptionEnabled: boolean;
  consentNotice?: string | null;
  retentionDays?: number;
  now?: Date;
}) {
  const recordingEnabled = input.recordingEnabled === true;
  const transcriptionEnabled = input.transcriptionEnabled === true;
  const retentionDays = Math.max(1, Math.min(365, Math.trunc(input.retentionDays ?? 30)));
  const consentNotice = normalizeNullable(input.consentNotice);
  if ((recordingEnabled || transcriptionEnabled) && consentNotice === null) {
    throw new Error("Recording or transcription requires a pre-join consent notice.");
  }

  return {
    recording_enabled: recordingEnabled,
    transcription_enabled: transcriptionEnabled,
    metadata: {
      ...readMetadata(input.existingMetadata),
      recording_notice: consentNotice,
      retention_policy_days: recordingEnabled || transcriptionEnabled ? retentionDays : 0,
      automated_transcript_label: "automated",
      transcript_edit_policy: "audit_history",
      report_delete_controls: recordingEnabled || transcriptionEnabled,
      recording_settings_changed_at: (input.now ?? new Date()).toISOString(),
    },
  };
}

export function buildVoiceParticipantUpsertRow(input: {
  roomId: string;
  userId: string;
  role?: VoiceParticipantRole;
  pushToTalkEnabled?: boolean;
  deafen?: boolean;
  consent?: ConsentDecision;
  now?: Date;
}): VoiceParticipantUpsertRow {
  const roomId = normalizeText(input.roomId);
  const userId = normalizeText(input.userId);
  if (!roomId || !userId) {
    throw new Error("Voice room and user are required.");
  }
  const now = input.now ?? new Date();
  const joinedAt = now.toISOString();
  return {
    voice_room_id: roomId,
    user_id: userId,
    participant_role: VOICE_PARTICIPANT_ROLES.includes(input.role as VoiceParticipantRole)
      ? (input.role as VoiceParticipantRole)
      : "speaker",
    joined_at: joinedAt,
    left_at: null,
    muted_at: null,
    banned_at: null,
    deafen_at: input.deafen === true ? joinedAt : null,
    push_to_talk_enabled: input.pushToTalkEnabled === true,
    cooldown_until: null,
    metadata: {
      consent_required: input.consent?.required === true,
      recording_consent_at:
        input.consent?.required === true && !input.consent.missing.includes("recording")
          ? joinedAt
          : null,
      transcription_consent_at:
        input.consent?.required === true && !input.consent.missing.includes("transcription")
          ? joinedAt
          : null,
    },
  };
}

export function buildVoiceRoomControlPatch(input: {
  action: "lock" | "unlock" | "anti_raid_lock" | "enable_screen_share" | "disable_screen_share";
  existingMetadata?: unknown;
  actorId: string;
  reason?: string | null;
  previousVisibility?: VoiceVisibility | string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const at = now.toISOString();
  const metadata = {
    ...readMetadata(input.existingMetadata),
    last_control: {
      action: input.action,
      actor_id: input.actorId,
      reason: normalizeNullable(input.reason),
      at,
      audio_recorded: false,
    },
  };

  if (input.action === "lock") {
    return { locked_at: at, metadata };
  }
  if (input.action === "unlock") {
    return { locked_at: null, metadata };
  }
  if (input.action === "anti_raid_lock") {
    return {
      visibility: "private" as const,
      locked_at: at,
      metadata: {
        ...metadata,
        anti_raid: {
          changed_at: at,
          previous_visibility: normalizeNullable(input.previousVisibility) ?? "unknown",
          reason: normalizeNullable(input.reason),
          audio_recorded: false,
        },
      },
    };
  }
  if (input.action === "enable_screen_share") {
    return { screen_share_enabled: true, metadata };
  }
  return { screen_share_enabled: false, metadata };
}

export function buildVoiceParticipantControlPatch(input: {
  action:
    | "mute"
    | "unmute"
    | "deafen"
    | "undeafen"
    | "push_to_talk_on"
    | "push_to_talk_off"
    | "kick"
    | "ban"
    | "cooldown";
  existingMetadata?: unknown;
  actorId: string;
  cooldownSeconds?: number;
  reason?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const at = now.toISOString();
  const metadata = {
    ...readMetadata(input.existingMetadata),
    last_control: {
      action: input.action,
      actor_id: input.actorId,
      reason: normalizeNullable(input.reason),
      at,
      audio_recorded: false,
    },
  };

  if (input.action === "mute") {
    return { muted_at: at, metadata };
  }
  if (input.action === "unmute") {
    return { muted_at: null, metadata };
  }
  if (input.action === "deafen") {
    return { deafen_at: at, metadata };
  }
  if (input.action === "undeafen") {
    return { deafen_at: null, metadata };
  }
  if (input.action === "push_to_talk_on") {
    return { push_to_talk_enabled: true, metadata };
  }
  if (input.action === "push_to_talk_off") {
    return { push_to_talk_enabled: false, metadata };
  }
  if (input.action === "kick") {
    return { left_at: at, metadata: { ...metadata, kicked_at: at } };
  }
  if (input.action === "ban") {
    return { banned_at: at, left_at: at, metadata };
  }
  const cooldownSeconds = Math.max(60, Math.min(24 * 60 * 60, input.cooldownSeconds ?? 10 * 60));
  return {
    cooldown_until: new Date(now.getTime() + cooldownSeconds * 1000).toISOString(),
    metadata,
  };
}

export function buildLiveKitAccessClaims(input: {
  apiKey: string;
  roomName: string;
  userId: string;
  displayName?: string | null;
  role: VoiceParticipantRole;
  canPublish: boolean;
  canSubscribe: boolean;
  canShareScreen: boolean;
  canRecord: boolean;
  now?: Date;
  ttlSeconds?: number;
  metadata?: Record<string, unknown>;
}): LiveKitAccessClaims {
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const role = VOICE_PARTICIPANT_ROLES.includes(input.role) ? input.role : "speaker";
  return {
    iss: input.apiKey,
    sub: input.userId,
    nbf: nowSeconds - 5,
    exp: nowSeconds + Math.max(60, Math.min(60 * 60, input.ttlSeconds ?? 10 * 60)),
    ...(normalizeNullable(input.displayName)
      ? { name: normalizeNullable(input.displayName) ?? "" }
      : {}),
    video: {
      roomJoin: true,
      room: input.roomName,
      canPublish: input.canPublish,
      canSubscribe: input.canSubscribe,
      canPublishData: true,
      canUpdateOwnMetadata: true,
      roomAdmin: role === "host" || role === "moderator",
      roomRecord: input.canRecord,
      canPublishSources: input.canShareScreen
        ? ["microphone", "camera", "screen_share", "screen_share_audio"]
        : ["microphone", "camera"],
    },
    metadata: JSON.stringify({
      role,
      ...input.metadata,
    }),
  };
}

function evaluateWindowLimit(input: {
  timestamps: readonly (string | Date)[];
  now?: Date;
  limit: number;
  windowSeconds: number;
}): RateLimitDecision {
  const now = input.now ?? new Date();
  const windowMs = input.windowSeconds * 1000;
  const relevant = input.timestamps
    .map((timestamp) => new Date(timestamp).getTime())
    .filter((timestamp) => Number.isFinite(timestamp) && now.getTime() - timestamp < windowMs)
    .sort((a, b) => a - b);
  if (relevant.length < input.limit) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      limit: input.limit,
      windowSeconds: input.windowSeconds,
    };
  }
  const oldest = relevant[0] ?? now.getTime();
  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((oldest + windowMs - now.getTime()) / 1000),
    limit: input.limit,
    windowSeconds: input.windowSeconds,
  };
}

function readMetadata(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullable(value: unknown): string | null {
  const text = normalizeText(value);
  return text ? text : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
