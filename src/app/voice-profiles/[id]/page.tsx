import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "~/trpc/server";
import { VoiceProfileDetail } from "./_components/voice-profile-detail";

interface VoiceProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function VoiceProfilePage({
  params,
}: VoiceProfilePageProps) {
  const { id } = await params;

  const profile = await api.voiceProfiles.getById({ id }).catch(() => null);

  if (!profile) {
    notFound();
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link
          className="text-muted-foreground hover:text-foreground"
          href="/voice-profiles"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-bold text-2xl">{profile.displayName}</h1>
          <p className="text-muted-foreground text-sm">@{profile.name}</p>
        </div>
      </div>

      <VoiceProfileDetail profileId={id} />
    </div>
  );
}
