-- Fix ALL RLS policies with performance optimizations

-- 1. Fix profiles table policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Recreate profiles policies with optimized auth.uid() calls
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (id = (SELECT auth.uid()));

CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (id = (SELECT auth.uid()));

-- 2. Fix verification_logs table - complete recreation
DROP POLICY IF EXISTS "Users can insert their own verification logs" ON verification_logs;
DROP POLICY IF EXISTS "Users can view verification logs for their projects" ON verification_logs;
DROP POLICY IF EXISTS "Users can update their own verification logs" ON verification_logs;

-- Enable RLS
ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;

-- Create optimized policies for verification_logs
CREATE POLICY "Users can insert verification logs"
ON verification_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = verification_logs.project_id 
    AND (projects.client_id = (SELECT auth.uid()) OR projects.freelancer_id = (SELECT auth.uid()))
  )
);

CREATE POLICY "Users can view verification logs"
ON verification_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = verification_logs.project_id 
    AND (projects.client_id = (SELECT auth.uid()) OR projects.freelancer_id = (SELECT auth.uid()))
  )
);

CREATE POLICY "Users can update verification logs"
ON verification_logs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = verification_logs.project_id 
    AND (projects.client_id = (SELECT auth.uid()) OR projects.freelancer_id = (SELECT auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = verification_logs.project_id 
    AND (projects.client_id = (SELECT auth.uid()) OR projects.freelancer_id = (SELECT auth.uid()))
  )
);

-- 3. Fix projects table policies if they exist
DROP POLICY IF EXISTS "Users can view their projects" ON projects;
DROP POLICY IF EXISTS "Users can create projects as client" ON projects;
DROP POLICY IF EXISTS "Users can update their projects" ON projects;

CREATE POLICY "Users can view their projects"
ON projects
FOR SELECT
TO authenticated
USING (
  client_id = (SELECT auth.uid()) OR 
  freelancer_id = (SELECT auth.uid())
);

CREATE POLICY "Users can create projects as client"
ON projects
FOR INSERT
TO authenticated
WITH CHECK (client_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their projects"
ON projects
FOR UPDATE
TO authenticated
USING (
  client_id = (SELECT auth.uid()) OR 
  freelancer_id = (SELECT auth.uid())
)
WITH CHECK (
  client_id = (SELECT auth.uid()) OR 
  freelancer_id = (SELECT auth.uid())
);

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_freelancer_id ON projects(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_verification_logs_project_id ON verification_logs(project_id);

-- 5. Grant necessary permissions
GRANT ALL ON verification_logs TO authenticated;
GRANT ALL ON projects TO authenticated;
GRANT ALL ON profiles TO authenticated;

-- Grant sequence permissions if they exist
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'verification_logs_id_seq') THEN
    GRANT USAGE ON SEQUENCE verification_logs_id_seq TO authenticated;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'projects_id_seq') THEN
    GRANT USAGE ON SEQUENCE projects_id_seq TO authenticated;
  END IF;
END $$;

-- 6. Alternative: Create a simpler policy for verification_logs if the above doesn't work
-- This is a fallback that allows all authenticated users to manage verification logs
-- Uncomment if needed:
/*
DROP POLICY IF EXISTS "Allow all authenticated users" ON verification_logs;
CREATE POLICY "Allow all authenticated users"
ON verification_logs
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
*/