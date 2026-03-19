'use client';

import { useState, useEffect } from 'react';
import { useQueue } from '@/lib/use-queue';
import { cn } from '@/lib/utils';
import { StatsCard } from '@/components/queue/stats-card';
import { KanbanBoard } from '@/components/queue/kanban-board';
import { AddJobDialog } from '@/components/queue/add-job-dialog';
import { BenchmarkDialog } from '@/components/queue/benchmark-dialog';
import { WorkerControls } from '@/components/worker/worker-controls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Loader2, CheckCircle2, XCircle, RefreshCw, Plus, AlertTriangle, GripVertical, Sparkles, Zap } from 'lucide-react';
import { generateRandomPayload } from '@/lib/types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DraggablePanelProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

function DraggablePanel({ id, children, className }: DraggablePanelProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative", className, isDragging && 'opacity-80')}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 cursor-grab active:cursor-grabbing z-10 opacity-30 hover:opacity-100"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      {children}
    </div>
  );
}

const TOP_PANELS = ['waiting', 'processing', 'stalled', 'completed', 'failed'];
const BOTTOM_PANELS = ['worker', 'queue'];

export default function Dashboard() {
  const [topPanelsOrder, setTopPanelsOrder] = useState(TOP_PANELS);
  const [bottomPanelsOrder, setBottomPanelsOrder] = useState(BOTTOM_PANELS);
  const [isAddJobDialogOpen, setIsAddJobDialogOpen] = useState(false);
  const [isBenchmarkDialogOpen, setIsBenchmarkDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    jobs,
    stats,
    workerStatus,
    simulationStatus,
    isLoading,
    error,
    addJob,
    spawnRandomJob,
    deleteJob,
    startWorker,
    stopWorker,
    setConcurrency,
    clearCompleted,
    clearFailed,
    clearAll,
    runBenchmark,
    refresh,
  } = useQueue();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    if (TOP_PANELS.includes(activeId) && TOP_PANELS.includes(overId)) {
      setTopPanelsOrder((items) => {
        const oldIndex = items.indexOf(activeId);
        const newIndex = items.indexOf(overId);
        return arrayMove(items, oldIndex, newIndex);
      });
    } else if (BOTTOM_PANELS.includes(activeId) && BOTTOM_PANELS.includes(overId)) {
      setBottomPanelsOrder((items) => {
        const oldIndex = items.indexOf(activeId);
        const newIndex = items.indexOf(overId);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  const renderPanel = (id: string) => {
    switch (id) {
      case 'waiting':
        return (
          <StatsCard
            title="Waiting"
            value={stats.waiting}
            icon={Clock}
            description="in queue"
            variant="default"
          />
        );
      case 'processing':
        return (
          <StatsCard
            title="Processing"
            value={stats.processing}
            icon={Loader2}
            description="now"
            variant="warning"
          />
        );
      case 'stalled':
        return (
          <StatsCard
            title="Stalled"
            value={stats.stalled}
            icon={AlertTriangle}
            description="stuck"
            variant="warning"
          />
        );
      case 'completed':
        return (
          <StatsCard
            title="Done"
            value={stats.completed}
            icon={CheckCircle2}
            description="completed"
            variant="success"
          />
        );
      case 'failed':
        return (
          <StatsCard
            title="Failed"
            value={stats.failed}
            icon={XCircle}
            description="failed"
            variant="danger"
          />
        );
      case 'worker':
        return (
          <WorkerControls
            workerStatus={workerStatus}
            simulationStatus={simulationStatus}
            onStartWorker={startWorker}
            onStopWorker={stopWorker}
            onSetConcurrency={setConcurrency}
            onClearCompleted={clearCompleted}
            onClearFailed={clearFailed}
            onClearAll={clearAll}
          />
        );
      case 'queue':
        return (
          <Card className="border-2 border-foreground/50 h-full">
            <CardHeader className="border-b-2 border-dashed border-foreground/20 py-3">
              <CardTitle className="text-lg">Queue</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 h-full">
              <KanbanBoard
                jobs={jobs}
                onDeleteJob={deleteJob}
              />
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  if (!mounted) return null;

  return (
    <DndContext
      id="queue-simulation-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-background text-foreground font-handwritten">
        <header className="border-b-2 border-foreground/30 bg-background/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold tracking-wide">Job Queue</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => spawnRandomJob()} disabled={isLoading}>
                <Sparkles className="h-4 w-4 mr-2" />
                Quick Random
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsBenchmarkDialogOpen(true)} disabled={isLoading}>
                <Zap className="h-4 w-4 mr-2" />
                Benchmark
              </Button>
              <Button size="sm" onClick={() => setIsAddJobDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Job
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-6 py-6">
          {error && (
            <Card className="mb-6 border-2 border-[#E74C3C] bg-[#E74C3C]/5">
              <CardContent className="pt-4">
                <p className="text-[#E74C3C] flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Error: {error}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Top Row - Stats */}
          <SortableContext items={topPanelsOrder} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-5 gap-6 mb-8">
              {topPanelsOrder.map((id) => (
                <DraggablePanel key={id} id={id}>
                  {renderPanel(id)}
                </DraggablePanel>
              ))}
            </div>
          </SortableContext>

          {/* Bottom Row - Worker, Queue */}
          <SortableContext items={bottomPanelsOrder} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-10 gap-6 items-start">
              {bottomPanelsOrder.map((id) => (
                <DraggablePanel 
                  key={id} 
                  id={id} 
                  className={id === 'queue' ? 'col-span-7' : 'col-span-3'}
                >
                  {renderPanel(id)}
                </DraggablePanel>
              ))}
            </div>
          </SortableContext>
        </main>

        <AddJobDialog
          open={isAddJobDialogOpen}
          onOpenChange={setIsAddJobDialogOpen}
          onAddJob={(jobName, processingTime) => {
            addJob({
              jobName,
              payload: {
                ...generateRandomPayload(jobName),
                processingTime,
              },
            });
          }}
        />
        <BenchmarkDialog
          open={isBenchmarkDialogOpen}
          onOpenChange={setIsBenchmarkDialogOpen}
          onRunBenchmark={runBenchmark}
        />
      </div>
    </DndContext>
  );
}
