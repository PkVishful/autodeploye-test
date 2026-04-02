import { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { INDIAN_STATES } from './IndianCitiesStates';

interface StateSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function StateSelect({ label = 'State', value, onChange, required }: StateSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1">
      <Label>{label}{required && ' *'}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
            {value || 'Select state...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search state..." />
            <CommandList>
              <CommandEmpty>No state found.</CommandEmpty>
              <CommandGroup>
                {INDIAN_STATES.map((state) => (
                  <CommandItem
                    key={state}
                    value={state}
                    onSelect={() => { onChange(state); setOpen(false); }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === state ? 'opacity-100' : 'opacity-0')} />
                    {state}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
