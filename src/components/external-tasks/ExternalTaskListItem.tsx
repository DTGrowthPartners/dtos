import { Calendar, MessageCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ExternalTask, ExternalProject } from '@/lib/externalTasksService';
import { getTaskExternalUrl } from '@/lib/externalTasksService';

const PRIORITY_MAP = {
  LOW: { label: 'Baja', color: 'bg-blue-400' },
  MEDIUM: { label: 'Media', color: 'bg-yellow-400' },
  HIGH: { label: 'Alta', color: 'bg-red-400' },
};

interface ExternalTaskListItemProps {
  task: ExternalTask;
  project?: ExternalProject;
}

export default function ExternalTaskListItem({ task, project }: ExternalTaskListItemProps) {
  const priority = PRIORITY_MAP[task.priority as keyof typeof PRIORITY_MAP];

  return (
    <div
      className="group w-full bg-slate-800/10 hover:bg-slate-800/30 border-b border-slate-700/10 hover:border-slate-600/20 px-4 py-3 transition-all duration-200 cursor-pointer"
      onClick={() => window.open(getTaskExternalUrl(task.id), '_blank')}
    >
      <div className="flex items-start gap-4">
        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title */}
          <h3 className="font-semibold text-sm leading-snug line-clamp-1 text-foreground">
            {task.title}
          </h3>

          {/* Metadata Row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Priority Indicator */}
            {task.priority && (
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${priority?.color}`} />
                <span className="text-xs text-muted-foreground">
                  {priority?.label}
                </span>
              </div>
            )}

            {/* Project */}
            {project && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-xs font-medium" style={{ color: project.color }}>
                  {project.name}
                </span>
              </>
            )}

            {/* Type */}
            {task.type && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-muted-foreground">{task.type}</span>
              </>
            )}

            {/* Due Date */}
            {task.dueDate && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(task.dueDate).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Comments indicator */}
          {task.comments && task.comments.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="h-3 w-3" />
              <span>{task.comments.length}</span>
            </div>
          )}

          {/* Assignee */}
          <span className="text-xs font-medium text-foreground">{task.assignee}</span>

          {/* External Link Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              window.open(getTaskExternalUrl(task.id), '_blank');
            }}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
