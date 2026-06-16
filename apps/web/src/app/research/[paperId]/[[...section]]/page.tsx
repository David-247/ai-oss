import { RouteShellPage } from "@/components/route-shell";

type PaperRouteContext = {
  params: Promise<{
    paperId: string;
    section?: string[];
  }>;
};

export async function generateMetadata({ params }: PaperRouteContext) {
  const { paperId, section } = await params;
  const label = section?.join(" / ") || "overview";
  return {
    title: `${paperId} ${label} | AI-OSS.net`,
  };
}

export default async function PaperPage({ params }: PaperRouteContext) {
  const { paperId, section } = await params;
  const label = section?.join(" / ") || "overview";

  return (
    <RouteShellPage
      specKey="research"
      eyebrow={`Paper / ${paperId}`}
      title={paperTitle(label)}
      summary="Paper pages support the abstract, PDF, versions, comments, reviews, replications, editing, and withdrawal flows in one responsive reader layout."
      detail={`Current paper: ${paperId}. Current section: ${label}.`}
    />
  );
}

function paperTitle(section: string): string {
  if (section === "overview") {
    return "Paper overview";
  }
  if (section.startsWith("v/")) {
    return `Version ${section.replace("v/", "")}`;
  }
  return section
    .split("/")
    .map((part) => part.replaceAll("-", " "))
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" / ");
}
