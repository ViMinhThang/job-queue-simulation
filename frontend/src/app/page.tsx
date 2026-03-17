'use client';

import { useState, useEffect } from 'react';
import { useQueue } from '@/lib/use-queue';
import { detectConnectionMode } from '@/lib/api';
import { StatsCard } from '@/components/queue/stats-card';
import { KanbanBoard } from '@/components/queue/kanban-board';
import { WorkerControls } from '@/components/worker/worker-controls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Loader2, CheckCircle2, XCircle, Wifi, WifiOff, RefreshCw, Plus, AlertTriangle, GripVertical } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ConnectionMode } from '@/lib/api';
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
      className={`${className} ${isDragging ? 'opacity-80' : ''}`}
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
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('mock');
  const [isDetecting, setIsDetecting] = useState(true);
  const [topPanelsOrder, setTopPanelsOrder] = useState(TOP_PANELS);
  const [bottomPanelsOrder, setBottomPanelsOrder] = useState(BOTTOM_PANELS);

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
    detectConnectionMode().then((mode) => {
      setConnectionMode(mode);
      setIsDetecting(false);
    });
  }, []);

  const {
    jobs,
    stats,
    workerStatus,
    simulationStatus,
    isLoading,
    error,
    spawnRandomJob,
    deleteJob,
    moveJob,
    startWorker,
    stopWorker,
    startSimulation,
    stopSimulation,
    setSimulateRate,
    setConcurrency,
    clearCompleted,
    clearFailed,
    clearAll,
    refresh,
  } = useQueue(connectionMode);

  const isMockMode = connectionMode === 'mock';

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
            onStartSimulation={startSimulation}
            onStopSimulation={stopSimulation}
            onSetSimulateRate={setSimulateRate}
            onSetConcurrency={setConcurrency}
            onClearCompleted={clearCompleted}
            onClearFailed={clearFailed}
            onClearAll={clearAll}
            isMockMode={isMockMode}
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
                onMoveJob={moveJob}
              />
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-background">
        <header className="border-b-2 border-foreground/30">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold tracking-wide">Job Queue</h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant={connectionMode === 'real' ? 'default' : 'outline'} className="gap-1">
                      {isDetecting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : connectionMode === 'real' ? (
                        <Wifi className="h-3 w-3" />
                      ) : (
                        <WifiOff className="h-3 w-3" />
                      )}
                      {isDetecting ? 'Detecting...' : connectionMode === 'real' ? 'Connected' : 'Mock'}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {connectionMode === 'real'
                        ? 'Connected to real backend API'
                        : 'Using in-memory mock service'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={() => spawnRandomJob()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Job
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-6 py-6">
          {error && (
            <Card className="mb-6 border-2 border-[#E74C3C]">
              <CardContent className="pt-4">
                <p className="text-[#E74C3C]">Error: {error}</p>
              </CardContent>
            </Card>
          )}

          {/* Top Row - Stats */}
          <SortableContext items={topPanelsOrder} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-5 gap-4 mb-4">
              {topPanelsOrder.map((id) => (
                <DraggablePanel key={id} id={id}>
                  {renderPanel(id)}
                </DraggablePanel>
              ))}
            </div>
          </SortableContext>

          {/* Bottom Row - Worker, Queue */}
          <SortableContext items={bottomPanelsOrder} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-10 gap-4 items-stretch">
              {bottomPanelsOrder.map((id) => (
                <DraggablePanel key={id} id={id} className={id === 'queue' ? 'col-span-7' : 'col-span-3'}>
                  {renderPanel(id)}
                </DraggablePanel>
              ))}
            </div>
          </SortableContext>
        </main>
      </div>
    </DndContext>
  );
}
