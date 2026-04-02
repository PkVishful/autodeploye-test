import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PhoneEmailFieldsProps {
  phone: string;
  email: string;
  onPhoneChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  phoneError?: string;
  emailError?: string;
}

const validatePhone = (v: string) => /^\d{10}$/.test(v) ? '' : 'Phone must be 10 digits';
const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Invalid email';

export function PhoneEmailFields({ phone, email, onPhoneChange, onEmailChange }: PhoneEmailFieldsProps) {
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const phoneErr = phoneTouched && phone ? validatePhone(phone) : '';
  const emailErr = emailTouched && email ? validateEmail(email) : '';

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label>Phone *</Label>
        <Input
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
          onBlur={() => setPhoneTouched(true)}
          placeholder="10 digit number"
          maxLength={10}
        />
        {phoneErr && <p className="text-xs text-destructive mt-1">{phoneErr}</p>}
      </div>
      <div>
        <Label>Email *</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onBlur={() => setEmailTouched(true)}
          placeholder="email@example.com"
        />
        {emailErr && <p className="text-xs text-destructive mt-1">{emailErr}</p>}
      </div>
    </div>
  );
}

export { validatePhone, validateEmail };
