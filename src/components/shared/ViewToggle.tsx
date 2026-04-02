import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ViewToggleProps {
  view: 'grid' | 'list';
  onChange: (view: 'grid' | 'list') => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center border rounded-lg overflow-hidden">
      <Button
        variant="ghost"
        size="sm"
        className={cn('rounded-none h-8 px-3', view === 'grid' && 'bg-primary/10 text-primary')}
        onClick={() => onChange('grid')}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn('rounded-none h-8 px-3', view === 'list' && 'bg-primary/10 text-primary')}
        onClick={() => onChange('list')}
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}
