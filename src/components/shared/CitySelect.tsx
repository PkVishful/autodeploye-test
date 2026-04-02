import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { INDIAN_CITIES } from './IndianCitiesStates';

interface CitySelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  state?: string;
  required?: boolean;
}

export function CitySelect({ label = 'City', value, onChange, state, required }: CitySelectProps) {
  const [open, setOpen] = useState(false);

  const cities = state && INDIAN_CITIES[state] ? INDIAN_CITIES[state] : Object.values(INDIAN_CITIES).flat().sort();

  return (
    <div className="space-y-1">
      <Label>{label}{required && ' *'}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
            {value || 'Select city...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search city..." />
            <CommandList>
              <CommandEmpty>No city found.</CommandEmpty>
              <CommandGroup>
                {cities.map((city) => (
                  <CommandItem
                    key={city}
                    value={city}
                    onSelect={() => { onChange(city); setOpen(false); }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === city ? 'opacity-100' : 'opacity-0')} />
                    {city}
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
