import { Job, JobState } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Trash2, ArrowRight, User } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface JobCardProps {
  job: Job;
  onDelete?: (id: string) => void;
  onMove?: (id: string, newState: JobState) => void;
  compact?: boolean;
}

const stateColors: Record<JobState, { bg: string; text: string; border: string }> = {
  waiting: { bg: 'bg-[#5D8AA8]', text: 'text-white', border: 'border-[#5D8AA8]' },
  processing: { bg: 'bg-[#F39C12]', text: 'text-white', border: 'border-[#F39C12]' },
  stalled: { bg: 'bg-[#E67E22]', text: 'text-white', border: 'border-[#E67E22]' },
  completed: { bg: 'bg-[#27AE60]', text: 'text-white', border: 'border-[#27AE60]' },
  failed: { bg: 'bg-[#E74C3C]', text: 'text-white', border: 'border-[#E74C3C]' },
};

const stateLabels: Record<JobState, string> = {
  waiting: 'Waiting',
  processing: 'Processing',
  stalled: 'Stalled',
  completed: 'Done',
  failed: 'Failed',
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

function getNextState(currentState: JobState): JobState | null {
  const flow: Record<JobState, JobState | null> = {
    waiting: 'processing',
    processing: 'completed',
    stalled: 'waiting',
    completed: null,
    failed: 'waiting',
  };
  return flow[currentState];
}

export function JobCard({ job, onDelete, onMove, compact = false }: JobCardProps) {
  const nextState = getNextState(job.state);
  const colors = stateColors[job.state];

  if (compact) {
    return (
      <div 
        className="border-2 border-[#4A4A4A]/50 rounded-sm px-2 py-2 text-xs cursor-pointer hover:bg-muted/50 hover:shadow-sm transition-all bg-card flex flex-col gap-1"
        onClick={(e) => {
          if (onMove && nextState) {
            e.stopPropagation();
            onMove(job.id, nextState);
          }
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${colors.bg}`} />
          <span className="font-semibold truncate">{job.jobName}</span>
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          {JSON.stringify(job.payload).slice(0, 30)}
        </div>
        <div className="flex items-center justify-between mt-1 pt-1 border-t border-foreground/20">
          <span className={`text-[10px] ${colors.text.replace('text-', 'text-')}`}>
            {stateLabels[job.state]}
          </span>
          {job.workerId && (
            <span className="text-[10px] text-[#5D8AA8]">@{job.workerId}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="mb-2 cursor-pointer hover:translate-x-0.5 hover:translate-y-0.5 transition-all border-2 border-foreground/60 shadow-[2px_2px_0_var(--foreground)]">
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <Badge className={`${colors.bg} ${colors.text} border-2 ${colors.border}`}>
            {stateLabels[job.state]}
          </Badge>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimeAgo(job.timeIn)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{new Date(job.timeIn).toLocaleString()}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="font-semibold text-sm mb-1">{job.jobName}</div>
        
        <div className="text-xs text-muted-foreground font-mono truncate mb-2">
          {JSON.stringify(job.payload).slice(0, 40)}
          {JSON.stringify(job.payload).length > 40 ? '...' : ''}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              #{job.id.slice(0, 6)}
            </span>
            {job.workerId && (
              <span className="text-xs text-[#5D8AA8] flex items-center gap-1">
                <User className="h-3 w-3" />
                {job.workerId}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {nextState && onMove && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onMove(job.id, nextState)}
                    >
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Move to {stateLabels[nextState]}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {onDelete && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:text-[#E74C3C]"
                      onClick={() => onDelete(job.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete job</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {job.retryCount > 0 && (
          <div className="text-xs text-[#E67E22] mt-1">
            Retries: {job.retryCount}/{job.options.retryTime}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
