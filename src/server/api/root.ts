import { apiImportRouter } from "~/server/api/routers/api-import";
import { voiceProfilesRouter } from "~/server/api/routers/voice-profiles";
import { campaignsRouter } from "~/server/api/routers/campaigns";
import { contentRouter } from "~/server/api/routers/content";
import { contentTypesRouter } from "~/server/api/routers/contentTypes";
import { csvRouter } from "~/server/api/routers/csv";
import { postRouter } from "~/server/api/routers/post";
import { queueRouter } from "~/server/api/routers/queue";
import { usersRouter } from "~/server/api/routers/users";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  content: contentRouter,
  voiceProfiles: voiceProfilesRouter,
  campaigns: campaignsRouter,
  csv: csvRouter,
  queue: queueRouter,
  contentTypes: contentTypesRouter,
  users: usersRouter,
  apiImport: apiImportRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
