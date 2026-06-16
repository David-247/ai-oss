-- Phase 01 seed data: system roles and default permission catalogs.

insert into public.roles (role_key, name, description, role_type, permissions, system_role)
values
  (
    'owner',
    'Owner',
    'Emergency owner role with full platform authority. Assignment is high-risk and audited in Phase 04.',
    'global',
    array['*.*'],
    true
  ),
  (
    'super_admin',
    'Super Admin',
    'Full operational administration except owner emergency semantics.',
    'global',
    array['*.*'],
    true
  ),
  (
    'trust_safety_admin',
    'Trust & Safety Admin',
    'Moderation, anti-abuse, and trust operations.',
    'global',
    array[
      'users.read', 'users.suspend', 'users.ban',
      'content.read', 'content.update', 'content.remove',
      'search.read',
      'moderation.read', 'moderation.update', 'moderation.automod_manage',
      'security.read', 'audit.read'
    ],
    true
  ),
  (
    'legal_admin',
    'Legal Admin',
    'Legal requests, takedowns, legal holds, and related audit review.',
    'global',
    array[
      'users.read', 'content.read', 'research.read',
      'legal.read', 'legal.update', 'audit.read'
    ],
    true
  ),
  (
    'privacy_admin_dpo',
    'Privacy Admin / DPO',
    'Privacy exports, deletion workflows, and data-subject request handling.',
    'global',
    array[
      'users.read', 'users.export', 'users.delete_or_anonymize',
      'privacy.read', 'privacy.update', 'audit.read'
    ],
    true
  ),
  (
    'security_admin',
    'Security Admin',
    'Security event review, WAF/security controls, and abuse investigation.',
    'global',
    array[
      'users.read', 'security.read', 'security.update',
      'audit.read', 'audit.export', 'system.settings_read'
    ],
    true
  ),
  (
    'finance_admin',
    'Finance Admin',
    'Donation/payment accounting, refunds, chargebacks, and finance exports.',
    'global',
    array[
      'finance.read', 'finance.update', 'finance.export',
      'audit.read'
    ],
    true
  ),
  (
    'support_admin',
    'Support Admin',
    'User support with restricted account access and no default impersonation.',
    'global',
    array[
      'users.read', 'users.update_basic',
      'content.read', 'support.read', 'audit.read'
    ],
    true
  ),
  (
    'research_admin',
    'Research Admin',
    'Research archive metadata, publishing operations, and safety routing.',
    'global',
    array[
      'research.read', 'research.update',
      'content.read', 'search.read', 'moderation.read', 'audit.read'
    ],
    true
  ),
  (
    'zone_admin',
    'Zone Admin',
    'Default global template for zone administration permissions.',
    'global',
    array[
      'zones.read', 'zones.update', 'zones.members.update',
      'zones.settings_update', 'zones.governance_read',
      'zones.governance_update', 'content.read', 'content.update',
      'search.read',
      'moderation.read'
    ],
    true
  ),
  (
    'read_only_auditor',
    'Read-only Auditor',
    'Read-only audit and operational visibility.',
    'global',
    array[
      'users.read', 'zones.read', 'content.read', 'research.read',
      'search.read',
      'moderation.read', 'legal.read', 'privacy.read',
      'security.read', 'finance.read', 'audit.read'
    ],
    true
  )
on conflict (role_key) do update
set
  name = excluded.name,
  description = excluded.description,
  role_type = excluded.role_type,
  permissions = excluded.permissions,
  system_role = excluded.system_role,
  updated_at = now();
