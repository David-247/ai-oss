-- Security hardening: relocate extensions out of the public (API-exposed) schema.
--
-- The Supabase database linter (lint 0014 extension_in_public) flagged citext
-- and vector as installed in `public`. Keeping extensions in public mixes their
-- objects into the PostgREST-exposed API surface and risks name collisions.
--
-- The `extensions` schema already exists and is part of the database/role
-- search_path ("$user", public, extensions), so unqualified references to the
-- citext and vector types continue to resolve after the move. The dependent
-- columns and indexes reference the types/operator classes by OID, so existing
-- objects (profiles.username, zones.slug, zone_wiki_pages.slug,
-- paper_authors.author_slug :: citext; search_documents.embedding :: vector and
-- its vector index) are unaffected.

alter extension citext set schema extensions;
alter extension vector set schema extensions;
