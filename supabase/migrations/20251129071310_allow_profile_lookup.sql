/*
  # Allow Profile Lookup for Project Creation
  
  1. Changes
    - Add policy to allow authenticated users to view all profiles
    - This enables clients to look up freelancers by email when creating projects
    
  2. Security
    - Only authenticated users can view profiles
    - Users can still only update their own profile
*/

CREATE POLICY "Authenticated users can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);