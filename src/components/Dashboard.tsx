import { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ProjectList } from './ProjectList';
import { WalletConnect } from './WalletConnect';
import { LogOut, Plus, Briefcase, DollarSign, CheckCircle } from 'lucide-react';

const CreateProject = lazy(() => import('./CreateProject').then(module => ({ default: module.CreateProject })));

export function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    totalEarnings: 0,
  });

  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  const loadProjects = async () => {
    if (!user) return;

    const query = supabase
      .from('projects')
      .select('*')
      .or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error loading projects:', error);
      return;
    }

    setProjects(data || []);

    const total = data?.length || 0;
    const active = data?.filter(p => p.status === 'active').length || 0;
    const completed = data?.filter(p => p.status === 'completed').length || 0;
    const totalEarnings = data
      ?.filter(p => p.status === 'completed' && p.freelancer_id === user.id)
      ?.reduce((sum, p) => sum + parseFloat(p.total_amount), 0) || 0;

    setStats({ total, active, completed, totalEarnings });
  };

  const handleProjectCreated = () => {
    setShowCreateProject(false);
    loadProjects();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <nav className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Freelance Pay</h1>
                <p className="text-xs text-slate-400">{profile?.role}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <WalletConnect />
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white mb-1">
                Welcome back, {profile?.full_name}
              </h2>
              <p className="text-slate-400">
                Manage your projects and track milestone payments
              </p>
            </div>

            {profile?.role === 'client' && (
              <button
                onClick={() => setShowCreateProject(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/50 transition-all"
              >
                <Plus className="w-5 h-5" />
                New Project
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm font-medium">Total Projects</span>
                <Briefcase className="w-5 h-5 text-slate-500" />
              </div>
              <div className="text-3xl font-bold text-white">{stats.total}</div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm font-medium">Active</span>
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              </div>
              <div className="text-3xl font-bold text-white">{stats.active}</div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm font-medium">Completed</span>
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-3xl font-bold text-white">{stats.completed}</div>
            </div>

            {profile?.role === 'freelancer' && (
              <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 backdrop-blur-xl rounded-2xl border border-emerald-500/30 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-emerald-400 text-sm font-medium">Total Earnings</span>
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-3xl font-bold text-white">
                  {stats.totalEarnings.toFixed(2)} QIE
                </div>
              </div>
            )}
          </div>
        </div>

        {showCreateProject ? (
          <Suspense fallback={<div className="text-center py-8 text-slate-400">Loading...</div>}>
            <CreateProject
              onClose={() => setShowCreateProject(false)}
              onSuccess={handleProjectCreated}
            />
          </Suspense>
        ) : (
          <ProjectList projects={projects} onUpdate={loadProjects} />
        )}
      </main>
    </div>
  );
}
