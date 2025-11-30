import { useState, lazy, Suspense } from 'react';
import { ProjectCard } from './ProjectCard';

const ProjectDetails = lazy(() => import('./ProjectDetails').then(module => ({ default: module.ProjectDetails })));

interface ProjectListProps {
  projects: any[];
  onUpdate: () => void;
}

export function ProjectList({ projects, onUpdate }: ProjectListProps) {
  const [selectedProject, setSelectedProject] = useState<any>(null);

  if (selectedProject) {
    return (
      <Suspense fallback={<div className="text-center py-8 text-slate-400">Loading project...</div>}>
          <ProjectDetails
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
            onUpdate={() => {
              onUpdate();
              setSelectedProject(null);
            }}
          />
        </Suspense>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Your Projects</h2>

      {projects.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-slate-700/50">
          <p className="text-slate-400 text-lg mb-2">No projects yet</p>
          <p className="text-slate-500">Create your first project to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => setSelectedProject(project)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
