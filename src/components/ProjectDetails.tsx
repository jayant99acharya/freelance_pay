import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Clock, Play, ExternalLink, RefreshCw, GitBranch } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { verifyAndPayMilestone } from '../lib/web3';

interface ProjectDetailsProps {
  project: any;
  onClose: () => void;
  onUpdate: () => void;
}

export function ProjectDetails({ project, onClose, onUpdate }: ProjectDetailsProps) {
  const { user } = useAuth();
  const [milestones, setMilestones] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingCommits, setCheckingCommits] = useState(false);
  const [showContractInput, setShowContractInput] = useState(false);
  const [contractAddress, setContractAddress] = useState('');

  useEffect(() => {
    loadMilestones();
    loadTransactions();
    checkGitHubCommits();
  }, [project.id]);

  const loadMilestones = async () => {
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', project.id)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Error loading milestones:', error);
      return;
    }

    setMilestones(data || []);
  };

  const loadTransactions = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading transactions:', error);
      return;
    }

    setTransactions(data || []);
  };

  const checkGitHubCommits = async () => {
    setCheckingCommits(true);
    try {
      const inProgressMilestone = milestones.find(m => m.status === 'in_progress' && m.verification_type === 'github');

      if (inProgressMilestone?.verification_config?.githubToken) {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-oracle`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              owner: inProgressMilestone.verification_config.owner,
              repo: inProgressMilestone.verification_config.repo,
              githubToken: inProgressMilestone.verification_config.githubToken,
              minCommits: inProgressMilestone.verification_config.minCommits || 1,
              projectId: project.id,
            }),
          }
        );

        const { data: updatedProject } = await supabase
          .from('projects')
          .select('*')
          .eq('id', project.id)
          .single();

        if (updatedProject) {
          Object.assign(project, updatedProject);
        }

        await loadMilestones();
      }
    } catch (error) {
      console.error('Error checking commits:', error);
    } finally {
      setCheckingCommits(false);
    }
  };

  const handleVerifyMilestone = async (milestoneId: string) => {
    setLoading(true);
    try {
      const milestone = milestones.find((m) => m.id === milestoneId);
      if (!milestone) return;

      if (milestone.verification_type === 'github') {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-oracle`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              owner: milestone.verification_config.owner,
              repo: milestone.verification_config.repo,
              githubToken: milestone.verification_config.githubToken,
              minCommits: milestone.verification_config.minCommits || 1,
              projectId: project.id,
            }),
          }
        );

        const result = await response.json();

        await supabase.from('verification_logs').insert({
          milestone_id: milestoneId,
          verification_type: 'github',
          oracle_response: result,
          status: result.verified ? 'success' : 'failed',
        });

        if (result.verified) {
          await supabase
            .from('milestones')
            .update({
              status: 'verified',
              verified_at: new Date().toISOString(),
            })
            .eq('id', milestoneId);
        }
      } else if (milestone.verification_type === 'figma') {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/figma-oracle`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileKey: milestone.verification_config.fileKey,
              figmaToken: milestone.verification_config.figmaToken || '',
              minVersions: 1,
            }),
          }
        );

        const result = await response.json();

        await supabase.from('verification_logs').insert({
          milestone_id: milestoneId,
          verification_type: 'figma',
          oracle_response: result,
          status: result.verified ? 'success' : 'failed',
        });

        if (result.verified) {
          await supabase
            .from('milestones')
            .update({
              status: 'verified',
              verified_at: new Date().toISOString(),
            })
            .eq('id', milestoneId);
        }
      } else {
        await supabase
          .from('milestones')
          .update({
            status: 'verified',
            verified_at: new Date().toISOString(),
          })
          .eq('id', milestoneId);
      }

      await loadMilestones();

      const { data: updatedProject } = await supabase
        .from('projects')
        .select('*')
        .eq('id', project.id)
        .single();

      if (updatedProject) {
        Object.assign(project, updatedProject);
      }
    } catch (error) {
      console.error('Error verifying milestone:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayMilestone = async (milestoneId: string) => {
    setLoading(true);
    try {
      const milestone = milestones.find(m => m.id === milestoneId);
      if (!milestone) return;

      if (!project.escrow_contract_address) {
        throw new Error('No escrow contract found for this project');
      }

      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('wallet_address')
        .eq('id', project.client_id)
        .single();

      if (!clientProfile?.wallet_address) {
        throw new Error('Client wallet address not found');
      }

      const verificationHash = milestone.verification_config?.verificationHash || '0x0000000000000000000000000000000000000000000000000000000000000000';

      const txHash = await verifyAndPayMilestone(
        project.escrow_contract_address,
        milestone.order_index,
        verificationHash
      );

      await supabase.from('transactions').insert({
        project_id: project.id,
        milestone_id: milestoneId,
        transaction_hash: txHash,
        transaction_type: 'milestone_payment',
        amount: milestone.amount,
        from_address: project.escrow_contract_address,
        to_address: project.freelancer_id,
        status: 'confirmed',
      });

      await supabase
        .from('milestones')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', milestoneId);

      await loadMilestones();
      await loadTransactions();

      const { data: allMilestones } = await supabase
        .from('milestones')
        .select('status')
        .eq('project_id', project.id);

      const allPaid = allMilestones?.every(m => m.status === 'paid');

      if (allPaid) {
        await supabase
          .from('projects')
          .update({ status: 'completed' })
          .eq('id', project.id);

        const { data: updatedProject } = await supabase
          .from('projects')
          .select('*')
          .eq('id', project.id)
          .single();

        if (updatedProject) {
          Object.assign(project, updatedProject);
        }
      }
    } catch (error: any) {
      console.error('Error paying milestone:', error);
      const errorMessage = error.message || 'Failed to release payment';

      if (errorMessage.includes('Only client can call this')) {
        const { data: clientProfile } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('id', project.client_id)
          .single();

        alert(`This action requires the client wallet. Please switch MetaMask to: ${clientProfile?.wallet_address || 'the client account'}`);
      } else {
        alert(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitMilestone = async (milestoneId: string) => {
    setLoading(true);
    try {
      await supabase
        .from('milestones')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', milestoneId);

      loadMilestones();
    } catch (error) {
      console.error('Error submitting milestone:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContractAddress = async () => {
    if (!contractAddress.trim()) return;

    setLoading(true);
    try {
      await supabase
        .from('projects')
        .update({ escrow_contract_address: contractAddress.trim() })
        .eq('id', project.id);

      project.escrow_contract_address = contractAddress.trim();
      setShowContractInput(false);
      setContractAddress('');
    } catch (error) {
      console.error('Error saving contract address:', error);
      alert('Failed to save contract address');
    } finally {
      setLoading(false);
    }
  };

  const isClient = user?.id === project.client_id;
  const isFreelancer = user?.id === project.freelancer_id;

  const getMilestoneStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'verified':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'submitted':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'in_progress':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div>
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Projects
      </button>

      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-3xl font-bold text-white">{project.title}</h1>
              <div className={`px-3 py-1 rounded-lg border text-sm font-medium ${
                project.status === 'completed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                project.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                project.status === 'cancelled' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                'bg-slate-500/10 text-slate-400 border-slate-500/30'
              }`}>
                {project.status === 'completed' && '✓ Completed'}
                {project.status === 'active' && 'In Progress'}
                {project.status === 'cancelled' && 'Cancelled'}
                {project.status === 'draft' && 'Draft'}
              </div>
            </div>
            <p className="text-slate-400">{project.description}</p>
          </div>
          <div className="flex items-start gap-4">
            {project.github_repo_url && project.status !== 'completed' && (
              <button
                onClick={checkGitHubCommits}
                disabled={checkingCommits}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${checkingCommits ? 'animate-spin' : ''}`} />
                Check Commits
              </button>
            )}
            <div className="text-right">
              <div className="text-sm text-slate-500 mb-1">Total Value</div>
              <div className="text-2xl font-bold text-white">
                {parseFloat(project.total_amount).toFixed(2)} {project.token_symbol}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {project.github_repo_url && (
            <div className="flex items-center gap-2 p-3 bg-slate-900/50 border border-slate-700 rounded-xl">
              <ExternalLink className="w-5 h-5 text-slate-400" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500 mb-1">GitHub Repository</div>
                <a
                  href={project.github_repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-emerald-400 hover:text-emerald-300 truncate block"
                >
                  {project.github_repo_url.replace('https://github.com/', '')}
                </a>
              </div>
            </div>
          )}

          {project.commit_count !== null && project.commit_count !== undefined && (
            <div className="flex items-center gap-2 p-3 bg-slate-900/50 border border-slate-700 rounded-xl">
              <CheckCircle className="w-5 h-5 text-slate-400" />
              <div className="flex-1">
                <div className="text-xs text-slate-500 mb-1">Total Commits</div>
                <div className="text-sm text-white font-medium">{project.commit_count} commits</div>
              </div>
            </div>
          )}
        </div>

        {project.latest_commit_sha && (
          <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl mb-4">
            <CheckCircle className="w-5 h-5 text-blue-400" />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-blue-400 font-medium">
                Latest Commit: {project.latest_commit_sha.slice(0, 7)}
              </span>
            </div>
            {project.latest_commit_url && (
              <a
                href={project.latest_commit_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        )}

        {project.escrow_contract_address ? (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-sm text-emerald-400 font-medium">
              Escrow Contract: {project.escrow_contract_address.slice(0, 8)}...
              {project.escrow_contract_address.slice(-6)}
            </span>
            <a
              href={`https://testnet.qie.digital/address/${project.escrow_contract_address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-emerald-400 hover:text-emerald-300"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ) : isClient && !showContractInput ? (
          <button
            onClick={() => setShowContractInput(true)}
            className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl hover:bg-yellow-500/20 transition-colors w-full"
          >
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-sm text-yellow-400 font-medium">
              Add Escrow Contract Address
            </span>
          </button>
        ) : isClient && showContractInput ? (
          <div className="p-3 bg-slate-900/50 border border-slate-700 rounded-xl">
            <div className="flex gap-2">
              <input
                type="text"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="0x..."
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleSaveContractAddress}
                disabled={loading || !contractAddress.trim()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowContractInput(false);
                  setContractAddress('');
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8">
        <h2 className="text-2xl font-bold text-white mb-6">Milestones</h2>

        {project.status === 'completed' && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-blue-400" />
              <div>
                <h3 className="text-lg font-bold text-blue-400">Project Completed! 🎉</h3>
                <p className="text-sm text-slate-300">All milestones have been paid and the project is now complete.</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {milestones.map((milestone, index) => (
            <div
              key={milestone.id}
              className="p-6 bg-slate-900/50 border border-slate-700 rounded-xl"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-medium text-slate-500">
                      Milestone {index + 1}
                    </span>
                    <div
                      className={`px-3 py-1 rounded-lg border text-xs font-medium ${getMilestoneStatusColor(
                        milestone.status
                      )}`}
                    >
                      {milestone.status}
                    </div>
                    <div className="px-3 py-1 rounded-lg bg-slate-700/50 text-slate-300 text-xs font-medium">
                      {milestone.verification_type}
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">
                    {milestone.title}
                  </h3>
                  <p className="text-slate-400 text-sm">{milestone.description}</p>
                  {milestone.verification_type === 'github' && milestone.verification_config?.minCommits && (
                    <div className="mt-2 text-xs text-slate-500">
                      Required commits: {milestone.verification_config.minCommits}
                    </div>
                  )}
                </div>
                <div className="text-right ml-4">
                  <div className="text-2xl font-bold text-white">
                    {parseFloat(milestone.amount).toFixed(2)}
                  </div>
                  <div className="text-sm text-slate-500">{project.token_symbol}</div>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                {isFreelancer && milestone.status === 'in_progress' && (
                  <button
                    onClick={() => handleSubmitMilestone(milestone.id)}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Submit for Review
                  </button>
                )}

                {isClient && milestone.status === 'submitted' && (
                  <button
                    onClick={() => handleVerifyMilestone(milestone.id)}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Verify Completion
                  </button>
                )}

                {isClient && milestone.status === 'verified' && (
                  <>
                    <button
                      onClick={() => handlePayMilestone(milestone.id)}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      <Play className="w-4 h-4" />
                      Release Payment
                    </button>
                    <div className="text-xs text-slate-500 flex items-center">
                      ⚠️ Ensure MetaMask is connected to the client account
                    </div>
                  </>
                )}

                {milestone.status === 'paid' && (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Payment Released</span>
                  </div>
                )}

                {milestone.status === 'pending' && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">Waiting to Start</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {transactions.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Transactions</h2>

          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-700 rounded-xl hover:border-emerald-500/30 transition-all"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-sm font-medium text-white">
                      {tx.transaction_type === 'milestone_payment' && 'Milestone Payment'}
                      {tx.transaction_type === 'escrow_deposit' && 'Escrow Deposit'}
                      {tx.transaction_type === 'refund' && 'Refund'}
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      tx.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400' :
                      tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {tx.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-mono">
                      {tx.transaction_hash.slice(0, 10)}...{tx.transaction_hash.slice(-8)}
                    </span>
                    <a
                      href={`https://testnet.qie.digital/tx/${tx.transaction_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-white">
                    {parseFloat(tx.amount).toFixed(2)} {project.token_symbol}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
