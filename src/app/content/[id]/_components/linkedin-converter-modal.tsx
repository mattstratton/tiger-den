"use client";

import { Check, ChevronDown, ClipboardCopy, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import {
  buildLinkedInPrompt,
  type SuggestedLink,
} from "~/lib/linkedin-prompt-builder";
import { api } from "~/trpc/react";

const CTA_OPTIONS: { value: string; label: string; url: string }[] = [
  {
    value: "whitepaper",
    label: "Architecture whitepaper",
    url: "https://www.tigerdata.com/blog/building-columnar-compression-in-a-row-oriented-database",
  },
  {
    value: "free_trial",
    label: "Free trial",
    url: "https://console.cloud.timescale.com/signup",
  },
  {
    value: "blog",
    label: "Related blog post",
    url: "",
  },
  {
    value: "custom",
    label: "Custom URL",
    url: "",
  },
];

interface LinkedInConverterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  contentTitle: string;
  contentUrl: string;
  contentDescription: string | null;
  contentTags: string[] | null;
}

export function LinkedInConverterModal({
  open,
  onOpenChange,
  contentId,
  contentTitle,
  contentUrl,
  contentDescription,
  contentTags,
}: LinkedInConverterModalProps) {
  const utils = api.useUtils();
  const [profileId, setProfileId] = useState<string>("");
  const [ctaType, setCtaType] = useState("whitepaper");
  const [ctaUrl, setCtaUrl] = useState(CTA_OPTIONS[0]!.url);
  const [audience, setAudience] = useState("");
  const [wordCount, setWordCount] = useState(1000);
  const [angle, setAngle] = useState("");
  const [isBuilding, setIsBuilding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const { data: profilesList } = api.voiceProfiles.list.useQuery();
  const { data: contentTextData } = api.content.getContentText.useQuery(
    { id: contentId },
    { enabled: open },
  );

  const handleCtaChange = (value: string) => {
    setCtaType(value);
    const option = CTA_OPTIONS.find((o) => o.value === value);
    if (option && option.url) {
      setCtaUrl(option.url);
    } else {
      setCtaUrl("");
    }
  };

  const handleCopyPrompt = async () => {
    if (!profileId) return;

    setIsBuilding(true);
    setCopied(false);

    try {
      // Fetch voice profile imperatively
      const author = await utils.voiceProfiles.getById.fetch({ id: profileId });

      // Build search query from title and tags
      const searchQuery = [
        contentTitle,
        ...(contentTags?.slice(0, 3) ?? []),
      ].join(" ");

      // Search for suggested links
      let suggestedLinks: SuggestedLink[] = [];
      try {
        const searchResults = await utils.content.hybridSearch.fetch({
          query: searchQuery,
          limit: 5,
        });
        suggestedLinks = searchResults
          .filter(
            (r: { contentItem: { id: string } | null }) =>
              r.contentItem && r.contentItem.id !== contentId,
          )
          .slice(0, 5)
          .map(
            (r: {
              contentItem: {
                title: string;
                currentUrl: string;
                description: string | null;
                contentTypeRel: { name: string };
              } | null;
            }) => ({
              title: r.contentItem!.title,
              url: r.contentItem!.currentUrl,
              contentType: r.contentItem!.contentTypeRel.name,
              description: r.contentItem!.description,
            }),
          );
      } catch {
        // Search failure is non-fatal; proceed without suggested links
      }

      const ctaLabel =
        CTA_OPTIONS.find((o) => o.value === ctaType)?.label ?? ctaType;

      const prompt = buildLinkedInPrompt({
        contentText: contentTextData?.plainText ?? null,
        contentTitle,
        contentUrl,
        contentDescription: contentDescription ?? undefined,
        author: {
          displayName: author.displayName,
          title: author.title,
          company: author.company,
          voiceNotes: author.voiceNotes,
          antiPatterns: author.antiPatterns,
          topics: author.topics,
          writingSamples: author.writingSamples.map((s) => ({
            label: s.label,
            content: s.content,
          })),
        },
        ctaType: ctaLabel,
        ctaUrl,
        audience: audience || undefined,
        wordCount,
        angle: angle || undefined,
        suggestedLinks,
      });

      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Copy for LinkedIn</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!contentTextData && (
            <p className="rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-600">
              This content hasn&apos;t been indexed yet. The prompt will include
              a placeholder for you to paste the blog post content.
            </p>
          )}

          <div className="space-y-2">
            <Label>Who&apos;s posting? *</Label>
            <Select onValueChange={setProfileId} value={profileId}>
              <SelectTrigger>
                <SelectValue placeholder="Select voice profile..." />
              </SelectTrigger>
              <SelectContent>
                {profilesList?.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>CTA type</Label>
            <Select onValueChange={handleCtaChange} value={ctaType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CTA_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(ctaType === "custom" || ctaType === "blog") && (
              <Input
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://..."
                value={ctaUrl}
              />
            )}
          </div>

          <Collapsible onOpenChange={setOptionsOpen} open={optionsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                className="w-full justify-between"
                type="button"
                variant="ghost"
              >
                <span className="text-muted-foreground text-sm">
                  Advanced options
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${optionsOpen ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Target audience</Label>
                <Input
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Infer from content"
                  value={audience}
                />
              </div>
              <div className="space-y-2">
                <Label>Word count</Label>
                <Input
                  min={500}
                  max={2000}
                  onChange={(e) => setWordCount(Number(e.target.value))}
                  type="number"
                  value={wordCount}
                />
              </div>
              <div className="space-y-2">
                <Label>Specific angle or emphasis</Label>
                <Textarea
                  onChange={(e) => setAngle(e.target.value)}
                  placeholder="e.g., lean into cost implications"
                  rows={2}
                  value={angle}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={!profileId || isBuilding}
              onClick={handleCopyPrompt}
            >
              {isBuilding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Building prompt...
                </>
              ) : copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <ClipboardCopy className="mr-2 h-4 w-4" />
                  Copy Prompt
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
