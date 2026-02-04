"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
  contentType: z.enum([
    "youtube_video",
    "blog_post",
    "case_study",
    "website_content",
    "third_party",
    "other",
  ]),
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

  // Fetch existing content if editing
  const { data: existingContent } = api.content.getById.useQuery(
    { id: contentId! },
    { enabled: !!contentId },
  );

  const form = useForm<ContentFormValues>({
    resolver: zodResolver(contentFormSchema),
    defaultValues: {
      contentType: "blog_post",
      title: "",
      currentUrl: "",
    },
  });

  // Reset form when editing existing content
  useEffect(() => {
    if (existingContent) {
      form.reset({
        title: existingContent.title,
        currentUrl: existingContent.currentUrl,
        contentType: existingContent.contentType,
        publishDate: existingContent.publishDate ?? undefined,
        description: existingContent.description ?? undefined,
        author: existingContent.author ?? undefined,
        targetAudience: existingContent.targetAudience ?? undefined,
        tags: existingContent.tags?.join(", ") ?? "",
        campaignIds: existingContent.campaigns.map((cc) => cc.campaign.id),
      });
    } else {
      form.reset({
        contentType: "blog_post",
        title: "",
        currentUrl: "",
      });
    }
  }, [existingContent, form]);

  const createMutation = api.content.create.useMutation({
    onSuccess: () => {
      utils.content.list.invalidate();
      onOpenChange(false);
      form.reset();
    },
  });

  const updateMutation = api.content.update.useMutation({
    onSuccess: () => {
      utils.content.list.invalidate();
      onOpenChange(false);
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

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {contentId ? "Edit Content" : "Add Content"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
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
                      <Input {...field} type="url" />
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
                name="contentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content Type *</FormLabel>
                    <Select
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="youtube_video">
                          YouTube Video
                        </SelectItem>
                        <SelectItem value="blog_post">Blog Post</SelectItem>
                        <SelectItem value="case_study">Case Study</SelectItem>
                        <SelectItem value="website_content">
                          Website Content
                        </SelectItem>
                        <SelectItem value="third_party">Third Party</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
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
