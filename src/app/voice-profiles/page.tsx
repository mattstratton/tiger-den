import { VoiceProfilesList } from "./_components/voice-profiles-list";

export default async function VoiceProfilesPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-bold text-2xl">Voice Profiles</h1>
        <p className="text-muted-foreground text-sm">
          Manage voice profiles and writing samples for content conversion
        </p>
      </div>

      <VoiceProfilesList />
    </div>
  );
}
