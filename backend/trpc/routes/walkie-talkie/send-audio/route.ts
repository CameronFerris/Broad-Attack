import { publicProcedure } from '../../../create-context';
import { z } from 'zod';

export default publicProcedure
  .input(
    z.object({
      partyId: z.string(),
      userId: z.string(),
      displayName: z.string(),
      audioData: z.string(),
      timestamp: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('Received audio from', input.displayName, 'in party', input.partyId);
    
    return {
      success: true,
      timestamp: Date.now(),
    };
  });
