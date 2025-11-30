/*
  # Add GitHub Tracking to Projects
  
  1. Changes
    - Add `github_repo_url` column to store the GitHub repository URL
    - Add `commit_count` column to track total number of commits
    - Add `latest_commit_sha` column to store the most recent commit SHA
    - Add `latest_commit_url` column to store direct link to the latest commit
    
  2. Notes
    - All columns are optional to maintain backwards compatibility
    - commit_count defaults to 0
    - These fields will be updated by the github-oracle edge function
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'github_repo_url'
  ) THEN
    ALTER TABLE projects ADD COLUMN github_repo_url text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'commit_count'
  ) THEN
    ALTER TABLE projects ADD COLUMN commit_count integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'latest_commit_sha'
  ) THEN
    ALTER TABLE projects ADD COLUMN latest_commit_sha text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'latest_commit_url'
  ) THEN
    ALTER TABLE projects ADD COLUMN latest_commit_url text;
  END IF;
END $$;