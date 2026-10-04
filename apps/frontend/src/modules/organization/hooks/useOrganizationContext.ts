import { useOutletContext } from 'react-router';
import type { Role } from '@contracts';
import type {
  OrganizationDetail,
  OrganizationMemberRow,
} from '@/modules/organization/hooks/useOrganization';

/**
 * What the organisation layout hands to the tab rendered inside it, so each
 * tab works from the one query the layout already made.
 */
export type OrganizationOutletContext = {
  organization: OrganizationDetail;
  /** The viewer's roles on this organisation — capability hints only. */
  roles: Role[];
  members: OrganizationMemberRow[];
  membersTotal: number;
  hasMoreMembers: boolean;
  isLoadingMoreMembers: boolean;
  loadMoreMembers: () => Promise<void>;
};

export function useOrganizationContext(): OrganizationOutletContext {
  return useOutletContext<OrganizationOutletContext>();
}
