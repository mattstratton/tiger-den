"use client";

import {
  Check,
  ChevronDown,
  ClipboardCopy,
  FileUp,
  Loader2,
  X,
} from "lucide-react";
import { type ChangeEvent, useCallback, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
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

export function LinkedInConverterForm() {
  const utils = api.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Content input
  const [title, setTitle] = useState("");
  const [contentText, setContentText] = useState("");
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfExtracting, setPdfExtracting] = useState(false);

  // Voice profile and CTA
  const [profileId, setProfileId] = useState<string>("");
  const [ctaType, setCtaType] = useState("whitepaper");
  const [ctaUrl, setCtaUrl] = useState(CTA_OPTIONS[0]!.url);

  // Advanced options
  const [audience, setAudience] = useState("");
  const [wordCount, setWordCount] = useState(1000);
  const [angle, setAngle] = useState("");
  const [optionsOpen, setOptionsOpen] = useState(false);

  // State
  const [isBuilding, setIsBuilding] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: profilesList } = api.voiceProfiles.list.useQuery();

  const handleCtaChange = (value: string) => {
    setCtaType(value);
    const option = CTA_OPTIONS.find((o) => o.value === value);
    if (option && option.url) {
      setCtaUrl(option.url);
    } else {
      setCtaUrl("");
    }
  };

  const handlePdfUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || file.type !== "application/pdf") return;

      setPdfExtracting(true);
      setPdfFileName(file.name);

      try {
        const arrayBuffer = await file.arrayBuffer();

        // Dynamic import to avoid SSR issues
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const textParts: string[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ");
          textParts.push(pageText);
        }

        setContentText(textParts.join("\n\n"));
      } catch (err) {
        console.error("PDF extraction failed:", err);
        setPdfFileName(null);
        setContentText("");
      } finally {
        setPdfExtracting(false);
      }
    },
    [],
  );

  const clearPdf = () => {
    setPdfFileName(null);
    setContentText("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCopyPrompt = async () => {
    if (!profileId || !contentText) return;

    setIsBuilding(true);
    setCopied(false);

    try {
      // Fetch voice profile
      const author = await utils.voiceProfiles.getById.fetch({ id: profileId });

      // Build search query from title (if provided) and first ~200 words of content
      const contentPreview = contentText.split(/\s+/).slice(0, 50).join(" ");
      const searchQuery = title ? `${title} ${contentPreview}` : contentPreview;

      // Search for suggested links
      let suggestedLinks: SuggestedLink[] = [];
      try {
        const searchResults = await utils.content.hybridSearch.fetch({
          query: searchQuery.slice(0, 500), // cap query length
          limit: 5,
        });
        suggestedLinks = searchResults
          .filter(
            (r: { contentItem: { id: string } | null }) => r.contentItem,
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
        // Search failure is non-fatal
      }

      const ctaLabel =
        CTA_OPTIONS.find((o) => o.value === ctaType)?.label ?? ctaType;

      const prompt = buildLinkedInPrompt({
        contentText,
        contentTitle: title,
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

  const isReady = !!profileId && !!contentText;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main content input */}
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
            <CardDescription>
              Paste the blog post text or upload a PDF
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Blog post title"
                value={title}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Content *</Label>
                <div className="flex items-center gap-2">
                  {pdfFileName && (
                    <span className="flex items-center gap-1 text-muted-foreground text-xs">
                      {pdfFileName}
                      <button
                        className="rounded p-0.5 hover:bg-muted"
                        onClick={clearPdf}
                        type="button"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  <Button
                    disabled={pdfExtracting}
                    onClick={() => fileInputRef.current?.click()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {pdfExtracting ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <FileUp className="mr-1 h-4 w-4" />
                    )}
                    Upload PDF
                  </Button>
                  <input
                    accept=".pdf"
                    className="hidden"
                    onChange={handlePdfUpload}
                    ref={fileInputRef}
                    type="file"
                  />
                </div>
              </div>
              <Textarea
                className="min-h-[300px]"
                onChange={(e) => setContentText(e.target.value)}
                placeholder="Paste the full blog post content here, or upload a PDF above..."
                value={contentText}
              />
              {contentText && (
                <p className="text-muted-foreground text-xs">
                  {contentText.split(/\s+/).length} words
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar: author, CTA, options */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  className="w-full justify-between px-0"
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

            <Button
              className="w-full"
              disabled={!isReady || isBuilding}
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
                  Copied! Paste into Claude.
                </>
              ) : (
                <>
                  <ClipboardCopy className="mr-2 h-4 w-4" />
                  Copy Prompt
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
