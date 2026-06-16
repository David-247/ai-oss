import { RouteShellPage } from "@/components/route-shell";

export const metadata = {
  title: "Submit Research | AI-OSS.net",
};

export default function SubmitResearchPage() {
  return (
    <RouteShellPage
      specKey="research"
      eyebrow="Research"
      title="Submit paper"
      summary="Create a versioned paper record with authors, abstract, tags, PDF, artifacts, review preference, and safety disclosures."
      detail="Submission uses accessible form sections, draft autosave, PDF upload, artifact links, and policy acknowledgement."
    />
  );
}
