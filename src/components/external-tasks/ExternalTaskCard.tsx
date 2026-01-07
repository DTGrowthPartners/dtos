import { Calendar, MessageCircle, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ExternalTask, ExternalProject } from '@/lib/externalTasksService';
import { getTaskExternalUrl } from '@/lib/externalTasksService';

const STATUS_MAP = {
  TODO: { label: 'Pendiente', color: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS: { label: 'En Progreso', color: 'bg-yellow-100 text-yellow-800' },
  DONE: { label: 'Completado', color: 'bg-green-100 text-green-800' },
};

const PRIORITY_MAP = {
  LOW: { label: 'Baja', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  MEDIUM: { label: 'Media', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  HIGH: { label: 'Alta', color: 'bg-red-100 text-red-800 border-red-300' },
};

interface ExternalTaskCardProps {
  task: ExternalTask;
  project?: ExternalProject;
}

export default function ExternalTaskCard({ task, project }: ExternalTaskCardProps) {
  const status = STATUS_MAP[task.status as keyof typeof STATUS_MAP];
  const priority = PRIORITY_MAP[task.priority as keyof typeof PRIORITY_MAP];

  return (
    <Card
      className="p-4 hover:shadow-lg transition-all cursor-pointer"
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: project?.color || '#3b82f6',
      }}
      onClick={() => window.open(getTaskExternalUrl(task.id), '_blank')}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-base mb-1 line-clamp-2">{task.title}</h3>
          {task.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            window.open(getTaskExternalUrl(task.id), '_blank');
          }}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>

      {/* Images Preview */}
      {task.images && task.images.length > 0 && (
        <div className="flex gap-1 mb-3 flex-wrap">
          {task.images.slice(0, 3).map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt={`Image ${idx + 1}`}
              className="w-16 h-16 object-cover rounded border"
            />
          ))}
          {task.images.length > 3 && (
            <div className="w-16 h-16 bg-muted border rounded flex items-center justify-center text-xs">
              +{task.images.length - 3}
            </div>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="flex flex-wrap gap-2 mb-3">
        {/* Project */}
        {project && (
          <span className={`text-xs px-2 py-1 rounded-full text-white font-medium`} style={{ backgroundColor: project.color }}>
            {project.name}
          </span>
        )}

        {/* Priority */}
        {priority && (
          <span className={`text-xs px-2 py-1 rounded-full border ${priority.color}`}>
            {priority.label}
          </span>
        )}

        {/* Type */}
        {task.type && (
          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
            {task.type}
          </span>
        )}

        {/* Status */}
        <span className={`text-xs px-2 py-1 rounded-full ${status?.color || 'bg-gray-100'}`}>
          {status?.label || task.status}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex gap-2 text-xs text-muted-foreground">
          {/* Due Date */}
          {task.dueDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(task.dueDate).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
              })}
            </span>
          )}

          {/* Assignee */}
          <span className="font-medium text-foreground">{task.assignee}</span>
        </div>

        <div className="flex gap-2 text-xs text-muted-foreground">
          {/* Images count */}
          {task.images && task.images.length > 0 && (
            <span className="flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              {task.images.length}
            </span>
          )}

          {/* Comments count */}
          {task.comments && task.comments.length > 0 && (
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {task.comments.length}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
