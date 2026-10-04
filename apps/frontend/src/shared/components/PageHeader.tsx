import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description?: string | undefined;
  /** Page-level actions, aligned to the end of the title row. */
  actions?: ReactNode;
};

/** The heading block every screen inside the app shell opens with. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-text-strong text-2xl font-bold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="text-text-subtle text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}
