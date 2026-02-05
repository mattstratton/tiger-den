"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { ContentTypeBadge } from "~/app/content/_components/content-badge";
import { api } from "~/trpc/react";

const PREDEFINED_COLORS = [
  { name: "Red", value: "red" },
  { name: "Orange", value: "orange" },
  { name: "Amber", value: "amber" },
  { name: "Yellow", value: "yellow" },
  { name: "Lime", value: "lime" },
  { name: "Green", value: "green" },
  { name: "Emerald", value: "emerald" },
  { name: "Teal", value: "teal" },
  { name: "Cyan", value: "cyan" },
  { name: "Sky", value: "sky" },
  { name: "Blue", value: "blue" },
  { name: "Indigo", value: "indigo" },
  { name: "Violet", value: "violet" },
  { name: "Purple", value: "purple" },
  { name: "Fuchsia", value: "fuchsia" },
  { name: "Pink", value: "pink" },
  { name: "Rose", value: "rose" },
  { name: "Gray", value: "gray" },
] as const;

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(50)
    .regex(/^[a-z0-9_]+$/, "Slug must be lowercase letters, numbers, and underscores only"),
  color: z.enum([
    "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
    "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink",
    "rose", "gray",
  ]),
});

type FormValues = z.infer<typeof formSchema>;

interface ContentTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentTypeId?: number;
}

export function ContentTypeFormDialog({
  open,
  onOpenChange,
  contentTypeId,
}: ContentTypeFormDialogProps) {
  const utils = api.useUtils();

  // Fetch existing content type if editing
  const { data: contentTypes } = api.contentTypes.list.useQuery(undefined, {
    enabled: !!contentTypeId,
  });

  const existingType = contentTypes?.find((ct) => ct.id === contentTypeId);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
      color: "blue",
    },
  });

  const watchedName = form.watch("name");
  const watchedColor = form.watch("color");
  const watchedSlug = form.watch("slug");

  // Auto-suggest slug from name
  useEffect(() => {
    if (!contentTypeId && watchedName) {
      const suggestedSlug = watchedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

      // Only auto-fill if slug is empty or was auto-generated
      if (!form.getValues("slug") || form.formState.touchedFields.name) {
        form.setValue("slug", suggestedSlug, { shouldValidate: false });
      }
    }
  }, [watchedName, contentTypeId, form]);

  // Reset form when opening/closing or switching items
  useEffect(() => {
    if (existingType) {
      form.reset({
        name: existingType.name,
        slug: existingType.slug,
        color: existingType.color as FormValues["color"],
      });
    } else {
      form.reset({
        name: "",
        slug: "",
        color: "blue",
      });
    }
  }, [existingType, form, open]);

  const createMutation = api.contentTypes.create.useMutation({
    onSuccess: () => {
      void utils.contentTypes.list.invalidate();
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Failed to create content type:", error);
      form.setError("root", {
        message: error.message || "Failed to create content type",
      });
    },
  });

  const updateMutation = api.contentTypes.update.useMutation({
    onSuccess: () => {
      void utils.contentTypes.list.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Failed to update content type:", error);
      form.setError("root", {
        message: error.message || "Failed to update content type",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    if (contentTypeId) {
      updateMutation.mutate({ id: contentTypeId, ...values });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {contentTypeId ? "Edit Content Type" : "Add Content Type"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Blog Post" />
                  </FormControl>
                  <FormDescription>
                    Display name for this content type
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., blog_post" />
                  </FormControl>
                  <FormDescription>
                    Lowercase identifier (letters, numbers, underscores only)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Badge Color *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      className="grid grid-cols-6 gap-3"
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      {PREDEFINED_COLORS.map((color) => (
                        <FormItem key={color.value}>
                          <FormControl>
                            <RadioGroupItem
                              className="peer sr-only"
                              id={`color-${color.value}`}
                              value={color.value}
                            />
                          </FormControl>
                          <FormLabel
                            className="flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                            htmlFor={`color-${color.value}`}
                          >
                            <ContentTypeBadge
                              type={{ name: color.name, color: color.value }}
                            />
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Preview */}
            {watchedName && (
              <div className="rounded-lg border bg-muted/50 p-4">
                <h4 className="mb-2 font-medium text-sm">Preview</h4>
                <div className="flex items-center gap-2">
                  <ContentTypeBadge
                    type={{ name: watchedName, color: watchedColor }}
                  />
                  <span className="text-muted-foreground text-sm">
                    Slug: <code>{watchedSlug || "(none)"}</code>
                  </span>
                </div>
              </div>
            )}

            {form.formState.errors.root && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-destructive text-sm">
                {form.formState.errors.root.message}
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
                {contentTypeId ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
