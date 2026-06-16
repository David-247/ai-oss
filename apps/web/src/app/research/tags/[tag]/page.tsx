import { RouteShellPage } from "@/components/route-shell";

type TagRouteContext = {
  params: Promise<{ tag: string }>;
};

export async function generateMetadata({ params }: TagRouteContext) {
  const { tag } = await params;
  return {
    title: `${tag} research | AI-OSS.net`,
  };
}

export default async function ResearchTagPage({ params }: TagRouteContext) {
  const { tag } = await params;

  return (
    <RouteShellPage
      specKey="research"
      eyebrow="Research tag"
      title={tag.replaceAll("-", " ")}
      summary="Tag pages collect related papers, discussions, replication requests, reviews, and active zones."
      detail={`Current tag: ${tag}.`}
    />
  );
}
