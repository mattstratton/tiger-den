import { CampaignsList } from "./_components/campaigns-list";

interface CampaignsPageProps {
  searchParams: Promise<{ highlight?: string }>;
}

export default async function CampaignsPage({
  searchParams,
}: CampaignsPageProps) {
  const { highlight } = await searchParams;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-bold text-2xl">Campaigns</h1>
        <p className="text-muted-foreground text-sm">
          Organize content by marketing campaigns
        </p>
      </div>

      <CampaignsList highlightCampaignId={highlight} />
    </div>
  );
}
