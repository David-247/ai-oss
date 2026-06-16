import { RouteShellPage } from "@/components/route-shell";

export const metadata = {
  title: "Notifications | AI-OSS.net",
};

export default function NotificationsPage() {
  return (
    <RouteShellPage
      specKey="home"
      eyebrow="Notifications"
      title="Notifications"
      summary="Review replies, mentions, moderation decisions, research review requests, security notices, and digest alerts."
      detail="Notification preferences are managed from Account."
    />
  );
}
