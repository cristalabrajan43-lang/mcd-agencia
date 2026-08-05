'use client';

import { useState, useEffect, useRef } from 'react';

interface PriceInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * A price input that uses a local string buffer to avoid the
 * `parseFloat(e.target.value) || 0` problem with type="number".
 * This allows typing intermediate values like "10", "10.", "10.5" without
 * the cursor jumping or zeros being swallowed.
 */
export default function PriceInput({ value, onChange, className, placeholder = '0.00', disabled }: PriceInputProps) {
  const [localValue, setLocalValue] = useState<string>(value ? String(value) : '');
  const onChangeRef = useRef(onChange);
  const isTypingRef = useRef(false);

  // Always keep the latest onChange in a ref so we never call a stale callback
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync from parent only when the numeric value changes externally (not from typing)
  useEffect(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      return;
    }
    setLocalValue(value ? String(value) : '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow empty, or valid decimal number pattern
    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
      isTypingRef.current = true;
      setLocalValue(raw);
      const num = parseFloat(raw);
      onChangeRef.current(isNaN(num) ? 0 : num);
    }
  };

  const handleBlur = () => {
    // On blur, normalize the display (remove trailing dots, format properly)
    if (localValue === '' || localValue === '.') {
      setLocalValue('');
      onChangeRef.current(0);
    } else {
      const num = parseFloat(localValue);
      if (!isNaN(num)) {
        setLocalValue(String(num));
        onChangeRef.current(num);
      }
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
}
