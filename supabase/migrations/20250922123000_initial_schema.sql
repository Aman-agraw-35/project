-- 1. Create Tables
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flashcards (
  id bigserial PRIMARY KEY,
  question text NOT NULL,
  answer text NOT NULL,
  category text DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.game_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  host_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_active boolean DEFAULT true,
  current_card_id bigint REFERENCES public.flashcards(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.match_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  card_id bigint REFERENCES public.flashcards(id),
  winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Policies for users table
CREATE POLICY "Users can view all profiles" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Policies for flashcards table
CREATE POLICY "Everyone can view flashcards" ON public.flashcards FOR SELECT TO authenticated USING (true);

-- Policies for game_rooms table
CREATE POLICY "Everyone can view game rooms" ON public.game_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create rooms" ON public.game_rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Users can update rooms" ON public.game_rooms FOR UPDATE TO authenticated USING (true);

-- Policies for game_players table
CREATE POLICY "Everyone can view game players" ON public.game_players FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join games" ON public.game_players FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own game data" ON public.game_players FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can leave games" ON public.game_players FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Policies for match_history table
CREATE POLICY "Everyone can view match history" ON public.match_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can insert match history" ON public.match_history FOR INSERT TO authenticated WITH CHECK (true);

-- 4. Create Trigger for New Users
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

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Insert Initial Data
INSERT INTO public.flashcards (question, answer, category)
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
WHERE NOT EXISTS (SELECT 1 FROM public.flashcards LIMIT 1);

-- 6. Add Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_game_rooms_active ON public.game_rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_game_rooms_host ON public.game_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_game_players_room ON public.game_players(room_id);
CREATE INDEX IF NOT EXISTS idx_game_players_user ON public.game_players(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

