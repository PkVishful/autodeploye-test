import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DrawerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  side?: 'left' | 'right';
}

export function DrawerForm({ open, onOpenChange, title, children, side = 'right' }: DrawerFormProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 px-6 pb-6">
          <div className="space-y-4 pr-2">
            {children}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
