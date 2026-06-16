import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase 10 chat privacy and realtime boundaries", () => {
  it("exposes the required chat API route files", () => {
    const root = resolve("..");
    for (const file of [
      "apps/web/src/app/api/chat/route.ts",
      "apps/web/src/app/api/chat/rooms/route.ts",
      "apps/web/src/app/api/chat/rooms/[roomId]/route.ts",
      "apps/web/src/app/api/chat/messages/route.ts",
      "apps/web/src/app/api/chat/token/route.ts",
    ]) {
      expect(existsSync(resolve(root, file)), `${file} should exist`).toBe(true);
    }
  });

  it("keeps chat authorization on Supabase Realtime instead of a Vercel socket server", () => {
    const root = resolve("..");
    const tokenRoute = readFileSync(
      resolve(root, "apps/web/src/app/api/chat/token/route.ts"),
      "utf8",
    );

    expect(tokenRoute).toContain("buildRealtimeChannelGrant");
    expect(tokenRoute).toContain("chat-channel-denied");
    expect(tokenRoute).toContain("longLivedVercelSocketServer: false");
    expect(tokenRoute).toContain("membership-gated");
  });

  it("requires audited admin reasons for private room reads", () => {
    const root = resolve("..");
    const messagesRoute = readFileSync(
      resolve(root, "apps/web/src/app/api/chat/messages/route.ts"),
      "utf8",
    );
    const serverHelper = readFileSync(resolve(root, "apps/web/src/lib/chat-server.ts"), "utf8");

    expect(messagesRoute).toContain("requireAuditedPrivateRoomRead");
    expect(serverHelper).toContain("private-chat-reason-required");
    expect(serverHelper).toContain("chat.private_read");
    expect(serverHelper).toContain("insertAuditEvent");
  });

  it("asserts chat RLS uses room membership authorization", () => {
    const root = resolve("..");
    const rls = readFileSync(
      resolve(root, "supabase/migrations/20260612010200_phase01_rls.sql"),
      "utf8",
    );
    const schema = readFileSync(
      resolve(root, "supabase/migrations/20260612010100_phase01_schema.sql"),
      "utf8",
    );

    expect(schema).toContain("create table public.chat_room_members");
    expect(rls).toContain("public.can_read_chat_room(room_id)");
    expect(rls).toContain("chat_messages_insert_room_members");
    expect(rls).toContain("chat_rooms_read_authorized");
  });
});
