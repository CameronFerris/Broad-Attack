# Multiplayer Party Setup Guide

## ✅ What's Working

Your multiplayer system is now properly configured with:

1. **Automatic Party Integration** - When users create/join a party, their runs automatically submit to the party leaderboard
2. **Real-time Updates** - Party members and race results update in real-time using Supabase subscriptions
3. **Ghost Race Storage** - All runs are automatically uploaded as ghost races to the database
4. **2-Player Parties** - Max 2 members per party with invitation code system

## 🔧 Required Setup Steps

### Step 1: Get Your Real Supabase API Key

Your current Supabase anon key is a placeholder. To make multiplayer work:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project (ref: `cadvrekczuimrceddfdj`)
3. Navigate to **Settings** → **API**
4. Copy the `anon` `public` key (starts with `eyJ...`)
5. Replace the dummy key in `lib/supabase.ts`:

```typescript
// Replace this line in lib/supabase.ts:
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhZHZyZWtjenVpbXJjZWRkZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTk5OTk5OTksImV4cCI6MjAxNTU3NTk5OX0.dummy';

// With your actual anon key:
const supabaseAnonKey = 'YOUR_ACTUAL_ANON_KEY_HERE';
```

### Step 2: Verify Database Setup

Make sure you've run all the SQL commands in `lib/database-schema.sql` in your Supabase SQL Editor.

Check if tables exist:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

You should see:
- `parties`
- `party_members`
- `race_results`
- `ghost_races`

## 🎮 How to Use Multiplayer

### For the Host (Creating a Party):

1. Open the **Multiplayer** tab
2. Tap **Create Party**
3. Enter your display name (e.g., "Alex")
4. Tap **Create Party**
5. You'll get a 6-character invitation code (e.g., "ABC123")
6. Share this code with your friend via:
   - Copy button (copies to clipboard)
   - Share button (opens system share sheet)

### For the Guest (Joining a Party):

1. Open the **Multiplayer** tab
2. Tap **Join Party**
3. Enter the invitation code you received
4. Enter your display name
5. Tap **Join Party**
6. You'll see both members in the party

### Racing Together:

1. **Both players** must have the same start/finish checkpoints
2. Go to the **Map** tab
3. Place a **Start** checkpoint by:
   - Tapping "Start" button
   - Tapping on the map
4. Place a **Finish** checkpoint similarly
5. Drive through Start → Finish
6. Your time automatically submits to the party leaderboard
7. Check the **Multiplayer** tab to see both times

## 🔍 Troubleshooting

### Issue: "Failed to create party"

**Cause**: Supabase connection issue  
**Fix**: 
- Verify your Supabase anon key is correct
- Check Supabase project is active
- Check browser console for errors

### Issue: "Failed to join party"

**Possible Causes**:
1. Invalid invitation code
2. Party is full (already has 2 members)
3. Party has been closed

**Fix**:
- Double-check the code
- Create a new party if needed

### Issue: Race results not showing

**Possible Causes**:
1. Not in a party when racing
2. Checkpoints not set up
3. Didn't complete the run (Start → Finish)

**Fix**:
- Make sure you're in a party (check Multiplayer tab)
- Place both Start and Finish checkpoints
- Complete a full run

### Issue: Second player can't see first player's time

**Possible Causes**:
1. Real-time subscriptions not working
2. Database connection issue

**Fix**:
- Leave and rejoin the party
- Check Supabase dashboard for realtime errors
- Verify RLS policies are set correctly

## 📊 Database Structure

### parties
- `id` - Unique party ID (UUID)
- `invitation_code` - 6-character code
- `creator_id` - User who created the party
- `max_members` - Always 2 for your app
- `status` - 'active' or 'completed'

### party_members
- `party_id` - References party
- `user_id` - Unique user identifier
- `display_name` - Player's chosen name

### race_results
- `party_id` - Which party this result belongs to
- `user_id` - Who set this time
- `duration` - Time in milliseconds
- `average_speed` - Average speed during run
- `max_speed` - Maximum speed reached
- `ghost_path` - Array of position points for replay

## 🚀 Testing Checklist

### Single Device Testing:
1. ✅ Create a party → Get invitation code
2. ✅ Leave party
3. ✅ Join party with code → Success
4. ✅ Set up checkpoints
5. ✅ Complete a run → See result in Multiplayer tab

### Two Device Testing:
1. ✅ Device A creates party
2. ✅ Device A shares code
3. ✅ Device B joins with code
4. ✅ Both devices see 2 members
5. ✅ Device A completes run
6. ✅ Device B sees Device A's time immediately
7. ✅ Device B completes run
8. ✅ Both see leaderboard with both times

## 💡 Pro Tips

1. **Same Course Required**: Both players must use the same Start/Finish checkpoints. The course is identified by checkpoint IDs.

2. **Persistent Parties**: Parties remain active until you leave. You can close the app and rejoin later.

3. **Multiple Runs**: You can do multiple runs in the same party. The leaderboard shows all results sorted by fastest time.

4. **Ghost Races**: Every run is also saved as a ghost race for solo practice later.

5. **Display Names**: Choose unique names so you can tell who's who in the results!

## 🎯 Next Steps

After setting up your Supabase key:

1. Test creating a party
2. Test the invitation code
3. Complete a test run
4. Verify the time appears in the leaderboard
5. Test with a friend on a different device

If everything works, you're ready to race! 🏁
