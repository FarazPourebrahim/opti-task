import { useOutletContext } from 'react-router';
import type { Role } from '@contracts';
import type {
  ProjectDetail,
  ProjectMemberRow,
} from '@/modules/project/hooks/useProject';

/** A person who could be added to something, as a picker needs them. */
export type MemberCandidate = {
  id: string;
  name: string;
  email: string;
};

/**
 * What the project layout hands to the tab rendered inside it, so each tab
 * works from the one query the layout already made.
 */
export type ProjectOutletContext = {
  project: ProjectDetail;
  /** The viewer's roles on this project — capability hints only. */
  roles: Role[];
  members: ProjectMemberRow[];
  membersTotal: number;
  hasMoreMembers: boolean;
  isLoadingMoreMembers: boolean;
  loadMoreMembers: () => Promise<void>;
  /**
   * Organisation members, as candidates for joining the project. Empty when
   * the viewer may not read the organisation.
   */
  organizationMembers: MemberCandidate[];
  refetchProject: () => Promise<unknown>;
};

export function useProjectContext(): ProjectOutletContext {
  return useOutletContext<ProjectOutletContext>();
}
