import { CampaignsList } from "./_components/campaigns-list";

export default function CampaignsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-bold text-3xl">Campaigns</h1>
      </div>

      <CampaignsList />
    </div>
  );
}
