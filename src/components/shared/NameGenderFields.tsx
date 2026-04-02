import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface NameGenderFieldsProps {
  firstName: string;
  lastName: string;
  gender: string;
  onFirstNameChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
  onGenderChange: (v: string) => void;
  firstNameLabel?: string;
  lastNameLabel?: string;
}

export function NameGenderFields({
  firstName, lastName, gender,
  onFirstNameChange, onLastNameChange, onGenderChange,
  firstNameLabel = 'First Name', lastNameLabel = 'Last Name',
}: NameGenderFieldsProps) {
  return (
    <div className="grid grid-cols-5 gap-3">
      <div>
        <Label>Title</Label>
        <Select value={gender} onValueChange={onGenderChange}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Mr">Mr</SelectItem>
            <SelectItem value="Mrs">Mrs</SelectItem>
            <SelectItem value="Miss">Miss</SelectItem>
            <SelectItem value="Mstr">Mstr</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2">
        <Label>{firstNameLabel} *</Label>
        <Input value={firstName} onChange={(e) => onFirstNameChange(e.target.value)} placeholder="First name" />
      </div>
      <div className="col-span-2">
        <Label>{lastNameLabel} *</Label>
        <Input value={lastName} onChange={(e) => onLastNameChange(e.target.value)} placeholder="Last name" />
      </div>
    </div>
  );
}
