-- Smart Payment Automator Core Schema
-- Creates tables for freelance payment automation with escrow and milestone tracking

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address text,
  role text NOT NULL CHECK (role IN ('freelancer', 'client')),
  full_name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  freelancer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  token_address text,
  token_symbol text DEFAULT 'QIE',
  escrow_contract_address text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Milestones table
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  verification_type text NOT NULL CHECK (verification_type IN ('github', 'figma', 'manual')),
  verification_config jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'verified', 'paid')),
  submitted_at timestamptz,
  verified_at timestamptz,
  paid_at timestamptz,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Verification logs table
CREATE TABLE IF NOT EXISTS verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  verification_type text NOT NULL,
  oracle_response jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES milestones(id) ON DELETE SET NULL,
  transaction_hash text NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('escrow_deposit', 'milestone_payment', 'refund')),
  amount numeric NOT NULL DEFAULT 0,
  from_address text NOT NULL,
  to_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  block_number bigint,
  created_at timestamptz DEFAULT now()
);

-- Project tokens table
CREATE TABLE IF NOT EXISTS project_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token_address text NOT NULL UNIQUE,
  token_name text NOT NULL,
  token_symbol text NOT NULL,
  total_supply numeric NOT NULL DEFAULT 0,
  decimals integer NOT NULL DEFAULT 18,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_freelancer_id ON projects(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_transactions_milestone_id ON transactions(milestone_id);
CREATE INDEX IF NOT EXISTS idx_verification_logs_milestone_id ON verification_logs(milestone_id);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tokens ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Projects policies
CREATE POLICY "Users can view projects they are part of"
  ON projects FOR SELECT
  TO authenticated
  USING (
    auth.uid() = client_id OR 
    auth.uid() = freelancer_id
  );

CREATE POLICY "Clients can create projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update their projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- Milestones policies
CREATE POLICY "Users can view milestones for their projects"
  ON milestones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = milestones.project_id
      AND (projects.client_id = auth.uid() OR projects.freelancer_id = auth.uid())
    )
  );

CREATE POLICY "Clients can create milestones"
  ON milestones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = milestones.project_id
      AND projects.client_id = auth.uid()
    )
  );

CREATE POLICY "Project members can update milestones"
  ON milestones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = milestones.project_id
      AND (projects.client_id = auth.uid() OR projects.freelancer_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = milestones.project_id
      AND (projects.client_id = auth.uid() OR projects.freelancer_id = auth.uid())
    )
  );

-- Verification logs policies
CREATE POLICY "Users can view verification logs for their milestones"
  ON verification_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM milestones
      JOIN projects ON projects.id = milestones.project_id
      WHERE milestones.id = verification_logs.milestone_id
      AND (projects.client_id = auth.uid() OR projects.freelancer_id = auth.uid())
    )
  );

-- Transactions policies
CREATE POLICY "Users can view transactions for their projects"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = transactions.project_id
      AND (projects.client_id = auth.uid() OR projects.freelancer_id = auth.uid())
    )
  );

-- Project tokens policies
CREATE POLICY "Users can view tokens for their projects"
  ON project_tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_tokens.project_id
      AND (projects.client_id = auth.uid() OR projects.freelancer_id = auth.uid())
    )
  );