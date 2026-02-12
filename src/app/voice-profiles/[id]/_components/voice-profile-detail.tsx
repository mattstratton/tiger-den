"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
import { Loading } from "~/components/ui/loading";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";
import { TagInput } from "./tag-input";
import { WritingSamples } from "./writing-samples";

const voiceProfileSchema = z.object({
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
  linkedinUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  voiceNotes: z.string().min(1, "Voice notes are required"),
});

type VoiceProfileValues = z.infer<typeof voiceProfileSchema>;

interface VoiceProfileDetailProps {
  profileId: string;
}

export function VoiceProfileDetail({ profileId }: VoiceProfileDetailProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const { data: profile, isLoading } = api.voiceProfiles.getById.useQuery({
    id: profileId,
  });

  const [topics, setTopics] = useState<string[]>([]);
  const [antiPatterns, setAntiPatterns] = useState<string[]>([]);

  const form = useForm<VoiceProfileValues>({
    resolver: zodResolver(voiceProfileSchema),
    defaultValues: {
      name: "",
      displayName: "",
      title: "",
      company: "Tiger Data",
      linkedinUrl: "",
      voiceNotes: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name,
        displayName: profile.displayName,
        title: profile.title ?? "",
        company: profile.company ?? "Tiger Data",
        linkedinUrl: profile.linkedinUrl ?? "",
        voiceNotes: profile.voiceNotes,
      });
      setTopics(profile.topics ?? []);
      setAntiPatterns(profile.antiPatterns ?? []);
    }
  }, [profile, form]);

  const updateMutation = api.voiceProfiles.update.useMutation({
    onSuccess: () => {
      void utils.voiceProfiles.getById.invalidate({ id: profileId });
      void utils.voiceProfiles.list.invalidate();
    },
  });

  const deleteMutation = api.voiceProfiles.delete.useMutation({
    onSuccess: () => {
      void utils.voiceProfiles.list.invalidate();
      router.push("/voice-profiles");
    },
  });

  const onSubmit = (values: VoiceProfileValues) => {
    updateMutation.mutate({
      id: profileId,
      name: values.name,
      displayName: values.displayName,
      title: values.title || undefined,
      company: values.company || undefined,
      linkedinUrl: values.linkedinUrl || undefined,
      voiceNotes: values.voiceNotes,
      topics,
      antiPatterns,
    });
  };

  if (isLoading) {
    return <Loading message="Loading voice profile" />;
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Voice profile settings and metadata
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              className="space-y-6"
              onSubmit={form.handleSubmit(onSubmit)}
            >
              <div className="grid grid-cols-2 gap-4">
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
                        Lowercase lookup key
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
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
                <FormField
                  control={form.control}
                  name="linkedinUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn URL</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="https://linkedin.com/in/..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <FormLabel>Topics</FormLabel>
                <div className="mt-2">
                  <TagInput
                    onChange={setTopics}
                    placeholder="Add a topic and press Enter..."
                    value={topics}
                  />
                </div>
                <p className="mt-1 text-muted-foreground text-xs">
                  Topics this person covers (e.g., &quot;PostgreSQL
                  performance&quot;, &quot;time-series architecture&quot;)
                </p>
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
                        className="min-h-[200px]"
                        placeholder="Describe this person's writing style in detail. Include sentence rhythm, tone, verbal tics, humor style, second-person usage patterns. The more specific the better."
                        rows={10}
                      />
                    </FormControl>
                    <FormDescription>
                      This is the most important field. Detailed style
                      descriptions produce better voice matching.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel>Anti-Patterns</FormLabel>
                <div className="mt-2">
                  <TagInput
                    onChange={setAntiPatterns}
                    placeholder="Add an anti-pattern and press Enter..."
                    value={antiPatterns}
                  />
                </div>
                <p className="mt-1 text-muted-foreground text-xs">
                  Things this person would never write (e.g., &quot;em-dashes&quot;,
                  &quot;corporate jargon&quot;, &quot;emoji&quot;)
                </p>
              </div>

              <div className="flex justify-end gap-2">
                {updateMutation.isSuccess && (
                  <span className="self-center text-muted-foreground text-sm">
                    Saved
                  </span>
                )}
                <Button disabled={updateMutation.isPending} type="submit">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <WritingSamples profileId={profileId} samples={profile.writingSamples} />

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-muted-foreground text-sm">
            Deleting this voice profile will also delete all writing samples.
            This cannot be undone.
          </p>
          <Button
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate({ id: profileId })}
            variant="destructive"
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete Profile"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
