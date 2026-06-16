import { RouteShellPage } from "@/components/route-shell";

export const metadata = {
  title: "Messages | AI-OSS.net",
};

export default function MessagesPage() {
  return (
    <RouteShellPage
      specKey="home"
      eyebrow="Messages"
      title="Messages"
      summary="Private member conversations and modmail entry points share one accessible list/detail layout."
      detail="Direct message permissions follow the account privacy settings and server-side authorization checks."
    />
  );
}
