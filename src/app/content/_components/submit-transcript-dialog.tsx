"use client";

import { Check, Copy, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";

interface SubmitTranscriptDialogProps {
  contentId: string;
  contentUrl: string;
}

/**
 * Strip SRT subtitle formatting to plain text.
 * Removes sequence numbers, timestamps (00:00:00,000 --> 00:00:00,000), and blank lines.
 */
function parseSrt(text: string): string {
  return text
    .replace(/^\d+\s*$/gm, "") // sequence numbers
    .replace(/\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}.*/g, "") // timestamps
    .replace(/<[^>]+>/g, "") // HTML-like tags (e.g. <font>)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Strip VTT subtitle formatting to plain text.
 * Removes WEBVTT header, timestamps, and blank lines.
 */
function parseVtt(text: string): string {
  return text
    .replace(/^WEBVTT.*$/m, "") // WEBVTT header
    .replace(/^Kind:.*$/gm, "") // metadata lines
    .replace(/^Language:.*$/gm, "")
    .replace(/^NOTE.*$/gm, "") // comments
    .replace(/^\d+\s*$/gm, "") // sequence numbers (optional in VTT)
    .replace(/\d{2}:\d{2}[:.]\d{3}\s*-->\s*\d{2}:\d{2}[:.]\d{3}.*/g, "") // short timestamps
    .replace(/\d{2}:\d{2}:\d{2}[:.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[:.]\d{3}.*/g, "") // long timestamps
    .replace(/<[^>]+>/g, "") // tags
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function SubmitTranscriptDialog({
  contentId,
  contentUrl,
}: SubmitTranscriptDialogProps) {
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = api.useUtils();

  const submitMutation = api.content.submitTranscript.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.content.getIndexStatus.invalidate({ id: contentId }),
        utils.content.youtubeNeedingTranscripts.invalidate(),
      ]);
      toast.success("Transcript indexed successfully");
      setTranscript("");
      setFileName(null);
      setOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to index transcript: ${error.message}`);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const name = file.name.toLowerCase();

      let parsed: string;
      if (name.endsWith(".srt")) {
        parsed = parseSrt(text);
      } else if (name.endsWith(".vtt")) {
        parsed = parseVtt(text);
      } else {
        parsed = text;
      }

      setTranscript(parsed);
      setFileName(file.name);
    };
    reader.readAsText(file);
  };

  const handleSubmit = () => {
    if (!transcript.trim()) {
      toast.error("Transcript text is empty");
      return;
    }
    submitMutation.mutate({ id: contentId, transcript: transcript.trim() });
  };

  const wordCount = transcript ? countWords(transcript) : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Upload Transcript
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Transcript</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="paste">
          <TabsList>
            <TabsTrigger value="paste">Paste Text</TabsTrigger>
            <TabsTrigger value="upload">Upload File</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="mt-3 space-y-3">
            <Textarea
              placeholder="Paste transcript text here..."
              rows={10}
              value={transcript}
              onChange={(e) => {
                setTranscript(e.target.value);
                setFileName(null);
              }}
            />
          </TabsContent>

          <TabsContent value="upload" className="mt-3 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="transcript-file">
                Select a .txt, .srt, or .vtt file
              </Label>
              <Input
                ref={fileInputRef}
                id="transcript-file"
                type="file"
                accept=".txt,.srt,.vtt"
                onChange={handleFileChange}
              />
              {fileName && (
                <p className="text-muted-foreground text-sm">
                  Loaded: {fileName}
                </p>
              )}
            </div>

            <details className="text-muted-foreground text-xs">
              <summary className="cursor-pointer font-medium">
                How to get a transcript
              </summary>
              <div className="mt-2 relative">
                <pre className="overflow-x-auto rounded bg-muted p-2 pr-8 text-xs">
                  {`yt-dlp --write-auto-sub --sub-lang en \\\n  --skip-download --convert-subs srt \\\n  -o "transcript" ${contentUrl}`}
                </pre>
                <button
                  type="button"
                  className="absolute top-1.5 right-1.5 rounded p-1 text-muted-foreground hover:bg-muted-foreground/10"
                  onClick={async () => {
                    const cmd = `yt-dlp --write-auto-sub --sub-lang en --skip-download --convert-subs srt -o "transcript" ${contentUrl}`;
                    await navigator.clipboard.writeText(cmd);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <p className="mt-1">
                This creates a transcript.en.srt file you can upload here.
              </p>
            </details>

            {transcript && (
              <div className="space-y-1">
                <Label>Preview</Label>
                <Textarea
                  rows={6}
                  readOnly
                  value={transcript.slice(0, 2000) + (transcript.length > 2000 ? "..." : "")}
                  className="text-muted-foreground text-xs"
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        {wordCount > 0 && (
          <p className="text-muted-foreground text-sm">
            {wordCount.toLocaleString()} words
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!transcript.trim() || submitMutation.isPending}
            onClick={handleSubmit}
          >
            {submitMutation.isPending ? "Indexing..." : "Submit & Index"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
