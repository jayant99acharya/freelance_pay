-- Add GitHub personal access token to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github_token text;

-- Add Figma token to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS figma_token text;