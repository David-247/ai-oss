import { RouteShellPage } from "@/components/route-shell";

type ZoneRouteContext = {
  params: Promise<{
    zoneSlug: string;
    section?: string[];
  }>;
};

export async function generateMetadata({ params }: ZoneRouteContext) {
  const { zoneSlug, section } = await params;
  const label = section?.join(" / ") || "overview";
  return {
    title: `${zoneSlug} ${label} | AI-OSS.net`,
  };
}

export default async function ZoneSectionPage({ params }: ZoneRouteContext) {
  const { zoneSlug, section } = await params;
  const label = section?.join(" / ") || "overview";

  return (
    <RouteShellPage
      specKey="zones"
      eyebrow={`Zone / ${zoneSlug}`}
      title={zoneTitle(label)}
      summary="Zone pages share the same responsive shell for posts, rules, wiki, chat, voice, moderation, modmail, settings, and governance."
      detail={`Current zone: ${zoneSlug}. Current section: ${label}.`}
    />
  );
}

function zoneTitle(section: string): string {
  if (section === "overview") {
    return "Zone overview";
  }
  return section
    .split("/")
    .map((part) => part.replaceAll("-", " "))
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" / ");
}
