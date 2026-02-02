import { CampaignsList } from "./_components/campaigns-list";

export default function CampaignsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Campaigns</h1>
      </div>

      <CampaignsList />
    </div>
  );
}
