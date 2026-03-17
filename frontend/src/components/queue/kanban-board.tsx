'use client';

import { Job, JobState } from '@/lib/types';
import { JobCard } from './job-card';
import { LucideIcon, Clock, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface KanbanBoardProps {
  jobs: Job[];
  onDeleteJob: (id: string) => void;
  onMoveJob: (id: string, newState: JobState) => void;
}

interface QueueColumnProps {
  title: string;
  state: JobState;
  icon: LucideIcon;
  color: string;
  jobs: Job[];
  onDeleteJob: (id: string) => void;
  onMoveJob: (id: string, newState: JobState) => void;
}

const queueConfig: Record<JobState, { title: string; icon: LucideIcon; color: string }> = {
  waiting: { title: 'Waiting', icon: Clock, color: 'text-[#5D8AA8]' },
  processing: { title: 'Processing', icon: Loader2, color: 'text-[#F39C12]' },
  stalled: { title: 'Stalled', icon: AlertTriangle, color: 'text-[#E67E22]' },
  completed: { title: 'Done', icon: CheckCircle2, color: 'text-[#27AE60]' },
  failed: { title: 'Failed', icon: XCircle, color: 'text-[#E74C3C]' },
};

function QueueColumn({ title, state, icon: Icon, color, jobs, onDeleteJob, onMoveJob }: QueueColumnProps) {
  return (
    <div className="flex flex-col min-w-[140px] flex-1 h-full border-r-2 border-dashed border-foreground/30 last:border-r-0">
      <div className="flex items-center gap-1 mb-2 text-sm font-semibold p-2 border-b-2 border-dashed border-foreground/20">
        <Icon className={`h-4 w-4 ${color}`} />
        <span>{title}</span>
        <span className="ml-auto bg-secondary px-2 py-0.5 rounded text-xs">{jobs.length}</span>
      </div>
      <div className="flex-1 space-y-2 p-2 min-h-[60px] overflow-y-auto">
        {jobs.length === 0 ? (
          <div className="text-center text-muted-foreground text-xs italic py-4">~ empty ~</div>
        ) : (
          jobs.slice(0, 5).map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onDelete={onDeleteJob}
              onMove={onMoveJob}
              compact
            />
          ))
        )}
        {jobs.length > 5 && (
          <div className="text-xs text-muted-foreground text-center">+{jobs.length - 5} more</div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({ jobs, onDeleteJob, onMoveJob }: KanbanBoardProps) {
  const states: JobState[] = ['waiting', 'processing', 'stalled', 'completed', 'failed'];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 h-full">
      {states.map((state) => {
        const config = queueConfig[state];
        return (
          <QueueColumn
            key={state}
            state={state}
            title={config.title}
            icon={config.icon}
            color={config.color}
            jobs={jobs.filter((job) => job.state === state)}
            onDeleteJob={onDeleteJob}
            onMoveJob={onMoveJob}
          />
        );
      })}
    </div>
  );
}
