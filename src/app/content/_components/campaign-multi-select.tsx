"use client";

import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

interface CampaignMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function CampaignMultiSelect({
  value,
  onChange,
}: CampaignMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");

  const utils = api.useUtils();
  const { data: campaigns = [] } = api.campaigns.list.useQuery();

  const createCampaignMutation = api.campaigns.create.useMutation({
    onSuccess: (newCampaign) => {
      utils.campaigns.list.invalidate();
      // Add the new campaign to the selection
      if (newCampaign) {
        onChange([...value, newCampaign.id]);
      }
      setNewCampaignName("");
      setShowCreateForm(false);
    },
  });

  const selectedCampaigns = campaigns.filter((campaign) =>
    value.includes(campaign.id),
  );

  const handleToggleCampaign = (campaignId: string) => {
    if (value.includes(campaignId)) {
      onChange(value.filter((id) => id !== campaignId));
    } else {
      onChange([...value, campaignId]);
    }
  };

  const handleRemoveCampaign = (campaignId: string) => {
    onChange(value.filter((id) => id !== campaignId));
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCampaignName.trim()) {
      createCampaignMutation.mutate({ name: newCampaignName.trim() });
    }
  };

  return (
    <div className="space-y-2">
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            className="w-full justify-between"
            role="combobox"
            variant="outline"
          >
            {value.length === 0
              ? "Select campaigns..."
              : `${value.length} campaign${value.length === 1 ? "" : "s"} selected`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search campaigns..." />
            <CommandList>
              <CommandEmpty>
                <div className="p-2">
                  <p className="mb-2 text-muted-foreground text-sm">
                    No campaigns found.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => setShowCreateForm(true)}
                    size="sm"
                    variant="outline"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create new campaign
                  </Button>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {campaigns.map((campaign) => (
                  <CommandItem
                    key={campaign.id}
                    onSelect={() => handleToggleCampaign(campaign.id)}
                    value={campaign.name}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        value.includes(campaign.id)
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </div>
                    <span>{campaign.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {campaigns.length > 0 && !showCreateForm && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      className="justify-center text-center"
                      onSelect={() => setShowCreateForm(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create new campaign
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>

          {showCreateForm && (
            <div className="border-t p-3">
              <form className="space-y-2" onSubmit={handleCreateCampaign}>
                <Input
                  autoFocus
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="Campaign name"
                  value={newCampaignName}
                />
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={
                      !newCampaignName.trim() ||
                      createCampaignMutation.isPending
                    }
                    size="sm"
                    type="submit"
                  >
                    Create
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewCampaignName("");
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {selectedCampaigns.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCampaigns.map((campaign) => (
            <Badge
              className="cursor-pointer hover:bg-secondary/80"
              key={campaign.id}
              onClick={() => handleRemoveCampaign(campaign.id)}
              variant="secondary"
            >
              {campaign.name}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
