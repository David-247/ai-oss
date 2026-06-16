import { RouteShellPage } from "@/components/route-shell";

type AuthorRouteContext = {
  params: Promise<{ authorId: string }>;
};

export async function generateMetadata({ params }: AuthorRouteContext) {
  const { authorId } = await params;
  return {
    title: `${authorId} author profile | AI-OSS.net`,
  };
}

export default async function ResearchAuthorPage({ params }: AuthorRouteContext) {
  const { authorId } = await params;

  return (
    <RouteShellPage
      specKey="research"
      eyebrow="Research author"
      title={authorId.replaceAll("-", " ")}
      summary="Author profiles connect published versions, reviews, replication reports, zones, and public account metadata."
      detail={`Current author: ${authorId}.`}
    />
  );
}
