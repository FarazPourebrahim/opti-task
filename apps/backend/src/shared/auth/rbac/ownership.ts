/**
 * Resource-ownership checks. Used alongside the permission matrix where a basic
 * member may act only on their OWN resource (e.g. a Team Member updates a task
 * they're assigned to/reported, an author edits their own comment).
 */
export function ownsAny(
  userId: string,
  ...ownerIds: Array<string | null | undefined>
): boolean {
  return ownerIds.some((id) => id != null && id === userId);
}
