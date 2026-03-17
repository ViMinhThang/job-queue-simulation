'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Loader2, Wand2 } from 'lucide-react';
import { AddJobRequest, generateRandomPayload, SAMPLE_JOB_NAMES } from '@/lib/types';

interface AddJobDialogProps {
  onAddJob: (request: AddJobRequest) => Promise<void>;
}

export function AddJobDialog({ onAddJob }: AddJobDialogProps) {
  const [open, setOpen] = useState(false);
  const [jobName, setJobName] = useState('processImage');
  const [payload, setPayload] = useState(JSON.stringify(generateRandomPayload('processImage'), null, 2));
  const [retryCount, setRetryCount] = useState('3');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGeneratePayload = () => {
    setPayload(JSON.stringify(generateRandomPayload(jobName), null, 2));
  };

  const handleJobNameChange = (value: string) => {
    setJobName(value);
    setPayload(JSON.stringify(generateRandomPayload(value), null, 2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const parsedPayload = JSON.parse(payload);
      await onAddJob({
        jobName,
        payload: parsedPayload,
        options: { retryTime: parseInt(retryCount, 10) || 3 },
      });
      setOpen(false);
      setJobName('processImage');
      setPayload(JSON.stringify(generateRandomPayload('processImage'), null, 2));
      setRetryCount('3');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON payload');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Job
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Job</DialogTitle>
            <DialogDescription>
              Create a new job to add to the queue.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="jobName" className="text-right">
                Job Name
              </Label>
              <Input
                id="jobName"
                value={jobName}
                onChange={(e) => handleJobNameChange(e.target.value)}
                placeholder="e.g., processImage"
                className="col-span-2"
              />
              <datalist id="job-names">
                {SAMPLE_JOB_NAMES.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="retryCount" className="text-right">
                Max Retries
              </Label>
              <Input
                id="retryCount"
                type="number"
                min="0"
                max="10"
                value={retryCount}
                onChange={(e) => setRetryCount(e.target.value)}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="payload" className="text-right pt-2">
                Payload
              </Label>
              <div className="col-span-3 space-y-2">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGeneratePayload}
                  >
                    <Wand2 className="h-3 w-3 mr-1" />
                    Generate Random
                  </Button>
                </div>
                <textarea
                  id="payload"
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                />
                {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Job
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
