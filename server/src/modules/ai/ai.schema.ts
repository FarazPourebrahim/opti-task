/**
 * AI integration GraphQL contract. The backend never runs models — it requests
 * suggestions from an external provider, persists each one with full metadata,
 * and applies the change only on explicit human approval (or override). The
 * AI_AGENT role holds `ai:request` but not `ai:approve`, so a suggestion can
 * never mutate domain data without a human decision.
 */
export const aiTypeDefs = /* GraphQL */ `
  enum AiRecommendationType {
    STORY_POINT_ESTIMATION
    TASK_ASSIGNMENT
    SPRINT_HEALTH
    PROGRESS_TRACKING
    RECOMMENDATION
  }

  enum AiApprovalStatus {
    PENDING
    APPROVED
    REJECTED
    OVERRIDDEN
  }

  enum AiResolutionStatus {
    OPEN
    RESOLVED
    DISMISSED
  }

  type AiRecommendation {
    id: UUID!
    type: AiRecommendationType!
    text: String!
    confidenceScore: Float
    provider: String
    approvalStatus: AiApprovalStatus!
    resolutionStatus: AiResolutionStatus!
    metadata: JSON!
    projectId: UUID!
    taskId: UUID
    sprintId: UUID
    requestedBy: User
    approvedBy: User
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AiRecommendationEdge {
    cursor: String!
    node: AiRecommendation!
  }

  type AiRecommendationConnection {
    edges: [AiRecommendationEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type AssignmentCandidate {
    user: User!
    skills: [String!]!
    expertise: [String!]!
    workload: Int!
    availability: AvailabilityStatus
    activeTaskCount: Int!
    completedTasks: Int!
  }

  type AssignmentContext {
    taskId: UUID!
    candidates: [AssignmentCandidate!]!
  }

  input OverrideRecommendationInput {
    storyPoints: Int
    assigneeId: UUID
  }

  extend type Project {
    aiRecommendations(
      first: Int
      after: String
      type: AiRecommendationType
      approvalStatus: AiApprovalStatus
    ): AiRecommendationConnection!
  }

  extend type Query {
    aiRecommendation(id: UUID!): AiRecommendation!
    assignmentContext(taskId: UUID!): AssignmentContext!
  }

  extend type Mutation {
    requestStoryPointEstimate(taskId: UUID!): AiRecommendation!
    requestAssignmentRecommendation(taskId: UUID!): AiRecommendation!
    requestSprintHealthAnalysis(sprintId: UUID!): AiRecommendation!
    requestProgressTracking(sprintId: UUID!): AiRecommendation!
    approveRecommendation(id: UUID!): AiRecommendation!
    rejectRecommendation(id: UUID!): AiRecommendation!
    overrideRecommendation(id: UUID!, input: OverrideRecommendationInput!): AiRecommendation!
  }
`;
