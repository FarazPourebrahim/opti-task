import type { ReactNode } from 'react';

type StatusScreenProps = {
  icon: ReactNode;
  title: string;
  description: string;
  /** Extra detail under the description, e.g. a request reference. */
  detail?: ReactNode;
  action?: ReactNode;
};

/** A whole-page outcome: not found, not allowed, or broken. */
export function StatusScreen({
  icon,
  title,
  description,
  detail,
  action,
}: StatusScreenProps) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span
        aria-hidden
        className="bg-surface-sunken text-text-subtle flex size-14 items-center justify-center rounded-full [&>svg]:size-7"
      >
        {icon}
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-text-strong text-xl font-bold">{title}</h1>
        <p className="text-text-subtle text-sm">{description}</p>
        {detail}
      </div>
      {action}
    </section>
  );
}
