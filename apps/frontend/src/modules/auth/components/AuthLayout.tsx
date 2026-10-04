import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * The shared frame for every signed-out screen.
 *
 * A split layout: the brand panel is decorative and collapses away below the
 * `lg` breakpoint so a phone gets the form at full width rather than a
 * squeezed column.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) {
  const { t } = useTranslation();

  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      {/* Dark text: white on the amber brand color falls well short of 4.5:1. */}
      <section
        aria-hidden
        className="from-primary-lighter to-primary hidden place-items-center bg-linear-to-br text-gray-950 lg:grid"
      >
        <div className="flex max-w-md flex-col gap-3 p-12">
          <p className="text-6xl font-extrabold tracking-tight">
            {t('app.name')}
          </p>
          <p className="text-xl">{t('app.tagline')}</p>
        </div>
      </section>
      <section className="grid place-items-center px-4 py-10">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-text-strong text-2xl font-bold tracking-tight">
              {title}
            </h1>
            <p className="text-text-subtle text-sm">{subtitle}</p>
          </header>
          {children}
          {footer ? (
            <footer className="text-text-subtle flex flex-wrap justify-center gap-1.5 text-center text-sm">
              {footer}
            </footer>
          ) : null}
        </div>
      </section>
    </main>
  );
}
