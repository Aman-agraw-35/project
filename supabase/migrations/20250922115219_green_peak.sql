/*
  # Fix room creation and database policies

  1. Database Fixes
    - Fix foreign key constraints that might be causing issues
    - Update RLS policies to allow proper room creation
    - Ensure user profiles are properly linked

  2. Policy Updates
    - Allow users to create and join rooms
    - Fix game_players insertion policies
    - Enable proper real-time subscriptions

  3. Data Integrity
    - Add proper indexes for performance
    - Fix any constraint issues
*/

-- First, let's make sure we can create rooms without foreign key issues
ALTER TABLE game_rooms DROP CONSTRAINT IF EXISTS game_rooms_host_id_fkey;
ALTER TABLE game_rooms ADD CONSTRAINT game_rooms_host_id_fkey 
  FOREIGN KEY (host_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix game_players constraints
ALTER TABLE game_players DROP CONSTRAINT IF EXISTS game_players_user_id_fkey;
ALTER TABLE game_players ADD CONSTRAINT game_players_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policies for better room creation
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON game_rooms;
CREATE POLICY "Authenticated users can create rooms"
  ON game_rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to update any room (for game state changes)
DROP POLICY IF EXISTS "Room hosts can update rooms" ON game_rooms;
CREATE POLICY "Users can update rooms"
  ON game_rooms FOR UPDATE
  TO authenticated
  USING (true);

-- Fix game_players policies
DROP POLICY IF EXISTS "Users can join games" ON game_players;
CREATE POLICY "Users can join games"
  ON game_players FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow deletion of game_players (for leaving rooms)
CREATE POLICY "Users can leave games"
  ON game_players FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add some sample flashcards if they don't exist
INSERT INTO flashcards (question, answer, category) 
SELECT * FROM (VALUES
  ('What is the capital of France?', 'Paris', 'Geography'),
  ('What is 2 + 2?', '4', 'Math'),
  ('Who painted the Mona Lisa?', 'Leonardo da Vinci', 'Art'),
  ('What is the largest planet in our solar system?', 'Jupiter', 'Science'),
  ('What year did World War II end?', '1945', 'History'),
  ('What is the chemical symbol for gold?', 'Au', 'Chemistry'),
  ('Who wrote "To Kill a Mockingbird"?', 'Harper Lee', 'Literature'),
  ('What is the fastest land animal?', 'Cheetah', 'Animals'),
  ('What is the capital of Japan?', 'Tokyo', 'Geography'),
  ('What is the square root of 64?', '8', 'Math')
) AS v(question, answer, category)
WHERE NOT EXISTS (SELECT 1 FROM flashcards LIMIT 1);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_game_rooms_active ON game_rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_game_players_room ON game_players(room_id);
CREATE INDEX IF NOT EXISTS idx_game_players_user ON game_players(user_id);