import { graphql } from '@/shared/graphql/generated';

/**
 * Profile operations.
 *
 * Every profile mutation returns the `User` with the fields it changed, so the
 * normalized cache updates the profile screen without a refetch.
 */

export const MyProfileQuery = graphql(`
  query MyProfile {
    me {
      id
      email
      name
      avatarUrl
      seniority
      skills
      expertise {
        id
        tag
        confidenceScore
      }
    }
  }
`);

export const UserProfileQuery = graphql(`
  query UserProfile($id: UUID!) {
    user(id: $id) {
      id
      name
      avatarUrl
      seniority
      skills
      expertise {
        id
        tag
        confidenceScore
      }
      teamMemberships {
        teamId
        teamName
        role
        availability
        workload
      }
    }
  }
`);

export const UpdateProfileMutation = graphql(`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      name
      avatarUrl
      seniority
    }
  }
`);

export const AddSkillMutation = graphql(`
  mutation AddSkill($skill: String!) {
    addSkill(skill: $skill) {
      id
      skills
    }
  }
`);

export const RemoveSkillMutation = graphql(`
  mutation RemoveSkill($skill: String!) {
    removeSkill(skill: $skill) {
      id
      skills
    }
  }
`);

export const AddExpertiseMutation = graphql(`
  mutation AddExpertise($input: AddExpertiseInput!) {
    addExpertise(input: $input) {
      id
      expertise {
        id
        tag
        confidenceScore
      }
    }
  }
`);

export const RemoveExpertiseMutation = graphql(`
  mutation RemoveExpertise($tag: String!) {
    removeExpertise(tag: $tag) {
      id
      expertise {
        id
        tag
        confidenceScore
      }
    }
  }
`);
