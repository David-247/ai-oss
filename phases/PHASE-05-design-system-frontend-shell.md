# Phase 05 — Design System, Frontend Shell, Navigation & Accessibility

**Source sections:** §5.2 Route Structure, §6 Frontend and Design System (6.1–6.4); supports REQ-CORE-003.

## Objectives

Deliver the design system, responsive app shell, navigation, and the full public/authenticated route skeleton, meeting WCAG 2.2 AA from the first build. Feature phases mount their pages into this shell.

## Dependencies
- Phase 00 (Next.js app, `packages/design-system`), Phase 03 (auth-aware nav state). Authorization-aware nav uses Phase 04.

## In scope

### Frontend stack (§6.1)
- Next.js App Router; React; TypeScript; Tailwind CSS; **shadcn/ui + Radix** primitives (or equivalent accessible primitives); Lucide (or equivalent) icons; **MDX/Markdown rendering with sanitization**; code highlighting for snippets; **PDF rendering** for papers; responsive layouts from first build.

### Design direction (§6.2)
- Modern, clean, research-oriented; white/neutral default theme **with dark mode**; clear typography; dense-but-readable research pages; Reddit/HN-familiar forum interactions; low-friction creation flows; strong moderation affordances that aren't punitive in feel; mobile-first navigation for core actions.

### Responsive behavior (§6.3)
- **Desktop:** left nav for global sections; right sidebar for context/tags/rules/related papers/active rooms; multi-column research pages; admin panels with data tables, filters, keyboard shortcuts.
- **Mobile:** bottom nav (Home, Search, Research, Zones, Account); collapsible zone sidebar; single-column reading; sticky voting/comment controls; touch-friendly moderation; mobile-optimized voice controls.

### Accessibility (§6.4) — WCAG 2.2 AA launch requirement
- Keyboard navigation; visible focus states; semantic landmarks; accessible forms; sufficient contrast; screen-reader-friendly vote buttons, moderation controls, chat messages; captions/transcripts only when recording/transcription enabled+consented; reduced-motion support; text resizing without layout breakage.

### Route skeleton (§5.2)
Scaffold all routes as shell pages (feature phases fill content):
- Account group (`/account/*` → Phase 03).
- Zones group (`/z`, `/z/new`, `/z/[zoneSlug]/...` incl. rules, wiki, chat, voice, moderation, modmail, settings, governance → Phases 07/08/10/11/13/15).
- Research group (`/research`, `/research/submit`, `/research/[paperId]/...` incl. v/[version], comments, reviews, replications, edit, withdraw, tags, authors → Phase 09).
- `/search`, `/notifications`, `/messages`, `/donate`.
- Legal group (`/legal`, privacy, terms, cookies, dmca, community-guidelines, research-policy, moderator-code, transparency, dsa, online-safety → Phase 18).
- Admin group (`/admin/...` all subpages → Phase 16).

## Out of scope (deferred)
- Page-specific business logic → owning feature phases. Markdown sanitization *security policy* depth → Phase 19 (this phase wires the sanitizer; Phase 19 hardens CSP/XSS).

## Routes / APIs
All §5.2 pages as shell/placeholder routes with correct layout, nav, and auth-awareness.

## Work items
1. Build `packages/design-system`: Tailwind config, theme tokens (light/dark), shadcn/Radix component wrappers, icon set, typography scale.
2. Implement responsive app shell: desktop left-nav + right-sidebar, mobile bottom-nav + collapsible sidebar.
3. Implement sanitized Markdown/MDX renderer, code highlighter, PDF viewer component.
4. Implement dark mode toggle + reduced-motion handling + text-resize resilience.
5. Scaffold every §5.2 route with layout, breadcrumbs, and auth/permission-aware nav gating (hints only; real checks server-side per Phase 04).
6. Establish accessibility baseline + automated a11y checks in CI.

## Acceptance criteria
- App renders correctly on desktop, tablet, mobile (REQ-CORE-003) with the §6.3 layouts.
- Dark mode works; theme tokens consistent.
- Markdown is sanitized (no raw user HTML); code + PDF rendering work.
- Automated + manual a11y checks pass WCAG 2.2 AA on shell pages (keyboard, focus, contrast, landmarks, reduced motion, text resize).
- All §5.2 routes exist as navigable shells.

## Tests (§27.3, §27.4 partial)
- E2E: navigation across desktop + mobile shells.
- A11y: automated axe checks in CI; keyboard-only traversal of core nav.
- Security (handoff to Phase 19): Markdown sanitizer rejects script injection.

## Requirement traceability
REQ-CORE-003, -004; §5.2, §6; agent rule §29 (#10 tests).
