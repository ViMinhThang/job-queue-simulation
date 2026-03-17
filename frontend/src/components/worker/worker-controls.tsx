'use client';

import { WorkerStatus } from '@/lib/types';
import { SimulationStatus } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Zap, Gauge, Trash2, Sparkles } from 'lucide-react';

interface WorkerControlsProps {
  workerStatus: WorkerStatus;
  simulationStatus: SimulationStatus;
  onStartWorker: () => Promise<void>;
  onStopWorker: () => Promise<void>;
  onStartSimulation: () => Promise<void>;
  onStopSimulation: () => Promise<void>;
  onSetSimulateRate: (value: number) => Promise<void>;
  onSetConcurrency: (value: number) => Promise<void>;
  onClearCompleted: () => Promise<void>;
  onClearFailed: () => Promise<void>;
  onClearAll: () => Promise<void>;
  isMockMode: boolean;
}

export function WorkerControls({
  workerStatus,
  simulationStatus,
  onStartWorker,
  onStopWorker,
  onStartSimulation,
  onStopSimulation,
  onSetSimulateRate,
  onSetConcurrency,
  onClearCompleted,
  onClearFailed,
  onClearAll,
  isMockMode,
}: WorkerControlsProps) {
  return (
    <Card className="border-2 border-foreground">
      <CardHeader className="border-b-2 border-dashed border-foreground/30">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Zap className="h-5 w-5" />
          Worker
          <Badge variant={workerStatus.isRunning ? 'default' : 'outline'} className="ml-auto">
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

        {isMockMode && (
          <>
            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-lg flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Auto-Simulate
                </Label>
                <p className="text-sm text-muted-foreground">
                  {simulationStatus.isSimulating 
                    ? `Every ${simulationStatus.simulateRate}ms` 
                    : 'Spawn jobs automatically'}
                </p>
              </div>
              {simulationStatus.isSimulating ? (
                <Button variant="secondary" onClick={onStopSimulation} size="sm">
                  <Square className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              ) : (
                <Button variant="outline" onClick={onStartSimulation} size="sm">
                  <Sparkles className="h-4 w-4 mr-1" />
                  Simulate
                </Button>
              )}
            </div>

            {simulationStatus.isSimulating && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Spawn Rate</Label>
                  <span className="text-sm font-mono">{simulationStatus.simulateRate}ms</span>
                </div>
                <Slider
                  value={[simulationStatus.simulateRate]}
                  min={500}
                  max={10000}
                  step={500}
                  onValueChange={(value) => onSetSimulateRate(Array.isArray(value) ? value[0] : value)}
                />
              </div>
            )}
          </>
        )}

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              <Label>Concurrency</Label>
            </div>
            <span className="text-sm font-bold">{workerStatus.concurrency}</span>
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

        <Separator />

        <div className="space-y-2">
          <Label className="text-lg">Stats</Label>
          <div className="grid grid-cols-2 gap-4 text-base">
            <div>
              <span className="text-muted-foreground">Jobs/min:</span>{' '}
              <span className="font-bold">{workerStatus.jobsProcessedPerMinute}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Avg wait:</span>{' '}
              <span className="font-bold">{workerStatus.averageWaitTime}ms</span>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-lg">Clear</Label>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onClearCompleted}>
              <Trash2 className="h-3 w-3 mr-1" />
              Done
            </Button>
            <Button variant="outline" size="sm" onClick={onClearFailed}>
              <Trash2 className="h-3 w-3 mr-1" />
              Failed
            </Button>
            <Button variant="outline" size="sm" onClick={onClearAll}>
              <Trash2 className="h-3 w-3 mr-1" />
              All
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
