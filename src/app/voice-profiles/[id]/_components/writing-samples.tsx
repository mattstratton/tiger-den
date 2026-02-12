"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";

const SOURCE_TYPES = [
  { value: "linkedin_post", label: "LinkedIn Post" },
  { value: "blog_excerpt", label: "Blog Excerpt" },
  { value: "conference_talk", label: "Conference Talk" },
  { value: "slack_message", label: "Slack Message" },
  { value: "other", label: "Other" },
] as const;

const sampleFormSchema = z.object({
  label: z.string().min(1, "Label is required"),
  content: z.string().min(1, "Content is required"),
  sourceType: z.string().optional(),
  sourceUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type SampleFormValues = z.infer<typeof sampleFormSchema>;

interface WritingSample {
  id: string;
  voiceProfileId: string;
  label: string;
  content: string;
  sourceType: string | null;
  sourceUrl: string | null;
  createdAt: Date;
}

interface WritingSamplesProps {
  profileId: string;
  samples: WritingSample[];
}

export function WritingSamples({ profileId, samples }: WritingSamplesProps) {
  const utils = api.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSampleId, setEditingSampleId] = useState<string | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSample, setDeletingSample] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const editingSample = editingSampleId
    ? samples.find((s) => s.id === editingSampleId)
    : undefined;

  const form = useForm<SampleFormValues>({
    resolver: zodResolver(sampleFormSchema),
    defaultValues: {
      label: "",
      content: "",
      sourceType: "",
      sourceUrl: "",
    },
  });

  useEffect(() => {
    if (editingSample) {
      form.reset({
        label: editingSample.label,
        content: editingSample.content,
        sourceType: editingSample.sourceType ?? "",
        sourceUrl: editingSample.sourceUrl ?? "",
      });
    } else {
      form.reset({
        label: "",
        content: "",
        sourceType: "",
        sourceUrl: "",
      });
    }
  }, [editingSample, form]);

  const addMutation = api.voiceProfiles.addSample.useMutation({
    onSuccess: () => {
      void utils.voiceProfiles.getById.invalidate({ id: profileId });
      setDialogOpen(false);
      form.reset();
    },
  });

  const updateMutation = api.voiceProfiles.updateSample.useMutation({
    onSuccess: () => {
      void utils.voiceProfiles.getById.invalidate({ id: profileId });
      setDialogOpen(false);
      form.reset();
    },
  });

  const deleteMutation = api.voiceProfiles.deleteSample.useMutation({
    onSuccess: () => {
      void utils.voiceProfiles.getById.invalidate({ id: profileId });
      setDeleteDialogOpen(false);
    },
  });

  const handleAdd = () => {
    setEditingSampleId(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (sampleId: string) => {
    setEditingSampleId(sampleId);
    setDialogOpen(true);
  };

  const handleDelete = (sampleId: string, label: string) => {
    setDeletingSample({ id: sampleId, label });
    setDeleteDialogOpen(true);
  };

  const onSubmit = (values: SampleFormValues) => {
    if (editingSampleId) {
      updateMutation.mutate({
        id: editingSampleId,
        label: values.label,
        content: values.content,
        sourceType: values.sourceType || undefined,
        sourceUrl: values.sourceUrl || undefined,
      });
    } else {
      addMutation.mutate({
        voiceProfileId: profileId,
        label: values.label,
        content: values.content,
        sourceType: values.sourceType || undefined,
        sourceUrl: values.sourceUrl || undefined,
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Writing Samples</CardTitle>
              <CardDescription>
                Examples of this person&apos;s writing for voice matching (
                {samples.length})
              </CardDescription>
            </div>
            <Button onClick={handleAdd} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Add Sample
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {samples.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm">
              No writing samples yet. Add samples to improve voice matching
              quality.
            </p>
          ) : (
            <div className="space-y-3">
              {samples.map((sample) => (
                <div
                  className="group flex items-start justify-between rounded-lg border p-4"
                  key={sample.id}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {sample.label}
                      </span>
                      {sample.sourceType && (
                        <Badge variant="outline">
                          {SOURCE_TYPES.find(
                            (t) => t.value === sample.sourceType,
                          )?.label ?? sample.sourceType}
                        </Badge>
                      )}
                    </div>
                    <p className="line-clamp-2 text-muted-foreground text-sm">
                      {sample.content}
                    </p>
                    {sample.sourceUrl && (
                      <a
                        className="text-xs text-primary hover:underline"
                        href={sample.sourceUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Source link
                      </a>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label={`Actions for ${sample.label}`}
                        className="ml-2 h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100"
                        size="icon"
                        variant="ghost"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(sample.id)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(sample.id, sample.label)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSampleId ? "Edit Writing Sample" : "Add Writing Sample"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="LinkedIn post about MVCC overhead"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content *</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="max-h-[40vh] min-h-[200px]"
                        placeholder="Paste the writing sample here. 200-500 words typical."
                        rows={10}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sourceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SOURCE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
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
                  name="sourceUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source URL</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="https://..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setDialogOpen(false)}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  disabled={addMutation.isPending || updateMutation.isPending}
                  type="submit"
                >
                  {editingSampleId ? "Update" : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {deletingSample && (
        <AlertDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Writing Sample</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{deletingSample.label}
                &quot;? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
                onClick={() =>
                  deleteMutation.mutate({ id: deletingSample.id })
                }
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
