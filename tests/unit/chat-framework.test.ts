import { describe, expect, it } from "vitest";
import {
  CHAT_ROOM_TYPES,
  assertAttachmentsScanned,
  buildChatMessageEditPatch,
  buildChatMessageInsertRow,
  buildChatRoomInsertRow,
  buildDeletedMessagePatch,
  buildRealtimeChannelGrant,
  evaluateSlowMode,
  previewAutomod,
} from "@ai-oss/chat";

describe("Phase 10 chat framework", () => {
  it("builds every required room type with safe defaults", () => {
    for (const roomType of CHAT_ROOM_TYPES) {
      const row = buildChatRoomInsertRow({
        title: `${roomType} room`,
        createdBy: "user-1",
        roomType,
        zoneId: roomType === "private" || roomType === "temporary" ? null : "zone-1",
      });

      expect(row.room_type).toBe(roomType);
      expect(row.created_by).toBe("user-1");
      if (roomType === "private") {
        expect(row.is_private).toBe(true);
        expect(row.visibility).toBe("private");
      }
    }
  });

  it("builds markdown-lite messages with mentions, code, and attachments", () => {
    const row = buildChatMessageInsertRow({
      roomId: "room-1",
      authorId: "user-1",
      body: ["Ping @ada", "", "```ts", "export const ok = true;", "```"].join("\n"),
      attachmentFileIds: ["file-1", "file-1", "file-2"],
    });

    expect(row.markdown).toMatchObject({
      source_format: "markdown-lite",
      code_block_count: 1,
      mentions: ["ada"],
    });
    expect(row.attachment_file_ids).toEqual(["file-1", "file-2"]);
  });

  it("retains message edit history and supports deletion patches", () => {
    const edit = buildChatMessageEditPatch({
      previousBody: "old message",
      newBody: "new message",
      editorId: "user-1",
      now: new Date("2026-06-12T00:00:00.000Z"),
    });

    expect(edit).toMatchObject({
      body: "new message",
      status: "edited",
      edit_history: [
        {
          edited_at: "2026-06-12T00:00:00.000Z",
          edited_by: "user-1",
          previous_body: "old message",
        },
      ],
    });
    expect(buildDeletedMessagePatch()).toMatchObject({ body: "[deleted]", status: "deleted" });
    expect(buildDeletedMessagePatch({ moderator: true })).toMatchObject({
      body: "[removed]",
      moderation_status: "removed",
    });
  });

  it("enforces slow mode and previews automod signals", () => {
    expect(
      evaluateSlowMode({
        slowModeSeconds: 30,
        lastMessageAt: "2026-06-12T00:00:10.000Z",
        now: new Date("2026-06-12T00:00:20.000Z"),
      }),
    ).toMatchObject({
      allowed: false,
      retryAfterSeconds: 20,
    });

    expect(
      previewAutomod(
        "https://a.test https://b.test https://c.test https://d.test https://e.test https://f.test",
      ),
    ).toMatchObject({
      action: "report",
      reasons: ["many_links"],
    });
  });

  it("requires clean attachments and builds expiring realtime grants", () => {
    expect(() =>
      assertAttachmentsScanned([
        { scan_status: "clean", moderation_status: "approved" },
        { scan_status: "suspicious", moderation_status: "quarantined" },
      ]),
    ).toThrow(/clean and approved/i);

    expect(
      buildRealtimeChannelGrant({
        roomId: "room-1",
        userId: "user-1",
        canRead: true,
        canWrite: true,
        canModerate: false,
        now: new Date("2026-06-12T00:00:00.000Z"),
      }),
    ).toMatchObject({
      channel: "room:room-1",
      presenceKey: "room-1:user-1",
      transport: "supabase_realtime",
      expiresAt: "2026-06-12T00:15:00.000Z",
    });
  });
});
