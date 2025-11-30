import { Briefcase, Clock, CheckCircle, XCircle, FileText } from 'lucide-react';

interface ProjectCardProps {
  project: any;
  onClick: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'completed':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'cancelled':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Clock className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div
      onClick={onClick}
      className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 hover:border-emerald-500/50 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className={`px-3 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${getStatusColor(project.status)}`}>
          {getStatusIcon(project.status)}
          {project.status}
        </div>
      </div>

      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
        {project.title}
      </h3>

      <p className="text-slate-400 text-sm mb-4 line-clamp-2">
        {project.description}
      </p>

      <div className="space-y-3 pt-4 border-t border-slate-700/50">
        {project.escrow_contract_address && (
          <div className="flex items-center gap-2 p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500">Smart Contract</div>
              <div className="text-xs text-emerald-400 font-mono truncate">
                {project.escrow_contract_address.slice(0, 6)}...{project.escrow_contract_address.slice(-4)}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 mb-1">Total Value</div>
            <div className="text-lg font-bold text-white">
              {parseFloat(project.total_amount).toFixed(2)} {project.token_symbol}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 mb-1">Created</div>
            <div className="text-sm text-slate-300">
              {new Date(project.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
