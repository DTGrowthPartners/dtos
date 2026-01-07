import React, { useState, useMemo } from 'react';
import { ExternalTask, ExternalProject, getTaskExternalUrl } from '@/lib/externalTasksService';
import { ExternalLink } from 'lucide-react';

interface UnifiedTaskListProps {
  tasks: ExternalTask[];
  projects: ExternalProject[];
  columns: Array<{ status: string; name: string }>;
}

const UnifiedTaskList: React.FC<UnifiedTaskListProps> = ({
  tasks,
  projects,
  columns
}) => {
  const [statusFilter, setStatusFilter] = useState<string | 'all'>('all');

  // Filter tasks based on status
  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter(task => task.status === statusFilter);
  }, [tasks, statusFilter]);

  // Add project info to tasks
  const tasksWithProjects = filteredTasks.map(task => ({
    ...task,
    project: projects.find(p => p.id === task.projectId)
  }));

  const statusFilterOptions = [
    { value: 'all' as const, label: 'Todos', count: tasks.length },
    ...columns.map(column => ({
      value: column.status,
      label: column.name,
      count: tasks.filter(t => t.status === column.status).length
    }))
  ];

  const handleTaskClick = (taskId: string) => {
    window.open(getTaskExternalUrl(taskId), '_blank');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with filters */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900/50">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Todas las Tareas</h2>

          {/* Status Filters */}
          <div className="flex items-center gap-2">
            {statusFilterOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setStatusFilter(option.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  statusFilter === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <span>{option.label}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  statusFilter === option.value
                    ? 'bg-white/20'
                    : 'bg-slate-600'
                }`}>
                  {option.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* External Link Button */}
        <button
          onClick={() => window.open(getTaskExternalUrl(), '_blank')}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <ExternalLink size={16} />
          Abrir Sistema de Tareas
        </button>
      </div>

      {/* Task List - Ultra Compact Table View */}
      <div className="flex-1 overflow-y-auto">
        {/* Table Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 z-10">
          <div className="flex items-center gap-3 px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            <div className="w-16">Estado</div>
            <div className="flex-1 min-w-0">Tarea</div>
            <div className="w-20 text-center">Proyecto</div>
            <div className="w-12 text-center">Pri.</div>
            <div className="w-20 text-right">Asignado</div>
          </div>
        </div>

        {/* Task Rows */}
        <div className="divide-y divide-slate-700/30">
          {tasksWithProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-slate-600 mb-2">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">
                {statusFilter === 'all'
                  ? 'Sin tareas'
                  : `Sin tareas ${statusFilterOptions.find(opt => opt.value === statusFilter)?.label.toLowerCase()}`
                }
              </p>
            </div>
          ) : (
            tasksWithProjects.map((task, index) => (
              <div
                key={task.id}
                className={`group flex items-center gap-3 px-3 py-2 hover:bg-slate-800/30 transition-all duration-100 cursor-pointer border-l-2 border-transparent hover:border-blue-500/40 ${
                  index % 2 === 0 ? 'bg-slate-900/10' : 'bg-transparent'
                }`}
                onClick={() => handleTaskClick(task.id)}
              >
                {/* Status - Visual indicator */}
                <div className="flex-shrink-0 w-16">
                  <div className={`inline-flex items-center justify-center px-2 py-1 rounded text-[10px] font-medium ${
                    task.status === 'DONE'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : task.status === 'IN_PROGRESS'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-slate-700/30 text-slate-400'
                  }`}>
                    {task.status === 'DONE' ? 'Hecho' : task.status === 'IN_PROGRESS' ? 'En Prog.' : 'Por Hacer'}
                  </div>
                </div>

                {/* Task Title - Main focus */}
                <div className="flex-1 min-w-0">
                  <span className={`text-[13px] font-medium truncate block ${
                    task.status === 'DONE'
                      ? 'text-slate-500 line-through'
                      : 'text-slate-200 group-hover:text-white'
                  }`}>
                    {task.title}
                  </span>
                </div>

                {/* Project - Minimal indicator */}
                <div className="flex-shrink-0 w-20 flex items-center justify-center">
                  {task.project ? (
                    <div className="flex items-center gap-1.5 max-w-full">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.project.color}`} />
                      <span className="text-[10px] font-medium text-slate-400 truncate">
                        {task.project.name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-600">—</span>
                  )}
                </div>

                {/* Priority - Single letter */}
                <div className="flex-shrink-0 w-12 flex items-center justify-center">
                  {task.priority ? (
                    <span className={`text-[11px] font-bold ${
                      task.priority === 'HIGH' ? 'text-red-400' :
                      task.priority === 'MEDIUM' ? 'text-amber-400' :
                      'text-emerald-400'
                    }`} title={
                      task.priority === 'HIGH' ? 'Alta' :
                      task.priority === 'MEDIUM' ? 'Media' : 'Baja'
                    }>
                      {task.priority === 'HIGH' ? 'H' :
                       task.priority === 'MEDIUM' ? 'M' : 'L'}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-600">—</span>
                  )}
                </div>

                {/* Assignee - Initials only */}
                <div className="flex-shrink-0 w-20 flex items-center justify-end gap-1.5">
                  <span className="text-[10px] text-slate-500 truncate max-w-12">
                    {task.assignee}
                  </span>
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                    {task.assignee.charAt(0).toUpperCase()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedTaskList;
