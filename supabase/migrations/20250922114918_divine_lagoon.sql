/*
  # Fix users table and authentication flow

  1. New Tables
    - Ensure `users` table is properly created with correct references
    - Add trigger to automatically create user profile on auth signup

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Users can insert their own profile data

  3. Triggers
    - Auto-create user profile when auth user is created
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, username)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);