/*
  # Flashcard Frenzy Database Schema

  1. New Tables
    - `users` - Store user profiles and authentication data
    - `game_rooms` - Manage multiplayer game sessions
    - `flashcards` - Store question and answer pairs
    - `game_players` - Track players in each room with scores
    - `match_history` - Record completed rounds and winners

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Users can only access their own data and public game data

  3. Real-time Features
    - Enable real-time subscriptions for game rooms and scores
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flashcards (
  id bigserial PRIMARY KEY,
  question text NOT NULL,
  answer text NOT NULL,
  category text DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  host_id uuid REFERENCES users(id) NOT NULL,
  is_active boolean DEFAULT true,
  current_card_id bigint REFERENCES flashcards(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES game_rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  score integer DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS match_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES game_rooms(id) ON DELETE CASCADE,
  card_id bigint REFERENCES flashcards(id),
  winner_id uuid REFERENCES users(id),
  completed_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Everyone can view flashcards"
  ON flashcards FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Everyone can view game rooms"
  ON game_rooms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create rooms"
  ON game_rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Room hosts can update rooms"
  ON game_rooms FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Everyone can view game players"
  ON game_players FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can join games"
  ON game_players FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own game data"
  ON game_players FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Everyone can view match history"
  ON match_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert match history"
  ON match_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

INSERT INTO flashcards (question, answer, category) VALUES
('What is the capital of France?', 'Paris', 'Geography'),
('What is 2 + 2?', '4', 'Math'),
('Who painted the Mona Lisa?', 'Leonardo da Vinci', 'Art'),
('What is the largest planet in our solar system?', 'Jupiter', 'Science'),
('What year did World War II end?', '1945', 'History'),
('What is the chemical symbol for gold?', 'Au', 'Chemistry'),
('Who wrote "To Kill a Mockingbird"?', 'Harper Lee', 'Literature'),
('What is the fastest land animal?', 'Cheetah', 'Animals'),
('What is the capital of Japan?', 'Tokyo', 'Geography'),
('What is the square root of 64?', '8', 'Math');