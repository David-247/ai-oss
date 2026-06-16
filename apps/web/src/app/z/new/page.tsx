import { RouteShellPage } from "@/components/route-shell";

export const metadata = {
  title: "Create Zone | AI-OSS.net",
};

export default function NewZonePage() {
  return (
    <RouteShellPage
      specKey="zones"
      eyebrow="Zones"
      title="Create zone"
      summary="Start a focused workspace with rules, moderators, chat, voice, wiki, and governance settings."
      detail="Zone creation collects a slug, name, topic, rule summary, default visibility, and moderator seed list."
    />
  );
}
