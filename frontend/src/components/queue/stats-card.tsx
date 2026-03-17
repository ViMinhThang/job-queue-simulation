import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const variantStyles = {
  default: 'text-foreground',
  success: 'text-[#27AE60]',
  warning: 'text-[#F39C12]',
  danger: 'text-[#E74C3C]',
};

export function StatsCard({ title, value, icon: Icon, description, variant = 'default' }: StatsCardProps) {
  return (
    <Card className="border-2 border-foreground shadow-[3px_3px_0_var(--foreground)]">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-lg">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${variantStyles[variant]}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-4xl font-bold ${variantStyles[variant]}`}>{value}</div>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}
