import { AlertTriangle } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { HTMLAttributes } from 'react';

export function Alert({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border border-[var(--gold)] bg-[var(--accent)] p-3 text-sm text-[var(--accent-foreground)]',
        className
      )}
      {...props}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{props.children}</div>
    </div>
  );
}
