# Database Setup Instructions

## Step 1: Get your Supabase Anon Key

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **anon/public** key

## Step 2: Update the Supabase Configuration

Open `lib/supabase.ts` and replace the placeholder anon key with your actual key:

```typescript
const supabaseAnonKey = 'YOUR_ACTUAL_ANON_KEY_HERE';
```

## Step 3: Run the Database Schema

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project  
3. Go to **SQL Editor**
4. Copy the contents of `lib/database-schema.sql`
5. Paste it into the SQL Editor
6. Click **Run** to execute the schema

This will create all the necessary tables:
- `ghost_races` - stores best lap times and ghost data for courses
- `parties` - stores multiplayer party information
- `party_members` - stores party membership data
- `race_results` - stores race results for multiplayer races

## Features Implemented

### 1. Ghost Racing
- Your best lap time for each course is automatically saved locally
- When you start a new lap on the same course, your ghost appears
- Race against your own best time!

### 2. Multiplayer Party Racing
- Create a party and get a unique 6-character invitation code
- Share the code with a friend (max 2 players per party)
- Both players race on the same course
- Times are automatically submitted to the database
- Real-time leaderboard shows who's fastest!

### 3. Online Ghost Leaderboards (Future Enhancement)
- The database is set up to store ghost races from all users
- You can extend the app to download and race against other players' ghosts
- Just use the `getGhostRacesForCourse()` function to fetch top times

## How to Use

### Ghost Racing (Local)
1. Go to the **Map** tab
2. Place Start and Finish checkpoints
3. Drive through the Start to begin timing
4. Drive through the Finish to stop timing
5. Toggle the Ghost button (bottom left) to enable/disable
6. On your next lap, race against your previous best time!

### Multiplayer Racing
1. Go to the **Multiplayer** tab
2. One player clicks "Create Party"
   - Enter your display name
   - Share the invitation code with your friend
3. Friend clicks "Join Party"
   - Enter the invitation code
   - Enter their display name
4. Both players go to the **Map** tab
5. Complete a lap (Start → Finish)
6. Times automatically appear in the Multiplayer tab leaderboard!

## Troubleshooting

- **"Failed to create party"**: Make sure you've set up the database schema and updated the anon key
- **"Party not found"**: Double-check the invitation code (case-sensitive)
- **Times not appearing**: Ensure you have Start and Finish checkpoints placed on the map
