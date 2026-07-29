import { cn } from '@/shared/lib/cn';
import type { InputHTMLAttributes } from 'react';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'focus-ring h-10 w-full rounded-xl border border-[var(--input)] bg-white px-3 text-sm placeholder:text-[var(--muted-foreground)]',
        className
      )}
      {...props}
    />
  );
}
