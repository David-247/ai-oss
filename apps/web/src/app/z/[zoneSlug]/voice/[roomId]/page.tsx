import { VoiceRoomClient } from "./voice-room-client";

type VoiceRoomPageContext = {
  params: Promise<{
    zoneSlug: string;
    roomId: string;
  }>;
};

export async function generateMetadata({ params }: VoiceRoomPageContext) {
  const { zoneSlug, roomId } = await params;
  return {
    title: `${zoneSlug} voice ${roomId} | AI-OSS.net`,
  };
}

export default async function VoiceRoomPage({ params }: VoiceRoomPageContext) {
  const { zoneSlug, roomId } = await params;
  return <VoiceRoomClient zoneSlug={zoneSlug} roomId={roomId} />;
}
