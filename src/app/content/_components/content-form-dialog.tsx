"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const LAST_CONTENT_TYPE_KEY = "tiger-den-last-content-type-id";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";
import { CampaignMultiSelect } from "./campaign-multi-select";

const contentFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  currentUrl: z.string().url("Must be a valid URL"),
  contentTypeId: z.number().min(1, "Content type is required"),
  publishDate: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  targetAudience: z.string().optional(),
  tags: z.string().optional(), // Will be split into array
  campaignIds: z.array(z.string()).optional(),
});

type ContentFormValues = z.infer<typeof contentFormSchema>;

interface ContentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId?: string;
}

export function ContentFormDialog({
  open,
  onOpenChange,
  contentId,
}: ContentFormDialogProps) {
  const utils = api.useUtils();
  const [_date, _setDate] = useState<Date>();
  const [metadataUrl, setMetadataUrl] = useState<string | null>(null);

  // Fetch content types
  const { data: contentTypes } = api.contentTypes.list.useQuery();

  // Fetch existing content if editing
  const { data: existingContent } = api.content.getById.useQuery(
    { id: contentId! },
    { enabled: !!contentId },
  );

  // Auto-fetch metadata from URL (create mode only)
  const { data: urlMetadata, isFetching: isMetadataFetching } =
    api.content.fetchUrlMetadata.useQuery(
      { url: metadataUrl! },
      { enabled: !!metadataUrl && !contentId },
    );

  const form = useForm<ContentFormValues>({
    resolver: zodResolver(contentFormSchema),
    defaultValues: {
      contentTypeId: contentTypes?.[0]?.id ?? 1,
      title: "",
      currentUrl: "",
    },
  });

  // Default content type: remember last-used (5.1)
  const defaultContentTypeId = (() => {
    if (!contentTypes?.length) return undefined;
    try {
      const saved = localStorage.getItem(LAST_CONTENT_TYPE_KEY);
      if (saved) {
        const id = parseInt(saved, 10);
        if (contentTypes.some((t) => t.id === id)) return id;
      }
    } catch {
      /* ignore */
    }
    return contentTypes[0]?.id;
  })();

  // Reset form when editing existing content or when opening for create
  useEffect(() => {
    if (existingContent) {
      form.reset({
        title: existingContent.title,
        currentUrl: existingContent.currentUrl,
        contentTypeId: existingContent.contentTypeId,
        publishDate: existingContent.publishDate ?? undefined,
        description: existingContent.description ?? undefined,
        author: existingContent.author ?? undefined,
        targetAudience: existingContent.targetAudience ?? undefined,
        tags: existingContent.tags?.join(", ") ?? "",
        campaignIds: existingContent.campaigns.map((cc) => cc.campaign.id),
      });
    } else if (contentTypes?.length) {
      form.reset({
        contentTypeId: defaultContentTypeId ?? contentTypes[0]?.id ?? 1,
        title: "",
        currentUrl: "",
      });
    }
  }, [existingContent, contentTypes, form, defaultContentTypeId]);

  // Clear metadataUrl when dialog closes or switches to edit
  useEffect(() => {
    if (!open) {
      setMetadataUrl(null);
    }
  }, [open]);

  // Apply fetched metadata to empty form fields
  useEffect(() => {
    if (!urlMetadata) return;

    const currentTitle = form.getValues("title");
    if (!currentTitle && urlMetadata.title) {
      form.setValue("title", urlMetadata.title);
    }

    const currentDate = form.getValues("publishDate");
    if (!currentDate && urlMetadata.publishDate) {
      form.setValue("publishDate", urlMetadata.publishDate);
    }

    const currentAuthor = form.getValues("author");
    if (!currentAuthor && urlMetadata.author) {
      form.setValue("author", urlMetadata.author);
    }
  }, [urlMetadata, form]);

  const handleUrlBlur = () => {
    // Only auto-fetch in create mode
    if (contentId) return;

    const url = form.getValues("currentUrl");
    if (!url) return;

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return;
    }

    // Only fetch if at least one target field is empty
    const title = form.getValues("title");
    const date = form.getValues("publishDate");
    const author = form.getValues("author");
    if (title && date && author) return;

    setMetadataUrl(url);
  };

  const createMutation = api.content.create.useMutation({
    onSuccess: (_data, variables) => {
      if (variables.contentTypeId != null) {
        try {
          localStorage.setItem(
            LAST_CONTENT_TYPE_KEY,
            String(variables.contentTypeId),
          );
        } catch {
          /* ignore */
        }
      }
      utils.content.list.invalidate();
      onOpenChange(false);
      form.reset();
      toast.success("Content created");
    },
  });

  const updateMutation = api.content.update.useMutation({
    onSuccess: () => {
      utils.content.list.invalidate();
      onOpenChange(false);
      toast.success("Content updated");
    },
  });

  const onSubmit = (values: ContentFormValues) => {
    const data = {
      ...values,
      tags: values.tags
        ? values.tags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t)
        : undefined,
    };

    if (contentId) {
      updateMutation.mutate({ id: contentId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const onInvalid = (errors: Record<string, unknown>) => {
    const count = Object.keys(errors).length;
    const firstKey = Object.keys(errors)[0];
    if (firstKey) {
      form.setFocus(firstKey as keyof ContentFormValues);
    }
    toast.error(
      count === 1 ? "Please fix 1 error" : `Please fix ${count} errors`,
    );
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          form.setFocus("title");
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {contentId ? "Edit Content" : "Add Content"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-6"
            onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          >
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Basic Information</h3>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currentUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          onBlur={() => {
                            field.onBlur();
                            handleUrlBlur();
                          }}
                          type="url"
                        />
                        {isMetadataFetching && (
                          <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {existingContent?.previousUrls &&
                existingContent.previousUrls.length > 0 && (
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <h4 className="mb-2 font-medium text-sm">URL History</h4>
                    <div className="space-y-1">
                      {existingContent.previousUrls.map((url) => (
                        <div
                          className="text-muted-foreground text-sm"
                          key={url}
                        >
                          <a
                            className="hover:underline"
                            href={url}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            {url}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <FormField
                control={form.control}
                name="contentTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content Type *</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(parseInt(value, 10))
                      }
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contentTypes?.map((type) => (
                          <SelectItem key={type.id} value={type.id.toString()}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="publishDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Publish Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            className={`w-full pl-3 text-left font-normal ${
                              !field.value && "text-muted-foreground"
                            }`}
                            variant="outline"
                          >
                            {field.value ? (
                              format(new Date(field.value), "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-0">
                        <Calendar
                          initialFocus
                          mode="single"
                          onSelect={(date) =>
                            field.onChange(date?.toISOString().split("T")[0])
                          }
                          selected={
                            field.value ? new Date(field.value) : undefined
                          }
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Details</h3>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="author"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Author</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="targetAudience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Audience</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Organization */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Organization</h3>

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags (comma-separated)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="postgres, timescale, analytics"
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="campaignIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campaigns</FormLabel>
                    <FormControl>
                      <CampaignMultiSelect
                        onChange={field.onChange}
                        value={field.value || []}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {existingContent && (
              <div className="space-y-2 border-t pt-4">
                <h3 className="font-semibold text-sm">Metadata</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Source:</span>{" "}
                    <Badge variant="secondary">{existingContent.source}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>{" "}
                    {existingContent.createdAt
                      ? format(
                          new Date(existingContent.createdAt),
                          "MMM d, yyyy",
                        )
                      : "N/A"}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                onClick={() => onOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={createMutation.isPending || updateMutation.isPending}
                type="submit"
              >
                {contentId ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
