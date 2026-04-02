import { useState, useRef } from 'react';
import { format, parse, isValid, subMonths, addMonths, setMonth, setYear, getMonth, getYear } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DatePickerFieldProps {
  label: string;
  value: string; // ISO date string or empty
  onChange: (value: string) => void;
  required?: boolean;
  fromDate?: string; // ISO date string — dates before this are disabled
}

export function DatePickerField({ label, value, onChange, required, fromDate }: DatePickerFieldProps) {
  const date = value ? new Date(value + 'T00:00:00') : undefined;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [displayMonth, setDisplayMonth] = useState<Date>(
    date || (fromDate ? new Date(fromDate + 'T00:00:00') : new Date())
  );

  const formatDisplay = (d: Date) => format(d, 'dd-MMM-yy');

  const handleManualBlur = () => {
    if (!manualInput.trim()) return;
    // Try parsing dd-mm-yy or dd-mm-yyyy
    let parsed = parse(manualInput, 'dd-MM-yy', new Date());
    if (!isValid(parsed)) parsed = parse(manualInput, 'dd-MM-yyyy', new Date());
    if (!isValid(parsed)) parsed = parse(manualInput, 'dd/MM/yy', new Date());
    if (!isValid(parsed)) parsed = parse(manualInput, 'dd/MM/yyyy', new Date());
    if (isValid(parsed)) {
      // Validate against fromDate if set
      if (fromDate) {
        const minDate = new Date(fromDate + 'T00:00:00');
        if (parsed < minDate) {
          return; // Don't accept dates before fromDate
        }
      }
      onChange(format(parsed, 'yyyy-MM-dd'));
      setDisplayMonth(parsed);
      setManualInput('');
    }
  };

  const handleManualKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleManualBlur();
    }
  };

  const currentMonth = getMonth(displayMonth);
  const currentYear = getYear(displayMonth);
  const yearOptions: number[] = [];
  for (let y = currentYear - 20; y <= currentYear + 20; y++) yearOptions.push(y);

  return (
    <div className="space-y-1">
      <Label>{label}{required && ' *'}</Label>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? formatDisplay(date) : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 space-y-2">
            {/* Manual input */}
            <Input
              placeholder="dd-mm-yy"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onBlur={handleManualBlur}
              onKeyDown={handleManualKeyDown}
              className="h-8 text-sm"
            />
            {/* Month/Year selectors */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDisplayMonth(subMonths(displayMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={currentMonth.toString()} onValueChange={(v) => setDisplayMonth(setMonth(displayMonth, parseInt(v)))}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={currentYear.toString()} onValueChange={(v) => setDisplayMonth(setYear(displayMonth, parseInt(v)))}>
                <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                <SelectContent>{yearOptions.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDisplayMonth(addMonths(displayMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Calendar
            mode="single"
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            selected={date}
            disabled={fromDate ? (d) => d < new Date(fromDate + 'T00:00:00') : undefined}
            onSelect={(d) => {
              onChange(d ? format(d, 'yyyy-MM-dd') : '');
              if (d) setPopoverOpen(false);
            }}
            className={cn('p-3 pt-0 pointer-events-auto')}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
