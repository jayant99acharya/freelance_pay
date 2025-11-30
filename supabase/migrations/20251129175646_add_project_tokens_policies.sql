/*
  # Add RLS policies for project_tokens

  1. Security
    - Add policy for authenticated users to insert project tokens for their own projects
    - Add policy for users to view project tokens for projects they're involved in
*/

CREATE POLICY "Users can insert tokens for their projects"
  ON project_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_tokens.project_id
      AND (projects.client_id = auth.uid() OR projects.freelancer_id = auth.uid())
    )
  );

CREATE POLICY "Users can view project tokens"
  ON project_tokens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_tokens.project_id
      AND (projects.client_id = auth.uid() OR projects.freelancer_id = auth.uid())
    )
  );