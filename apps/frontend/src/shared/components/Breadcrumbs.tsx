import { ChevronRight } from 'lucide-react';
import { AppLink } from './AppLink';

export type BreadcrumbItem = {
  label: string;
  to: string;
};

type BreadcrumbsProps = {
  /** Accessible name of the landmark, already translated. */
  label: string;
  items: readonly BreadcrumbItem[];
};

/**
 * The trail to the current page. The last item is the page itself, so it is
 * text marked `aria-current`, not a link back to where the user already is.
 */
export function Breadcrumbs({ label, items }: BreadcrumbsProps) {
  return (
    <nav aria-label={label} className="min-w-0">
      <ol className="text-text-subtle flex flex-wrap items-center gap-1.5 text-sm">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <li key={item.to} className="flex items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight aria-hidden className="size-4 shrink-0" />
              ) : null}
              {isCurrent ? (
                <span
                  aria-current="page"
                  className="text-text-strong font-medium"
                >
                  {item.label}
                </span>
              ) : (
                <AppLink to={item.to} variant="subtle">
                  {item.label}
                </AppLink>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
