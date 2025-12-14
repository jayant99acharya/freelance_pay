-- Fix RLS policies for verification_logs table

-- Enable RLS on verification_logs if not already enabled
ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert their own verification logs" ON verification_logs;
DROP POLICY IF EXISTS "Users can view verification logs for their projects" ON verification_logs;

-- Create policy to allow authenticated users to insert verification logs
CREATE POLICY "Users can insert their own verification logs"
ON verification_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IN (
    SELECT client_id FROM projects WHERE id = project_id
    UNION
    SELECT freelancer_id FROM projects WHERE id = project_id
  )
);

-- Create policy to allow users to view verification logs for their projects
CREATE POLICY "Users can view verification logs for their projects"
ON verification_logs
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT client_id FROM projects WHERE id = project_id
    UNION
    SELECT freelancer_id FROM projects WHERE id = project_id
  )
);

-- Create policy to allow users to update their own verification logs
CREATE POLICY "Users can update their own verification logs"
ON verification_logs
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT client_id FROM projects WHERE id = project_id
    UNION
    SELECT freelancer_id FROM projects WHERE id = project_id
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT client_id FROM projects WHERE id = project_id
    UNION
    SELECT freelancer_id FROM projects WHERE id = project_id
  )
);

-- Grant necessary permissions
GRANT ALL ON verification_logs TO authenticated;
GRANT USAGE ON SEQUENCE verification_logs_id_seq TO authenticated;