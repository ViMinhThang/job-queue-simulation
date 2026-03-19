'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { BenchmarkConfig } from '@/lib/types';

interface BenchmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRunBenchmark: (config: BenchmarkConfig) => void;
}

export function BenchmarkDialog({ open, onOpenChange, onRunBenchmark }: BenchmarkDialogProps) {
  const [config, setConfig] = useState<BenchmarkConfig>({
    success: { count: 5, processingTime: 2000 },
    failed: { count: 2, processingTime: 1000 },
    stalled: { count: 1, processingTime: 3000 },
  });

  const update = (
    category: keyof BenchmarkConfig,
    field: 'count' | 'processingTime',
    value: number,
  ) => {
    setConfig((prev) => ({
      ...prev,
      [category]: { ...prev[category], [field]: value },
    }));
  };

  const totalJobs = config.success.count + config.failed.count + config.stalled.count;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRunBenchmark(config);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Run Benchmark</DialogTitle>
            <DialogDescription>
              Configure job batches to stress-test the queue.
              Total: <strong>{totalJobs}</strong> jobs will be spawned.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Success Jobs */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <CheckCircle2 className="h-4 w-4 text-[#27AE60]" />
                Success Jobs
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="success-count" className="text-xs text-muted-foreground">Count</Label>
                  <Input
                    id="success-count"
                    type="number"
                    value={config.success.count}
                    onChange={(e) => update('success', 'count', Number(e.target.value))}
                    min={0}
                    max={100}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="success-time" className="text-xs text-muted-foreground">Processing Time (ms)</Label>
                  <Input
                    id="success-time"
                    type="number"
                    value={config.success.processingTime}
                    onChange={(e) => update('success', 'processingTime', Number(e.target.value))}
                    min={100}
                    max={60000}
                    step={100}
                  />
                </div>
              </div>
            </div>

            <Separator className="separator-sketch" />

            {/* Failed Jobs */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <XCircle className="h-4 w-4 text-[#E74C3C]" />
                Failed Jobs
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="failed-count" className="text-xs text-muted-foreground">Count</Label>
                  <Input
                    id="failed-count"
                    type="number"
                    value={config.failed.count}
                    onChange={(e) => update('failed', 'count', Number(e.target.value))}
                    min={0}
                    max={100}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="failed-time" className="text-xs text-muted-foreground">Processing Time (ms)</Label>
                  <Input
                    id="failed-time"
                    type="number"
                    value={config.failed.processingTime}
                    onChange={(e) => update('failed', 'processingTime', Number(e.target.value))}
                    min={100}
                    max={60000}
                    step={100}
                  />
                </div>
              </div>
            </div>

            <Separator className="separator-sketch" />

            {/* Stalled Jobs */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <AlertTriangle className="h-4 w-4 text-[#E67E22]" />
                Stalled Jobs
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="stalled-count" className="text-xs text-muted-foreground">Count</Label>
                  <Input
                    id="stalled-count"
                    type="number"
                    value={config.stalled.count}
                    onChange={(e) => update('stalled', 'count', Number(e.target.value))}
                    min={0}
                    max={100}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="stalled-time" className="text-xs text-muted-foreground">Processing Time (ms)</Label>
                  <Input
                    id="stalled-time"
                    type="number"
                    value={config.stalled.processingTime}
                    onChange={(e) => update('stalled', 'processingTime', Number(e.target.value))}
                    min={100}
                    max={60000}
                    step={100}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={totalJobs === 0}>
              Run Benchmark ({totalJobs} jobs)
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
