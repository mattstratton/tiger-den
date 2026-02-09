import { CampaignsList } from "./_components/campaigns-list";

interface CampaignsPageProps {
  searchParams: Promise<{ highlight?: string }>;
}

export default async function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const { highlight } = await searchParams;

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-bold text-3xl">Campaigns</h1>
      </div>

      <CampaignsList highlightCampaignId={highlight} />
    </div>
  );
}
