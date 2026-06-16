import type { SupabaseClient } from "@ai-oss/auth";
import type {
  ResearchAuthorInput,
  ResearchLinkInput,
  ResearchSubmissionInput,
} from "@ai-oss/research";
import { buildAiMetadata } from "@ai-oss/compliance";
import { problem } from "@/lib/auth-server";
import { isRecord, loadZoneAccess, readString, readStringArray } from "@/lib/discussions-server";

type SupabaseServiceClient = SupabaseClient;

export async function loadPaperAccess(
  client: SupabaseServiceClient,
  paperIdOrIdentifier: string,
  userId: string | null,
) {
  const byId = await client.from("papers").select("*").eq("id", paperIdOrIdentifier).maybeSingle();
  if (byId.error !== null) {
    return { ok: false as const, response: problem(400, "paper-read-failed", byId.error.message) };
  }

  let paper = byId.data;
  if (paper === null) {
    const byIdentifier = await client
      .from("papers")
      .select("*")
      .eq("identifier", paperIdOrIdentifier)
      .maybeSingle();
    if (byIdentifier.error !== null) {
      return {
        ok: false as const,
        response: problem(400, "paper-read-failed", byIdentifier.error.message),
      };
    }
    paper = byIdentifier.data;
  }

  if (paper === null || paper.deleted_at !== null) {
    return {
      ok: false as const,
      response: problem(404, "paper-not-found", "Paper does not exist."),
    };
  }

  const submitterOwnsPaper = userId !== null && paper.submitter_id === userId;
  const isPublic = ["published", "withdrawn", "superseded", "retracted", "redacted"].includes(
    String(paper.status),
  );

  return {
    ok: true as const,
    paper: paper as Record<string, unknown>,
    submitterOwnsPaper,
    canRead: isPublic || submitterOwnsPaper,
    canUpdate: submitterOwnsPaper && paper.legal_hold !== true,
  };
}

export async function latestVersionForPaper(client: SupabaseServiceClient, paperId: string) {
  const version = await client
    .from("paper_versions")
    .select("*")
    .eq("paper_id", paperId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (version.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "paper-version-read-failed", version.error.message),
    };
  }
  return { ok: true as const, version: version.data as Record<string, unknown> | null };
}

export async function nextMonthlyIdentifierSequence(
  client: SupabaseServiceClient,
  now = new Date(),
) {
  const prefix = `AIOSS:${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}.`;
  const existing = await client
    .from("papers")
    .select("identifier")
    .like("identifier", `${prefix}%`);
  if (existing.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "paper-identifiers-read-failed", existing.error.message),
    };
  }

  const maxSequence = (existing.data ?? []).reduce((max, row) => {
    const suffix = readString(row.identifier).replace(prefix, "");
    const parsed = Number(suffix);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);

  return { ok: true as const, sequence: maxSequence + 1 };
}

export function buildSubmissionInput(input: {
  body: Record<string, unknown>;
  submitterId: string;
  identifier: string;
}): ResearchSubmissionInput {
  return {
    submitterId: input.submitterId,
    identifier: input.identifier,
    title: readString(input.body.title),
    abstract: readString(input.body.abstract),
    authors: readAuthors(input.body.authors),
    submitterRelationship: readString(
      input.body.submitterRelationship ?? input.body.submitter_relationship,
    ),
    categories: readStringArray(input.body.categories),
    tags: readStringArray(input.body.tags),
    license: readString(input.body.license),
    fullText: readString(input.body.fullText ?? input.body.full_text) || null,
    fileHashes: Array.isArray(input.body.fileHashes ?? input.body.file_hashes)
      ? ((input.body.fileHashes ?? input.body.file_hashes) as Record<string, unknown>[])
      : [],
    safetyDisclosure: readString(input.body.safetyDisclosure ?? input.body.safety_disclosure),
    modelDataDisclosure: readString(
      input.body.modelDataDisclosure ?? input.body.model_data_disclosure,
    ),
    aiMetadata: buildAiMetadataFromBody(input.body),
    reproducibilityChecklist: readChecklist(
      input.body.reproducibilityChecklist ?? input.body.reproducibility_checklist,
    ),
    uploadRightsConfirmed:
      input.body.uploadRightsConfirmed === true || input.body.upload_rights_confirmed === true,
    notPeerReviewedAcknowledged:
      input.body.notPeerReviewedAcknowledged === true ||
      input.body.not_peer_reviewed_acknowledged === true,
    contactPreference: readContactPreference(
      input.body.contactPreference ?? input.body.contact_preference,
    ),
    conflicts: readString(input.body.conflicts) || null,
    links: readLinks(input.body.links),
    zoneId: readString(input.body.zoneId ?? input.body.zone_id) || null,
  };
}

function buildAiMetadataFromBody(body: Record<string, unknown>): Record<string, unknown> {
  const raw = body.aiMetadata ?? body.ai_metadata;
  if (isRecord(raw)) {
    return buildAiMetadata({
      modelProvider: raw.modelProvider ?? raw.model_provider,
      modelName: raw.modelName ?? raw.model_name,
      modelLicense: raw.modelLicense ?? raw.model_license,
      trainingDataSummary: raw.trainingDataSummary ?? raw.training_data_summary,
      intendedUse: raw.intendedUse ?? raw.intended_use,
      limitations: raw.limitations,
      evaluationResults: raw.evaluationResults ?? raw.evaluation_results,
      knownRisks: raw.knownRisks ?? raw.known_risks,
      responsibleDisclosureStatus:
        raw.responsibleDisclosureStatus ?? raw.responsible_disclosure_status,
      exportControlNoticeAccepted:
        raw.exportControlNoticeAccepted ?? raw.export_control_notice_accepted,
    });
  }

  return buildAiMetadata({
    modelProvider: body.modelProvider ?? body.model_provider,
    modelName: body.modelName ?? body.model_name,
    modelLicense: body.modelLicense ?? body.model_license,
    trainingDataSummary: body.trainingDataSummary ?? body.training_data_summary,
    intendedUse: body.intendedUse ?? body.intended_use,
    limitations: body.limitations,
    evaluationResults: body.evaluationResults ?? body.evaluation_results,
    knownRisks: body.knownRisks ?? body.known_risks,
    responsibleDisclosureStatus:
      body.responsibleDisclosureStatus ?? body.responsible_disclosure_status,
    exportControlNoticeAccepted:
      body.exportControlNoticeAccepted ?? body.export_control_notice_accepted,
  });
}

export async function ensureCanSubmitToZone(
  client: SupabaseServiceClient,
  zoneId: string | null,
  userId: string,
) {
  if (zoneId === null) {
    return { ok: true as const };
  }
  const access = await loadZoneAccess(client, zoneId, userId);
  if (!access.ok) {
    return access;
  }
  if (!access.access.canRead || access.access.memberIsMuted) {
    return {
      ok: false as const,
      response: problem(403, "research-zone-denied", "Research submission is not allowed here."),
    };
  }
  return { ok: true as const };
}

export { isRecord, readString, readStringArray };

function readAuthors(value: unknown): ResearchAuthorInput[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((author) => {
    if (!isRecord(author)) {
      return [];
    }
    return [
      {
        name: readString(author.name ?? author.author_name),
        profileId: readString(author.profileId ?? author.profile_id) || null,
        affiliation: readString(author.affiliation) || null,
        orcid: readString(author.orcid) || null,
        isSubmitter: author.isSubmitter === true || author.is_submitter === true,
        isCorresponding: author.isCorresponding === true || author.is_corresponding === true,
      },
    ];
  });
}

function readLinks(value: unknown): ResearchLinkInput[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((link) => {
    if (!isRecord(link)) {
      return [];
    }
    const type = readString(link.type ?? link.link_type);
    if (
      type !== "code" &&
      type !== "dataset" &&
      type !== "model" &&
      type !== "demo" &&
      type !== "arxiv" &&
      type !== "doi" &&
      type !== "other"
    ) {
      return [];
    }
    return [
      {
        type,
        url: readString(link.url),
        label: readString(link.label) || null,
      },
    ];
  });
}

function readChecklist(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readContactPreference(value: unknown): ResearchSubmissionInput["contactPreference"] {
  return value === "public_email" ||
    value === "profile" ||
    value === "platform_messages" ||
    value === "none"
    ? value
    : "platform_messages";
}
