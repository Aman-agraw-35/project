/*
  # Fix room creation and user management

  1. Database Fixes
    - Ensure users table exists and works properly
    - Fix all foreign key constraints
    - Update RLS policies for room creation
    - Add proper indexes

  2. User Management
    - Create trigger for automatic user profile creation
    - Fix authentication flow

  3. Room Management
    - Allow authenticated users to create rooms
    - Fix game_players insertion
    - Enable real-time subscriptions
*/

-- Drop existing problematic constraints and recreate them properly
ALTER TABLE game_rooms DROP CONSTRAINT IF EXISTS game_rooms_host_id_fkey;
ALTER TABLE game_players DROP CONSTRAINT IF EXISTS game_players_user_id_fkey;
ALTER TABLE match_history DROP CONSTRAINT IF EXISTS match_history_winner_id_fkey;

-- Recreate users table if it doesn't exist properly
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add foreign key constraints that reference auth.users directly for rooms
ALTER TABLE game_rooms ADD CONSTRAINT game_rooms_host_id_fkey 
  FOREIGN KEY (host_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add foreign key constraints that reference auth.users directly for players  
ALTER TABLE game_players ADD CONSTRAINT game_players_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add foreign key constraints that reference auth.users directly for match history
ALTER TABLE match_history ADD CONSTRAINT match_history_winner_id_fkey 
  FOREIGN KEY (winner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create or replace user management policies
DROP POLICY IF EXISTS "Users can view all profiles" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

CREATE POLICY "Users can view all profiles"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Fix room policies
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON game_rooms;
DROP POLICY IF EXISTS "Users can update rooms" ON game_rooms;

CREATE POLICY "Authenticated users can create rooms"
  ON game_rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Users can update rooms"
  ON game_rooms FOR UPDATE
  TO authenticated
  USING (true);

-- Fix game_players policies
DROP POLICY IF EXISTS "Users can join games" ON game_players;
DROP POLICY IF EXISTS "Users can update own game data" ON game_players;
DROP POLICY IF EXISTS "Users can leave games" ON game_players;

CREATE POLICY "Users can join games"
  ON game_players FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own game data"
  ON game_players FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can leave games"
  ON game_players FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create or replace the trigger function for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, username)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
  ('What is the square root of 64?', '8', 'Math'),
  ('What is the smallest country in the world?', 'Vatican City', 'Geography'),
  ('What is 5 x 7?', '35', 'Math'),
  ('Who composed "The Four Seasons"?', 'Vivaldi', 'Music'),
  ('What gas do plants absorb from the atmosphere?', 'Carbon dioxide', 'Science'),
  ('In which year did the Titanic sink?', '1912', 'History')
) AS v(question, answer, category)
WHERE NOT EXISTS (SELECT 1 FROM flashcards LIMIT 1);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_game_rooms_active ON game_rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_game_rooms_host ON game_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_game_players_room ON game_players(room_id);
CREATE INDEX IF NOT EXISTS idx_game_players_user ON game_players(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);