'use client';

import { WorkerStatus } from '@/lib/types';
import { SimulationStatus } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Zap, Gauge, Trash2 } from 'lucide-react';

interface WorkerControlsProps {
  workerStatus: WorkerStatus;
  simulationStatus: SimulationStatus;
  onStartWorker: () => Promise<void>;
  onStopWorker: () => Promise<void>;
  onSetConcurrency: (value: number) => Promise<void>;
  onClearCompleted: () => Promise<void>;
  onClearStalled: () => Promise<void>;
  onClearFailed: () => Promise<void>;
  onClearAll: () => Promise<void>;
}

export function WorkerControls({
  workerStatus,
  simulationStatus,
  onStartWorker,
  onStopWorker,
  onSetConcurrency,
  onClearCompleted,
  onClearStalled,
  onClearFailed,
  onClearAll,
}: WorkerControlsProps) {
  return (
    <Card className="border-2 border-foreground card">
      <CardHeader className="border-b-2 border-dashed border-foreground/30">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Zap className="h-5 w-5" />
          Worker
          <Badge variant={workerStatus.isRunning ? 'default' : 'outline'} className="ml-auto badge-sketch">
            {workerStatus.isRunning ? 'Running' : 'Idle'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-lg">Process Jobs</Label>
            <p className="text-sm text-muted-foreground">
              {workerStatus.isRunning ? 'Processing from queue' : 'Worker idle'}
            </p>
          </div>
          {workerStatus.isRunning ? (
            <Button variant="destructive" onClick={onStopWorker} size="sm">
              <Square className="h-4 w-4 mr-1" />
              Stop
            </Button>
          ) : (
            <Button onClick={onStartWorker} size="sm">
              <Play className="h-4 w-4 mr-1" />
              Start
            </Button>
          )}
        </div>

        <Separator className="separator-sketch" />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" />
              <Label className="text-base">Concurrency</Label>
            </div>
            <span className="text-sm font-bold bg-secondary px-2 py-0.5 rounded">{workerStatus.concurrency}</span>
          </div>
          <Slider
            value={[workerStatus.concurrency]}
            min={1}
            max={10}
            step={1}
            onValueChange={(value) => onSetConcurrency(Array.isArray(value) ? value[0] : value)}
            disabled={workerStatus.isRunning}
          />
        </div>

        <Separator className="separator-sketch" />

        <div className="space-y-3">
          <Label className="text-lg">Stats</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-secondary/30 p-2 rounded border border-foreground/10">
              <div className="text-xs text-muted-foreground uppercase">Jobs/min</div>
              <div className="text-xl font-bold">{workerStatus.jobsProcessedPerMinute}</div>
            </div>
            <div className="bg-secondary/30 p-2 rounded border border-foreground/10">
              <div className="text-xs text-muted-foreground uppercase">Avg wait</div>
              <div className="text-xl font-bold">{workerStatus.averageWaitTime}ms</div>
            </div>
          </div>
        </div>

        <Separator className="separator-sketch" />

        <div className="space-y-3 pt-2">
          <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">Clear Queue</div>
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClearCompleted}
              className="px-3 py-2 h-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Done
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClearStalled}
              className="px-3 py-2 h-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Stalled
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClearFailed}
              className="px-3 py-2 h-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Failed
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClearAll}
              className="px-3 py-2 h-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              All
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
