import { ExternalLink } from 'lucide-react';
import type { ExternalTask, ExternalProject } from '@/lib/externalTasksService';
import { getTaskExternalUrl } from '@/lib/externalTasksService';

const PRIORITY_MAP = {
  LOW: { color: 'bg-blue-400' },
  MEDIUM: { color: 'bg-yellow-400' },
  HIGH: { color: 'bg-red-400' },
};

interface ExternalTaskCompactItemProps {
  task: ExternalTask;
  project?: ExternalProject;
}

export default function ExternalTaskCompactItem({ task, project }: ExternalTaskCompactItemProps) {
  const priority = PRIORITY_MAP[task.priority as keyof typeof PRIORITY_MAP];

  return (
    <div
      className="group w-full hover:bg-slate-800/30 border-b border-slate-700/30 px-2 py-1.5 transition-colors duration-100 cursor-pointer"
      onClick={() => window.open(getTaskExternalUrl(task.id), '_blank')}
    >
      <div className="flex items-center gap-2">
        {/* Project Color Indicator */}
        {project && (
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
        )}

        {/* Task Title */}
        <span className="text-xs flex-1 truncate text-foreground group-hover:text-slate-100">
          {task.title}
        </span>

        {/* Priority Indicator */}
        {task.priority && <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priority?.color}`} />}

        {/* Assignee Initial */}
        <span className="text-[10px] text-muted-foreground flex-shrink-0">
          {task.assignee.charAt(0)}
        </span>

        {/* External Link Icon */}
        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>
    </div>
  );
}
