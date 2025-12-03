import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import sendAudioRoute from "./routes/walkie-talkie/send-audio/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  walkieTalkie: createTRPCRouter({
    sendAudio: sendAudioRoute,
  }),
});

export type AppRouter = typeof appRouter;
