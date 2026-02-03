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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";

const campaignFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

type CampaignFormValues = z.infer<typeof campaignFormSchema>;

interface CampaignFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId?: string;
}

export function CampaignFormDialog({
  open,
  onOpenChange,
  campaignId,
}: CampaignFormDialogProps) {
  const utils = api.useUtils();

  // Fetch the campaign data for editing
  const { data: existingCampaign } = api.campaigns.getById.useQuery(
    { id: campaignId! },
    { enabled: !!campaignId },
  );

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Reset form when editing existing campaign or opening for new campaign
  useEffect(() => {
    if (existingCampaign) {
      form.reset({
        name: existingCampaign.name,
        description: existingCampaign.description ?? "",
      });
    } else {
      form.reset({
        name: "",
        description: "",
      });
    }
  }, [existingCampaign, form]);

  const createMutation = api.campaigns.create.useMutation({
    onSuccess: () => {
      void utils.campaigns.list.invalidate();
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Failed to create campaign:", error);
    },
  });

  const updateMutation = api.campaigns.update.useMutation({
    onSuccess: () => {
      void utils.campaigns.list.invalidate();
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Failed to update campaign:", error);
    },
  });

  const onSubmit = (values: CampaignFormValues) => {
    if (campaignId) {
      updateMutation.mutate({
        id: campaignId,
        name: values.name,
        description: values.description || undefined,
      });
    } else {
      createMutation.mutate({
        name: values.name,
        description: values.description || undefined,
      });
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {campaignId ? "Edit Campaign" : "Add Campaign"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Q1 2025 Launch" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Campaign description..."
                      rows={3}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                {campaignId ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
