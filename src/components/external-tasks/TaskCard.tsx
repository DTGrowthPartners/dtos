import React from 'react';
import { ExternalTask, ExternalProject, getTaskExternalUrl } from '@/lib/externalTasksService';
import { Calendar, Clock, AlertCircle, ExternalLink, MessageCircle } from 'lucide-react';
import { formatDate, formatRelativeDate, getDateBadgeColor, isOverdue } from '@/utils/dateUtils';

interface TaskCardProps {
  task: ExternalTask;
  project?: ExternalProject;
  onOpenImageModal?: (imageSrc: string) => void;
  isMobile?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, project, onOpenImageModal, isMobile = false }) => {
  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'HIGH':
        return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'MEDIUM':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'LOW':
        return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      default:
        return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const dateBadgeColor = getDateBadgeColor(task.dueDate, task.status);

  const cardClasses = `group relative dt-card hover:dt-card-hover transition-all var(--dt-transition-fast) cursor-pointer ${isMobile ? 'p-1.5' : 'p-2'}`;
  const descriptionClasses = `dt-text-secondary leading-snug mb-1.5 ${isMobile ? 'text-xs dt-line-clamp-2' : 'text-sm dt-line-clamp-2'}`;

  const handleCardClick = () => {
    window.open(getTaskExternalUrl(task.id), '_blank');
  };

  return (
    <div onClick={handleCardClick} className={cardClasses}>
      <div className="flex-1 w-full">
        {/* Header: Project & Priority */}
        <div className="flex justify-between items-start mb-2 relative">
          <div className="flex flex-wrap items-center gap-2 pr-14">
            {project && (
              <span className={`dt-project-badge ${project.color}`}>
                {project.name}
              </span>
            )}
            {task.type && (
              <span className="dt-badge">
                {task.type}
              </span>
            )}
            <span className={`dt-priority-badge dt-priority-badge--${task.priority.toLowerCase()}`}>
              {task.priority}
            </span>
          </div>

          <div className="absolute -top-1 -right-1 flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(getTaskExternalUrl(task.id), '_blank');
              }}
              className="dt-btn-icon z-10"
              title="Abrir en sistema externo"
            >
              <ExternalLink size={isMobile ? 12 : 14} />
            </button>
          </div>
        </div>

        <h3 className={`dt-task-title mb-1 pr-2 leading-snug ${isMobile ? 'text-sm' : 'text-base'}`}>{task.title}</h3>
        <p className={descriptionClasses}>{task.description}</p>

        {task.images && task.images.length > 0 && (
          <div className="mb-2 flex gap-1 flex-wrap">
            {task.images.slice(0, 3).map((base64, index) => (
              <img
                key={index}
                src={base64}
                alt={`Img ${index + 1}`}
                className="w-12 h-16 object-contain rounded border border-slate-700
                           hover:scale-110 transition-transform cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onOpenImageModal?.(base64);
                }}
              />
            ))}
            {task.images.length > 3 && (
              <div className="w-12 h-12 bg-slate-800 border border-slate-700 rounded
                              flex items-center justify-center text-xs text-slate-400">
                +{task.images.length - 3}
              </div>
            )}
          </div>
        )}

        {(task.startDate || task.dueDate) && (
          <div className="mb-3">
            {task.startDate && !isMobile && (
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <Calendar size={12} className="text-slate-500" />
                <span>Creado: {formatDate(task.startDate)}</span>
              </div>
            )}

            {task.dueDate && (
              <div className="flex items-start justify-between">
                <div className={`dt-time-pill ${dateBadgeColor}`}>
                  {task.status !== 'DONE' && isOverdue(task.dueDate) ? <AlertCircle size={12} /> : <Clock size={12} />}
                  <span className="text-xs">{task.status === 'DONE' ? 'Completada' : formatRelativeDate(task.dueDate)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-800/80 pr-2 rounded-full">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-blue-600" title={`Asignado a: ${task.assignee}`}>
              {task.assignee.charAt(0).toUpperCase()}
            </div>
            {!isMobile && <span className="text-[10px] text-slate-300 leading-none">{task.assignee}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {task.comments && task.comments.length > 0 && (
            <div className="dt-btn-icon relative" title={`${task.comments.length} comentarios`}>
              <MessageCircle size={isMobile ? 12 : 14} />
              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] rounded-full w-3 h-3 flex items-center justify-center">
                {task.comments.length}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
