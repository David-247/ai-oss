export const PACKAGE_NAME = "@ai-oss/chat" as const;

export const CHAT_ROOM_TYPES = [
  "zone_general",
  "zone_project",
  "paper_discussion",
  "post_linked",
  "moderator",
  "admin_security",
  "temporary",
  "private",
] as const;

export type ChatRoomType = (typeof CHAT_ROOM_TYPES)[number];

export const CHAT_VISIBILITIES = ["public", "zone", "private", "moderator", "admin"] as const;
export type ChatVisibility = (typeof CHAT_VISIBILITIES)[number];

export const CHAT_MEMBER_ROLES = ["member", "moderator", "admin"] as const;
export type ChatMemberRole = (typeof CHAT_MEMBER_ROLES)[number];

export const CHAT_MEMBER_STATUSES = [
  "invited",
  "active",
  "muted",
  "kicked",
  "banned",
  "left",
] as const;
export type ChatMemberStatus = (typeof CHAT_MEMBER_STATUSES)[number];

export interface ChatRoomInput {
  title: string;
  createdBy: string;
  roomType?: ChatRoomType;
  visibility?: ChatVisibility;
  zoneId?: string | null;
  linkedPostId?: string | null;
  linkedPaperId?: string | null;
  description?: string | null;
  slowModeSeconds?: number;
  rules?: string | null;
}

export interface ChatRoomInsertRow {
  zone_id: string | null;
  room_type: ChatRoomType;
  title: string;
  description: string | null;
  visibility: ChatVisibility;
  is_private: boolean;
  created_by: string;
  linked_post_id: string | null;
  linked_paper_id: string | null;
  slow_mode_seconds: number;
  rules: string | null;
}

export interface ChatMessageInput {
  roomId: string;
  authorId: string;
  body: string;
  parentMessageId?: string | null;
  attachmentFileIds?: readonly string[];
}

export interface ChatMessageInsertRow {
  room_id: string;
  author_id: string;
  parent_message_id: string | null;
  body: string;
  markdown: Record<string, unknown>;
  attachment_file_ids: string[];
  edit_history: [];
  status: "published";
  moderation_status: "clear" | "flagged" | "quarantined" | "removed";
}

export interface ChatMessageEditEntry {
  edited_at: string;
  edited_by: string;
  previous_body: string;
  reason?: string;
}

export interface RealtimeChannelGrant {
  channel: string;
  roomId: string;
  userId: string;
  presenceKey: string;
  canRead: boolean;
  canWrite: boolean;
  canModerate: boolean;
  expiresAt: string;
  transport: "supabase_realtime";
}

export interface SlowModeDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  reason?: "slow_mode";
}

export interface AutomodPreview {
  action: "allow" | "report" | "quarantine";
  reasons: string[];
  linkCount: number;
  repeatedWhitespace: boolean;
}

export function parseChatRoomType(value: unknown): ChatRoomType {
  return CHAT_ROOM_TYPES.includes(value as ChatRoomType) ? (value as ChatRoomType) : "zone_general";
}

export function parseChatVisibility(value: unknown, roomType: ChatRoomType): ChatVisibility {
  if (CHAT_VISIBILITIES.includes(value as ChatVisibility)) {
    return value as ChatVisibility;
  }
  if (roomType === "private") {
    return "private";
  }
  if (roomType === "moderator") {
    return "moderator";
  }
  if (roomType === "admin_security") {
    return "admin";
  }
  return "zone";
}

export function buildChatRoomInsertRow(input: ChatRoomInput): ChatRoomInsertRow {
  const roomType = parseChatRoomType(input.roomType);
  const visibility = parseChatVisibility(input.visibility, roomType);
  const title = normalizeText(input.title);
  if (title.length < 3 || title.length > 120) {
    throw new Error("Chat room title length is invalid.");
  }
  if (!normalizeText(input.createdBy)) {
    throw new Error("Chat room creator is required.");
  }

  return {
    zone_id: normalizeNullable(input.zoneId),
    room_type: roomType,
    title,
    description: normalizeNullable(input.description),
    visibility,
    is_private: visibility === "private" || roomType === "private",
    created_by: input.createdBy,
    linked_post_id: normalizeNullable(input.linkedPostId),
    linked_paper_id: normalizeNullable(input.linkedPaperId),
    slow_mode_seconds: Math.max(0, Math.trunc(input.slowModeSeconds ?? 0)),
    rules: normalizeNullable(input.rules),
  };
}

export function buildRoomMemberRow(input: {
  roomId: string;
  userId: string;
  role?: ChatMemberRole;
  status?: ChatMemberStatus;
}) {
  if (!normalizeText(input.roomId) || !normalizeText(input.userId)) {
    throw new Error("Room and user are required.");
  }
  return {
    room_id: input.roomId,
    user_id: input.userId,
    member_role: CHAT_MEMBER_ROLES.includes(input.role as ChatMemberRole) ? input.role : "member",
    status: CHAT_MEMBER_STATUSES.includes(input.status as ChatMemberStatus)
      ? input.status
      : "active",
  };
}

export function analyzeChatMarkdown(body: string) {
  const codeBlockCount = Array.from(body.matchAll(/```/g)).length >> 1;
  const linkCount = Array.from(body.matchAll(/https?:\/\/\S+/g)).length;
  const mentions = Array.from(body.matchAll(/(^|[^\w])@([a-zA-Z0-9_][a-zA-Z0-9_-]{1,38})/g))
    .map((match) => match[2])
    .filter((mention): mention is string => typeof mention === "string")
    .map((mention) => mention.toLowerCase());
  return {
    source_format: "markdown-lite",
    code_block_count: codeBlockCount,
    link_count: linkCount,
    mentions: Array.from(new Set(mentions)).slice(0, 25),
  };
}

export function buildChatMessageInsertRow(input: ChatMessageInput): ChatMessageInsertRow {
  const body = normalizeText(input.body);
  if (!normalizeText(input.roomId) || !normalizeText(input.authorId)) {
    throw new Error("Room and author are required.");
  }
  if (body.length === 0 || body.length > 8000) {
    throw new Error("Chat message body length is invalid.");
  }
  return {
    room_id: input.roomId,
    author_id: input.authorId,
    parent_message_id: normalizeNullable(input.parentMessageId),
    body,
    markdown: analyzeChatMarkdown(body),
    attachment_file_ids: Array.from(new Set(input.attachmentFileIds ?? [])),
    edit_history: [],
    status: "published",
    moderation_status: "clear",
  };
}

export function buildChatMessageEditPatch(input: {
  previousBody: string;
  previousEditHistory?: unknown;
  newBody: string;
  editorId: string;
  reason?: string;
  now?: Date;
}) {
  const body = normalizeText(input.newBody);
  if (body.length === 0 || body.length > 8000) {
    throw new Error("Chat message body length is invalid.");
  }
  const entry: ChatMessageEditEntry = {
    edited_at: (input.now ?? new Date()).toISOString(),
    edited_by: input.editorId,
    previous_body: input.previousBody,
    ...(normalizeText(input.reason) ? { reason: normalizeText(input.reason) } : {}),
  };
  return {
    body,
    markdown: { ...analyzeChatMarkdown(body), edited: true },
    edit_history: [...readEditHistory(input.previousEditHistory), entry].slice(-50),
    status: "edited",
  };
}

export function buildDeletedMessagePatch(input: { moderator?: boolean; now?: Date } = {}) {
  return {
    body: input.moderator === true ? "[removed]" : "[deleted]",
    status: input.moderator === true ? "removed" : "deleted",
    moderation_status: input.moderator === true ? "removed" : "clear",
    deleted_at: (input.now ?? new Date()).toISOString(),
  };
}

export function evaluateSlowMode(input: {
  slowModeSeconds: number;
  lastMessageAt?: string | Date | null;
  now?: Date;
}): SlowModeDecision {
  if (
    input.slowModeSeconds <= 0 ||
    input.lastMessageAt === null ||
    input.lastMessageAt === undefined
  ) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const now = input.now ?? new Date();
  const elapsedSeconds = Math.floor(
    (now.getTime() - new Date(input.lastMessageAt).getTime()) / 1000,
  );
  const retryAfterSeconds = Math.max(0, input.slowModeSeconds - elapsedSeconds);
  return retryAfterSeconds === 0
    ? { allowed: true, retryAfterSeconds: 0 }
    : { allowed: false, retryAfterSeconds, reason: "slow_mode" };
}

export function previewAutomod(body: string): AutomodPreview {
  const analysis = analyzeChatMarkdown(body);
  const reasons: string[] = [];
  if (analysis.link_count > 5) {
    reasons.push("many_links");
  }
  const repeatedWhitespace = /\s{20,}/.test(body);
  if (repeatedWhitespace) {
    reasons.push("repeated_whitespace");
  }
  return {
    action: reasons.length > 1 ? "quarantine" : reasons.length === 1 ? "report" : "allow",
    reasons,
    linkCount: analysis.link_count,
    repeatedWhitespace,
  };
}

export function buildRealtimeChannelGrant(input: {
  roomId: string;
  userId: string;
  canRead: boolean;
  canWrite: boolean;
  canModerate: boolean;
  now?: Date;
}): RealtimeChannelGrant {
  const now = input.now ?? new Date();
  return {
    channel: `room:${input.roomId}`,
    roomId: input.roomId,
    userId: input.userId,
    presenceKey: `${input.roomId}:${input.userId}`,
    canRead: input.canRead,
    canWrite: input.canWrite,
    canModerate: input.canModerate,
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    transport: "supabase_realtime",
  };
}

export function assertAttachmentsScanned(
  files: readonly { scan_status?: string; moderation_status?: string }[],
) {
  const unsafe = files.filter(
    (file) => file.scan_status !== "clean" || file.moderation_status !== "approved",
  );
  if (unsafe.length > 0) {
    throw new Error("Chat attachments must be clean and approved before sending.");
  }
}

function readEditHistory(value: unknown): ChatMessageEditEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const editedAt = typeof entry.edited_at === "string" ? entry.edited_at : null;
    const editedBy = typeof entry.edited_by === "string" ? entry.edited_by : null;
    const previousBody = typeof entry.previous_body === "string" ? entry.previous_body : null;
    if (editedAt === null || editedBy === null || previousBody === null) {
      return [];
    }
    return [
      {
        edited_at: editedAt,
        edited_by: editedBy,
        previous_body: previousBody,
        ...(typeof entry.reason === "string" ? { reason: entry.reason } : {}),
      },
    ];
  });
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullable(value: unknown): string | null {
  const text = normalizeText(value);
  return text ? text : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
