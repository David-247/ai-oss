import { RouteShellPage } from "@/components/route-shell";

export const metadata = {
  title: "Research Authors | AI-OSS.net",
};

export default function ResearchAuthorsPage() {
  return (
    <RouteShellPage
      specKey="research"
      eyebrow="Research"
      title="Authors"
      summary="Author pages group papers, affiliations, ORCID links, review history, replication activity, and public profile controls."
    />
  );
}
