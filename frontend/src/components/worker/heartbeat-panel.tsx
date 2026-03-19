import { useState } from 'react';
import { Heartbeat } from '@/lib/types';
import { Activity, X, ChevronLeft, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface HeartbeatPanelProps {
  heartbeats: Heartbeat[];
}

// Custom tooltip for the recharts graph
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isWarning = data.age > 15;
    return (
      <div className="bg-background/95 backdrop-blur-sm border border-primary/20 p-3 rounded-lg shadow-xl text-sm font-handwritten">
        <div className="font-bold text-muted-foreground mb-1">Job ID</div>
        <div className="font-mono text-xs mb-3">{data.fullId}</div>
        <div className="flex justify-between items-center gap-4">
          <span className="font-semibold text-muted-foreground">Age:</span>
          <span className={cn("font-bold text-lg", isWarning ? "text-amber-500" : "text-primary")}>
            {data.age}s
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export function HeartbeatPanel({ heartbeats }: HeartbeatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Transform heartbeats into something Recharts can consume nicely
  const chartData = heartbeats.map((hb) => {
    const ageSecs = Number(((Date.now() - hb.lastPing) / 1000).toFixed(1));
    return {
      name: `...${hb.jobId.slice(-5)}`,
      age: ageSecs,
      fullId: hb.jobId,
    };
  });

  return (
    <>
      {/* Floating Action Button */}
      <div 
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-40 transition-transform duration-300",
          isOpen ? "translate-x-full" : "translate-x-0"
        )}
      >
        <Button 
          onClick={() => setIsOpen(true)}
          className="rounded-l-xl rounded-r-none h-16 w-12 px-2 shadow-lg border-y-2 border-l-2 border-primary bg-background text-foreground hover:bg-secondary flex flex-col items-center justify-center gap-1 group"
          variant="outline"
        >
          <ChevronLeft className="h-4 w-4 text-primary group-hover:-translate-x-1 transition-transform" />
          <Activity className="h-5 w-5 text-primary" />
        </Button>
      </div>

      {/* Sliding Panel */}
      <div 
        className={cn(
          "fixed right-0 top-24 bottom-24 w-[700px] rounded-l-2xl bg-background/95 backdrop-blur-md border-y-2 border-l-2 border-primary/20 shadow-[-5px_0_30px_rgba(0,0,0,0.1)] z-50 flex flex-col transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b-2 border-dashed border-primary/20">
          <div className="flex items-center gap-2 font-handwritten text-xl font-bold">
            <Activity className="h-5 w-5 text-primary" />
            Active Heartbeats
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-4 bg-primary/5 border-b border-primary/10">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-semibold uppercase tracking-wider text-xs">Workers Active</span>
            <Badge variant="secondary" className="font-mono bg-primary/20 text-primary">{heartbeats.length}</Badge>
          </div>
        </div>

        <div className="flex-1 p-6 relative">
          {heartbeats.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground italic opacity-60">
              <Activity className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm">No active heartbeats to graph.</p>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col">
              <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground bg-secondary/30 p-2 rounded">
                <Info className="h-4 w-4" />
                <span>Y-axis shows seconds since last ping. Bars turn amber if age &gt; 15s.</span>
              </div>
              <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 10, fontFamily: 'monospace' }} 
                      stroke="currentColor" 
                      className="opacity-50"
                      tickMargin={10}
                      angle={-45}
                      textAnchor="end"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }} 
                      stroke="currentColor" 
                      className="opacity-50"
                      domain={[0, 'dataMax + 5']}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} />
                    <Bar dataKey="age" radius={[4, 4, 0, 0]} animationDuration={1000}>
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.age > 15 ? '#f59e0b' : 'var(--color-primary, #3b82f6)'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
