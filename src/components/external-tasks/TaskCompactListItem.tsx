import React from 'react';
import { ExternalTask, ExternalProject, getTaskExternalUrl } from '@/lib/externalTasksService';

interface TaskCompactListItemProps {
  task: ExternalTask;
  project?: ExternalProject;
}

const TaskCompactListItem: React.FC<TaskCompactListItemProps> = ({
  task,
  project
}) => {
  const handleClick = () => {
    window.open(getTaskExternalUrl(task.id), '_blank');
  };

  return (
    <div
      onClick={handleClick}
      className="group w-full hover:bg-slate-800/30 border-b border-slate-700/30 px-2 py-1.5 transition-colors duration-100 cursor-pointer"
    >
      <div className="flex items-center gap-2">
        {/* Minimal Status Indicator */}
        <div className={`w-3 h-3 rounded border flex items-center justify-center transition-all duration-100 flex-shrink-0 ${
          task.status === 'DONE'
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : task.status === 'IN_PROGRESS'
            ? 'border-blue-500 bg-blue-500/20'
            : 'border-slate-600'
        }`}>
          {task.status === 'DONE' && <span className="text-[8px]">✓</span>}
          {task.status === 'IN_PROGRESS' && <span className="text-[8px] text-blue-400">→</span>}
        </div>

        {/* Project Color Indicator */}
        {project && (
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${project.color}`} />
        )}

        {/* Task Title - Ultra compact */}
        <span className={`text-xs flex-1 truncate ${
          task.status === 'DONE'
            ? 'text-slate-500 line-through'
            : 'text-slate-200 group-hover:text-slate-100'
        }`}>
          {task.title}
        </span>

        {/* Priority Indicator - Minimal */}
        {task.priority && (
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            task.priority === 'HIGH' ? 'bg-red-400' :
            task.priority === 'MEDIUM' ? 'bg-amber-400' :
            'bg-emerald-400'
          }`} />
        )}
      </div>
    </div>
  );
};

export default TaskCompactListItem;
