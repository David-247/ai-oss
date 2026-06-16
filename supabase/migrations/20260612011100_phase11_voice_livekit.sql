-- Phase 11 — Voice / VoIP rooms
-- Adds LiveKit room identifiers and participant state required by §12 while
-- preserving the Phase 01 default of no recording/transcription.

alter table public.voice_rooms
  add column if not exists room_type text not null default 'zone'
    check (room_type in ('zone', 'paper_review', 'event_seminar', 'moderator', 'temporary_invite')),
  add column if not exists livekit_room_name text,
  add column if not exists locked_at timestamptz,
  add column if not exists waiting_room_enabled boolean not null default false,
  add column if not exists screen_share_enabled boolean not null default false;

update public.voice_rooms
set livekit_room_name = concat('voice-', id::text)
where livekit_room_name is null;

alter table public.voice_rooms
  alter column livekit_room_name set not null;

create unique index if not exists voice_rooms_livekit_room_name_idx
on public.voice_rooms (livekit_room_name);

create index if not exists voice_rooms_type_idx
on public.voice_rooms (room_type, visibility, is_active);

alter table public.voice_participants
  add column if not exists deafen_at timestamptz,
  add column if not exists push_to_talk_enabled boolean not null default false,
  add column if not exists cooldown_until timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists voice_participants_room_status_idx
on public.voice_participants (voice_room_id, banned_at, left_at);
