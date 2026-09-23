import * as AvatarPrimitive from '@radix-ui/react-avatar';
import styles from './Avatar.module.css';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

type AvatarProps = {
  name: string;
  src?: string | null;
  size?: AvatarSize;
};

/** Two initials from a display name, used when there is no avatar image. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, src, size = 'md' }: AvatarProps) {
  return (
    <AvatarPrimitive.Root className={styles.avatar} data-size={size}>
      {src ? (
        <AvatarPrimitive.Image
          className={styles.avatarImage}
          src={src}
          // The name is carried by the fallback text, so the image itself is
          // decorative — an alt here would double-announce the person.
          alt=""
        />
      ) : null}
      {/*
        `delayMs` is deliberately omitted. Radix treats a *defined* delay — even
        0 — as "wait a tick before rendering", which flashes an empty circle.
        Omitting it renders the initials immediately.
      */}
      <AvatarPrimitive.Fallback className={styles.avatarFallback}>
        <span aria-hidden>{initialsOf(name)}</span>
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

type AvatarGroupProps = {
  people: ReadonlyArray<{ id: string; name: string; avatarUrl?: string | null }>;
  /** Anything beyond this collapses into a "+N" chip. */
  max?: number;
  size?: AvatarSize;
  /** Names the group, e.g. "Watchers". */
  label: string;
};

export function AvatarGroup({
  people,
  max = 4,
  size = 'sm',
  label,
}: AvatarGroupProps) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;

  return (
    <div className={styles.avatarGroup} role="group" aria-label={label}>
      {shown.map((person) => (
        <span
          key={person.id}
          className={styles.avatarGroupItem}
          // The visual stack is decorative; the name is the content.
          title={person.name}
        >
          <Avatar name={person.name} src={person.avatarUrl ?? null} size={size} />
        </span>
      ))}
      {overflow > 0 ? (
        <span className={styles.avatarGroupOverflow} data-size={size}>
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
