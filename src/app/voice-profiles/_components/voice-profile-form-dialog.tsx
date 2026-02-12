"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";

const formSchema = z.object({
  name: z
    .string()
    .min(1, "Slug is required")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must be lowercase letters, numbers, and hyphens only",
    ),
  displayName: z.string().min(1, "Display name is required"),
  title: z.string().optional(),
  company: z.string().optional(),
  voiceNotes: z.string().min(1, "Voice notes are required"),
});

type FormValues = z.infer<typeof formSchema>;

interface VoiceProfileFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId?: string;
}

export function VoiceProfileFormDialog({
  open,
  onOpenChange,
  profileId,
}: VoiceProfileFormDialogProps) {
  const utils = api.useUtils();
  const router = useRouter();

  const { data: existingProfile } = api.voiceProfiles.getById.useQuery(
    { id: profileId! },
    { enabled: !!profileId },
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      displayName: "",
      title: "",
      company: "Tiger Data",
      voiceNotes: "",
    },
  });

  useEffect(() => {
    if (existingProfile) {
      form.reset({
        name: existingProfile.name,
        displayName: existingProfile.displayName,
        title: existingProfile.title ?? "",
        company: existingProfile.company ?? "Tiger Data",
        voiceNotes: existingProfile.voiceNotes,
      });
    } else {
      form.reset({
        name: "",
        displayName: "",
        title: "",
        company: "Tiger Data",
        voiceNotes: "",
      });
    }
  }, [existingProfile, form]);

  const createMutation = api.voiceProfiles.create.useMutation({
    onSuccess: (newProfile) => {
      void utils.voiceProfiles.list.invalidate();
      onOpenChange(false);
      form.reset();
      if (newProfile) {
        router.push(`/voice-profiles/${newProfile.id}`);
      }
    },
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate({
      name: values.name,
      displayName: values.displayName,
      title: values.title || undefined,
      company: values.company || undefined,
      voiceNotes: values.voiceNotes,
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Voice Profile</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Matty Stratton" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="matty" />
                  </FormControl>
                  <FormDescription>
                    Lowercase lookup key (e.g., &quot;matty&quot;,
                    &quot;sarah&quot;)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Head of Developer Relations"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Tiger Data" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="voiceNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Voice Notes *</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Describe this person's writing style, tone, sentence rhythm, humor, verbal tics..."
                      rows={5}
                    />
                  </FormControl>
                  <FormDescription>
                    The more specific, the better. You can add more detail on the
                    edit page after creating.
                  </FormDescription>
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
              <Button disabled={createMutation.isPending} type="submit">
                Create
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
