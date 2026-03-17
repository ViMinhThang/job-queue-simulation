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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SAMPLE_JOB_NAMES } from '@/lib/types';

interface AddJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddJob: (jobName: string, processingTime: number) => void;
}

export function AddJobDialog({ open, onOpenChange, onAddJob }: AddJobDialogProps) {
  const [jobName, setJobName] = useState(SAMPLE_JOB_NAMES[0]);
  const [processingTime, setProcessingTime] = useState(3000);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddJob(jobName, processingTime);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add New Job</DialogTitle>
            <DialogDescription>
              Create a new job to be processed by the queue.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4 text-sm">
              <Label htmlFor="name" className="text-right">
                Job Name
              </Label>
              <div className="col-span-3">
                <Select value={jobName} onValueChange={(val) => val && setJobName(val)}>
                  <SelectTrigger id="name" className="w-full">
                    <SelectValue placeholder="Select job type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SAMPLE_JOB_NAMES.map((name: string) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4 text-sm">
              <Label htmlFor="time" className="text-right">
                Process Time
              </Label>
              <div className="col-span-3 space-y-2">
                <Input
                  id="time"
                  type="number"
                  value={processingTime}
                  onChange={(e) => setProcessingTime(Number(e.target.value))}
                  min={100}
                  max={60000}
                  step={50}
                />
                <p className="text-[10px] text-muted-foreground">
                  In milliseconds (3000ms = 3s)
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Job</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
