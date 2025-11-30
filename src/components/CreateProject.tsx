import { useState } from 'react';
import { X, Plus, Trash2, GitBranch, Figma } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { createProjectToken } from '../lib/tokenization';
import { deployEscrowContract } from '../lib/web3';

interface Milestone {
  title: string;
  description: string;
  amount: string;
  verificationType: 'github' | 'figma' | 'manual';
  verificationConfig: any;
}

interface CreateProjectProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateProject({ onClose, onSuccess }: CreateProjectProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [freelancerEmail, setFreelancerEmail] = useState('');
  const [githubRepoUrl, setGithubRepoUrl] = useState('');
  const [useProjectToken, setUseProjectToken] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [milestones, setMilestones] = useState<Milestone[]>([
    {
      title: '',
      description: '',
      amount: '',
      verificationType: 'manual',
      verificationConfig: {},
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deploymentStatus, setDeploymentStatus] = useState('');
  const [deployedContractAddress, setDeployedContractAddress] = useState('');
  const [skipContractDeployment, setSkipContractDeployment] = useState(false);

  const addMilestone = () => {
    setMilestones([
      ...milestones,
      {
        title: '',
        description: '',
        amount: '',
        verificationType: 'manual',
        verificationConfig: {},
      },
    ]);
  };

  const removeMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const updateMilestone = (index: number, field: keyof Milestone, value: any) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    setMilestones(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!user) throw new Error('Not authenticated');
      if (!freelancerEmail) throw new Error('Freelancer email is required');
      if (!githubRepoUrl) throw new Error('GitHub repository URL is required');

      const { data: freelancerProfile } = await supabase
        .from('profiles')
        .select('id, wallet_address')
        .eq('email', freelancerEmail.trim())
        .eq('role', 'freelancer')
        .maybeSingle();

      if (!freelancerProfile) {
        throw new Error(`Freelancer with email ${freelancerEmail} not found. Please ensure they have registered as a freelancer.`);
      }

      if (!freelancerProfile.wallet_address) {
        throw new Error('Freelancer has not connected their wallet. Please ask them to connect their wallet first.');
      }

      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('wallet_address')
        .eq('id', user.id)
        .single();

      if (!clientProfile?.wallet_address) {
        throw new Error('Please connect your wallet first before creating a project.');
      }

      const freelancerId = freelancerProfile.id;

      const totalAmount = milestones.reduce(
        (sum, m) => sum + parseFloat(m.amount || '0'),
        0
      );

      // Always use zero address for native QIE payments
      const tokenAddress = '0x0000000000000000000000000000000000000000';
      const tokenSymbolToUse = 'QIE';
      const milestoneAmounts = milestones.map(m => m.amount);

      // STEP 1: Deploy contract FIRST (unless skipped)
      let escrowAddress = null;

      if (!skipContractDeployment) {
        setDeploymentStatus('Deploying escrow contract to blockchain...');
        try {
          escrowAddress = await deployEscrowContract(
            clientProfile.wallet_address,
            freelancerProfile.wallet_address,
            tokenAddress,
            milestoneAmounts
          );

          if (!escrowAddress) {
            throw new Error('Failed to deploy escrow contract - no address returned');
          }
        } catch (deployError: any) {
          throw new Error(`Contract deployment failed: ${deployError.message || deployError}`);
        }
      } else {
        setDeploymentStatus('Skipping contract deployment...');
      }

      // STEP 2: Create database records
      setDeploymentStatus('Saving project to database...');

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          title,
          description,
          client_id: user.id,
          freelancer_id: freelancerId,
          total_amount: totalAmount,
          token_address: tokenAddress,
          token_symbol: tokenSymbolToUse,
          github_repo_url: githubRepoUrl,
          escrow_contract_address: escrowAddress,
          status: escrowAddress ? 'active' : 'pending_contract',
        })
        .select()
        .single();

      if (projectError) throw projectError;

      const milestoneInserts = milestones.map((m, index) => ({
        project_id: project.id,
        title: m.title,
        description: m.description,
        amount: parseFloat(m.amount),
        verification_type: m.verificationType,
        verification_config: m.verificationConfig,
        order_index: index,
        status: 'pending',
      }));

      const { data: insertedMilestones, error: milestonesError } = await supabase
        .from('milestones')
        .insert(milestoneInserts)
        .select();

      if (milestonesError) throw milestonesError;

      if (insertedMilestones && insertedMilestones.length > 0) {
        await supabase
          .from('milestones')
          .update({ status: 'in_progress' })
          .eq('id', insertedMilestones[0].id);
      }

      if (escrowAddress) {
        setDeploymentStatus('Contract deployed successfully!');
        setDeployedContractAddress(escrowAddress);
      } else {
        setDeploymentStatus('Project created successfully!');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
        return;
      }

      const firstMilestone = milestones[0];
      if (firstMilestone.verificationType === 'github' && firstMilestone.verificationConfig.githubToken) {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-oracle`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                owner: firstMilestone.verificationConfig.owner,
                repo: firstMilestone.verificationConfig.repo,
                githubToken: firstMilestone.verificationConfig.githubToken,
                minCommits: firstMilestone.verificationConfig.minCommits || 1,
                projectId: project.id,
              }),
            }
          );
          await response.json();
        } catch (oracleError) {
          console.error('Failed to fetch initial commits:', oracleError);
        }
      }

      // Don't auto-close, show success state with contract address
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
      setDeploymentStatus('');
    } finally {
      setLoading(false);
    }
  };

  // Show success modal if contract is deployed
  if (deployedContractAddress) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Project Created Successfully!</h2>
          <p className="text-slate-400">Your escrow contract has been deployed to the QIE blockchain</p>
        </div>

        <div className="bg-slate-900/50 rounded-xl p-6 mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Escrow Contract Address
          </label>
          <div className="flex items-center gap-3">
            <code className="flex-1 px-4 py-3 bg-slate-800 rounded-lg text-emerald-400 font-mono text-sm break-all">
              {deployedContractAddress}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(deployedContractAddress);
                alert('Contract address copied to clipboard!');
              }}
              className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Copy
            </button>
          </div>
          <p className="text-slate-500 text-sm mt-3">
            All milestone payments will be processed through this smart contract
          </p>
        </div>

        <button
          onClick={() => {
            onSuccess();
            onClose();
          }}
          className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/50 transition-all"
        >
          View Project Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Create New Project</h2>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Project Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Website Redesign"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Freelancer Email
            </label>
            <input
              type="email"
              value={freelancerEmail}
              onChange={(e) => setFreelancerEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="freelancer@example.com"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            GitHub Repository URL
          </label>
          <input
            type="url"
            value={githubRepoUrl}
            onChange={(e) => setGithubRepoUrl(e.target.value)}
            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            placeholder="https://github.com/username/repository"
            required
          />
          <p className="text-xs text-slate-500 mt-1">Commits will be tracked automatically from this repository</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Project Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            placeholder="Describe the project scope and requirements..."
            required
          />
        </div>

        <div className="border border-amber-500/30 rounded-xl p-4 bg-amber-500/5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={skipContractDeployment}
              onChange={(e) => setSkipContractDeployment(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-slate-600 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
            />
            <div>
              <div className="text-white font-medium">Skip Contract Deployment (Deploy Later)</div>
              <div className="text-sm text-slate-400 mt-1">
                Create project without deploying the escrow contract. Useful if the QIE blockchain RPC is having issues. You can deploy the contract later from the project page.
              </div>
            </div>
          </label>
        </div>

        {/* Project tokens disabled - requires actual ERC20 deployment
        <div className="border border-slate-700 rounded-xl p-4 bg-slate-900/30">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={useProjectToken}
              onChange={(e) => setUseProjectToken(e.target.checked)}
              className="w-5 h-5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
            />
            <div>
              <div className="text-white font-medium">Create Project-Specific Token</div>
              <div className="text-sm text-slate-400">
                Issue a custom token for this project via QIEDEX
              </div>
            </div>
          </label>

          {useProjectToken && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Token Name
                </label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  placeholder="My Project Token"
                  required={useProjectToken}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Token Symbol
                </label>
                <input
                  type="text"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  placeholder="MPT"
                  maxLength={10}
                  required={useProjectToken}
                />
              </div>
            </div>
          )}
        </div>
        */}

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Milestones</h3>
            <button
              type="button"
              onClick={addMilestone}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Milestone
            </button>
          </div>

          <div className="space-y-4">
            {milestones.map((milestone, index) => (
              <div
                key={index}
                className="p-4 bg-slate-900/50 border border-slate-700 rounded-xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-slate-400">
                    Milestone {index + 1}
                  </span>
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(index)}
                      className="p-1 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    value={milestone.title}
                    onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                    className="px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    placeholder="Milestone title"
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={milestone.amount}
                    onChange={(e) => updateMilestone(index, 'amount', e.target.value)}
                    className="px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    placeholder="Amount (QIE)"
                    required
                  />
                </div>

                <textarea
                  value={milestone.description}
                  onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 mb-4"
                  placeholder="Describe deliverables..."
                  required
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateMilestone(index, 'verificationType', 'manual')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      milestone.verificationType === 'manual'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-800/50 text-slate-400 border border-slate-600'
                    }`}
                  >
                    Manual
                  </button>
                  <button
                    type="button"
                    onClick={() => updateMilestone(index, 'verificationType', 'github')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      milestone.verificationType === 'github'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-800/50 text-slate-400 border border-slate-600'
                    }`}
                  >
                    <GitBranch className="w-4 h-4" />
                    GitHub
                  </button>
                  <button
                    type="button"
                    onClick={() => updateMilestone(index, 'verificationType', 'figma')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      milestone.verificationType === 'figma'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-800/50 text-slate-400 border border-slate-600'
                    }`}
                  >
                    <Figma className="w-4 h-4" />
                    Figma
                  </button>
                </div>

                {milestone.verificationType === 'github' && (
                  <div className="space-y-3 mt-4">
                    <input
                      type="text"
                      placeholder="GitHub Personal Access Token"
                      className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500"
                      onChange={(e) =>
                        updateMilestone(index, 'verificationConfig', {
                          ...milestone.verificationConfig,
                          githubToken: e.target.value,
                        })
                      }
                      required
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Repository owner"
                        className="px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500"
                        onChange={(e) =>
                          updateMilestone(index, 'verificationConfig', {
                            ...milestone.verificationConfig,
                            owner: e.target.value,
                          })
                        }
                        required
                      />
                      <input
                        type="text"
                        placeholder="Repository name"
                        className="px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500"
                        onChange={(e) =>
                          updateMilestone(index, 'verificationConfig', {
                            ...milestone.verificationConfig,
                            repo: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <input
                      type="number"
                      min="1"
                      placeholder="Required commits (minimum)"
                      className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500"
                      onChange={(e) =>
                        updateMilestone(index, 'verificationConfig', {
                          ...milestone.verificationConfig,
                          minCommits: parseInt(e.target.value) || 1,
                        })
                      }
                      required
                    />
                  </div>
                )}

                {milestone.verificationType === 'figma' && (
                  <input
                    type="text"
                    placeholder="Figma file key"
                    className="w-full px-3 py-2 mt-4 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500"
                    onChange={(e) =>
                      updateMilestone(index, 'verificationConfig', {
                        ...milestone.verificationConfig,
                        fileKey: e.target.value,
                      })
                    }
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {deploymentStatus && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400 text-sm flex items-center gap-3">
            <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
            {deploymentStatus}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-slate-700/50 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/50 transition-all disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}
