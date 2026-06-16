import { RouteShellPage } from "@/components/route-shell";

export const metadata = {
  title: "Research Tags | AI-OSS.net",
};

export default function ResearchTagsPage() {
  return (
    <RouteShellPage
      specKey="research"
      eyebrow="Research"
      title="Research tags"
      summary="Browse papers by methods, model families, benchmarks, safety topics, datasets, and implementation areas."
    />
  );
}
