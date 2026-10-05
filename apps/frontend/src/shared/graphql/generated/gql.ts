/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
  '\n  query CurrentUser {\n    me {\n      id\n      email\n      name\n      avatarUrl\n      seniority\n      organizationCount\n    }\n  }\n': typeof types.CurrentUserDocument;
  '\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      accessToken\n      user {\n        id\n        email\n        name\n        avatarUrl\n        seniority\n        organizationCount\n      }\n    }\n  }\n': typeof types.LoginDocument;
  '\n  mutation Register($input: RegisterInput!) {\n    register(input: $input) {\n      accessToken\n      user {\n        id\n        email\n        name\n        avatarUrl\n        seniority\n        organizationCount\n      }\n    }\n  }\n': typeof types.RegisterDocument;
  '\n  mutation Logout {\n    logout\n  }\n': typeof types.LogoutDocument;
  '\n  query Sessions {\n    sessions {\n      id\n      userAgent\n      ipAddress\n      createdAt\n      expiresAt\n      current\n    }\n  }\n': typeof types.SessionsDocument;
  '\n  mutation RevokeSession($sessionId: UUID!) {\n    revokeSession(sessionId: $sessionId)\n  }\n': typeof types.RevokeSessionDocument;
  '\n  mutation ChangePassword($input: ChangePasswordInput!) {\n    changePassword(input: $input)\n  }\n': typeof types.ChangePasswordDocument;
  '\n  mutation RequestPasswordReset($email: String!) {\n    requestPasswordReset(email: $email)\n  }\n': typeof types.RequestPasswordResetDocument;
  '\n  mutation AcceptInvitation($token: String!) {\n    acceptInvitation(token: $token) {\n      id\n      role\n      user {\n        id\n        name\n      }\n    }\n  }\n': typeof types.AcceptInvitationDocument;
  '\n  fragment CommentPerson on User {\n    id\n    name\n    avatarUrl\n  }\n': typeof types.CommentPersonFragmentDoc;
  '\n  fragment AttachmentItem on Attachment {\n    id\n    filename\n    contentType\n    sizeBytes\n    createdAt\n    uploadedBy {\n      id\n      name\n    }\n  }\n': typeof types.AttachmentItemFragmentDoc;
  '\n  fragment CommentBody on Comment {\n    __typename\n    id\n    body\n    resolved\n    edited\n    editedAt\n    taskId\n    parentCommentId\n    createdAt\n    author {\n      __typename\n      ...CommentPerson\n    }\n    mentions {\n      __typename\n      id\n      name\n    }\n    attachments {\n      ...AttachmentItem\n    }\n  }\n': typeof types.CommentBodyFragmentDoc;
  '\n  fragment CommentThread on Comment {\n    ...CommentBody\n    replies {\n      ...CommentBody\n    }\n  }\n': typeof types.CommentThreadFragmentDoc;
  '\n  query TaskComments($taskId: UUID!, $first: Int, $after: String) {\n    task(id: $taskId) {\n      id\n      comments(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            ...CommentThread\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n': typeof types.TaskCommentsDocument;
  '\n  query LinkedComment($id: UUID!) {\n    comment(id: $id) {\n      ...CommentThread\n    }\n  }\n': typeof types.LinkedCommentDocument;
  '\n  query TaskAttachments($taskId: UUID!) {\n    task(id: $taskId) {\n      id\n      attachments {\n        ...AttachmentItem\n      }\n    }\n  }\n': typeof types.TaskAttachmentsDocument;
  '\n  mutation CreateComment($taskId: UUID!, $input: CreateCommentInput!) {\n    createComment(taskId: $taskId, input: $input) {\n      ...CommentThread\n    }\n  }\n': typeof types.CreateCommentDocument;
  '\n  mutation EditComment($id: UUID!, $input: UpdateCommentInput!) {\n    editComment(id: $id, input: $input) {\n      id\n      body\n      edited\n      editedAt\n    }\n  }\n': typeof types.EditCommentDocument;
  '\n  mutation ResolveComment($id: UUID!, $resolved: Boolean!) {\n    resolveComment(id: $id, resolved: $resolved) {\n      __typename\n      id\n      resolved\n    }\n  }\n': typeof types.ResolveCommentDocument;
  '\n  mutation DeleteComment($id: UUID!) {\n    deleteComment(id: $id)\n  }\n': typeof types.DeleteCommentDocument;
  '\n  mutation AddTaskAttachment($taskId: UUID!, $input: AddAttachmentInput!) {\n    addTaskAttachment(taskId: $taskId, input: $input) {\n      ...AttachmentItem\n    }\n  }\n': typeof types.AddTaskAttachmentDocument;
  '\n  mutation AddCommentAttachment(\n    $commentId: UUID!\n    $input: AddAttachmentInput!\n  ) {\n    addCommentAttachment(commentId: $commentId, input: $input) {\n      ...AttachmentItem\n    }\n  }\n': typeof types.AddCommentAttachmentDocument;
  '\n  mutation RemoveAttachment($id: UUID!) {\n    removeAttachment(id: $id)\n  }\n': typeof types.RemoveAttachmentDocument;
  '\n  fragment EpicSummary on Epic {\n    id\n    name\n    description\n    projectId\n    progress\n    completedTasks\n    totalTasks\n  }\n': typeof types.EpicSummaryFragmentDoc;
  '\n  query ProjectEpics($projectId: UUID!, $first: Int, $after: String) {\n    project(id: $projectId) {\n      id\n      epics(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            ...EpicSummary\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n': typeof types.ProjectEpicsDocument;
  '\n  query Epic($id: UUID!, $tasksFirst: Int, $tasksAfter: String) {\n    epic(id: $id) {\n      ...EpicSummary\n      milestones {\n        id\n        name\n        description\n        dueDate\n        epicId\n      }\n      tasks(first: $tasksFirst, after: $tasksAfter) {\n        edges {\n          cursor\n          node {\n            id\n            title\n            status\n            storyPoints\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n': typeof types.EpicDocument;
  '\n  mutation CreateEpic($projectId: UUID!, $input: CreateEpicInput!) {\n    createEpic(projectId: $projectId, input: $input) {\n      ...EpicSummary\n    }\n  }\n': typeof types.CreateEpicDocument;
  '\n  mutation UpdateEpic($id: UUID!, $input: UpdateEpicInput!) {\n    updateEpic(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n': typeof types.UpdateEpicDocument;
  '\n  mutation DeleteEpic($id: UUID!) {\n    deleteEpic(id: $id)\n  }\n': typeof types.DeleteEpicDocument;
  '\n  mutation RefreshEpicProgress($id: UUID!) {\n    refreshEpicProgress(id: $id) {\n      id\n      progress\n      completedTasks\n      totalTasks\n    }\n  }\n': typeof types.RefreshEpicProgressDocument;
  '\n  mutation CreateMilestone($projectId: UUID!, $input: CreateMilestoneInput!) {\n    createMilestone(projectId: $projectId, input: $input) {\n      id\n      name\n      description\n      dueDate\n      epicId\n    }\n  }\n': typeof types.CreateMilestoneDocument;
  '\n  mutation DeleteMilestone($id: UUID!) {\n    deleteMilestone(id: $id)\n  }\n': typeof types.DeleteMilestoneDocument;
  '\n  query MyNotifications($first: Int, $after: String, $unreadOnly: Boolean) {\n    myNotifications(first: $first, after: $after, unreadOnly: $unreadOnly) {\n      edges {\n        cursor\n        node {\n          id\n          type\n          title\n          body\n          read\n          createdAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n': typeof types.MyNotificationsDocument;
  '\n  query UnreadNotificationCount {\n    unreadNotificationCount\n  }\n': typeof types.UnreadNotificationCountDocument;
  '\n  query MyOrganizations($first: Int, $after: String) {\n    myOrganizations(first: $first, after: $after) {\n      edges {\n        cursor\n        node {\n          id\n          name\n          description\n          logoUrl\n          memberCount\n          projectCount\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n': typeof types.MyOrganizationsDocument;
  '\n  query Organization($id: UUID!, $first: Int, $after: String) {\n    organization(id: $id) {\n      id\n      name\n      description\n      logoUrl\n      memberCount\n      projectCount\n      owner {\n        id\n        name\n      }\n      members(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            id\n            role\n            createdAt\n            user {\n              id\n              name\n              email\n              avatarUrl\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n': typeof types.OrganizationDocument;
  '\n  query OrganizationProjects(\n    $id: UUID!\n    $status: ProjectState\n    $first: Int\n    $after: String\n  ) {\n    organization(id: $id) {\n      id\n      projects(first: $first, after: $after, status: $status) {\n        edges {\n          cursor\n          node {\n            id\n            name\n            description\n            status\n            memberCount\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n': typeof types.OrganizationProjectsDocument;
  '\n  query OrganizationInvitations($organizationId: UUID!) {\n    organizationInvitations(organizationId: $organizationId) {\n      id\n      email\n      role\n      status\n      expiresAt\n      createdAt\n    }\n  }\n': typeof types.OrganizationInvitationsDocument;
  '\n  mutation CreateOrganization($input: CreateOrganizationInput!) {\n    createOrganization(input: $input) {\n      id\n      name\n      description\n      logoUrl\n      memberCount\n      projectCount\n    }\n  }\n': typeof types.CreateOrganizationDocument;
  '\n  mutation UpdateOrganization($id: UUID!, $input: UpdateOrganizationInput!) {\n    updateOrganization(id: $id, input: $input) {\n      id\n      name\n      description\n      logoUrl\n    }\n  }\n': typeof types.UpdateOrganizationDocument;
  '\n  mutation DeleteOrganization($id: UUID!) {\n    deleteOrganization(id: $id)\n  }\n': typeof types.DeleteOrganizationDocument;
  '\n  mutation UpdateMemberRole(\n    $organizationId: UUID!\n    $userId: UUID!\n    $role: OrgRole!\n  ) {\n    updateMemberRole(\n      organizationId: $organizationId\n      userId: $userId\n      role: $role\n    ) {\n      id\n      role\n    }\n  }\n': typeof types.UpdateMemberRoleDocument;
  '\n  mutation RemoveMember($organizationId: UUID!, $userId: UUID!) {\n    removeMember(organizationId: $organizationId, userId: $userId)\n  }\n': typeof types.RemoveMemberDocument;
  '\n  mutation InviteToOrganization(\n    $organizationId: UUID!\n    $input: InviteMemberInput!\n  ) {\n    inviteToOrganization(organizationId: $organizationId, input: $input) {\n      id\n      email\n      role\n      status\n      expiresAt\n      createdAt\n    }\n  }\n': typeof types.InviteToOrganizationDocument;
  '\n  mutation RevokeInvitation($invitationId: UUID!) {\n    revokeInvitation(invitationId: $invitationId)\n  }\n': typeof types.RevokeInvitationDocument;
  '\n  query Project($id: UUID!, $first: Int, $after: String) {\n    project(id: $id) {\n      id\n      name\n      description\n      status\n      organizationId\n      memberCount\n      teamCount\n      settings {\n        workflow\n      }\n      members(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            id\n            role\n            createdAt\n            user {\n              id\n              name\n              email\n              avatarUrl\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n      teams {\n        id\n        name\n        description\n        memberCount\n        members {\n          id\n          role\n          user {\n            id\n          }\n        }\n      }\n    }\n  }\n': typeof types.ProjectDocument;
  '\n  mutation CreateProject($organizationId: UUID!, $input: CreateProjectInput!) {\n    createProject(organizationId: $organizationId, input: $input) {\n      id\n      name\n      description\n      status\n      memberCount\n    }\n  }\n': typeof types.CreateProjectDocument;
  '\n  mutation UpdateProject($id: UUID!, $input: UpdateProjectInput!) {\n    updateProject(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n': typeof types.UpdateProjectDocument;
  '\n  mutation ChangeProjectStatus($id: UUID!, $status: ProjectState!) {\n    changeProjectStatus(id: $id, status: $status) {\n      id\n      status\n    }\n  }\n': typeof types.ChangeProjectStatusDocument;
  '\n  mutation DeleteProject($id: UUID!) {\n    deleteProject(id: $id)\n  }\n': typeof types.DeleteProjectDocument;
  '\n  mutation ConfigureWorkflow($id: UUID!, $workflow: JSON!) {\n    configureWorkflow(id: $id, workflow: $workflow) {\n      id\n      settings {\n        workflow\n      }\n    }\n  }\n': typeof types.ConfigureWorkflowDocument;
  '\n  mutation AddProjectMember(\n    $projectId: UUID!\n    $userId: UUID!\n    $role: ProjectRole!\n  ) {\n    addProjectMember(projectId: $projectId, userId: $userId, role: $role) {\n      id\n      role\n    }\n  }\n': typeof types.AddProjectMemberDocument;
  '\n  mutation UpdateProjectMemberRole(\n    $projectId: UUID!\n    $userId: UUID!\n    $role: ProjectRole!\n  ) {\n    updateProjectMemberRole(\n      projectId: $projectId\n      userId: $userId\n      role: $role\n    ) {\n      id\n      role\n    }\n  }\n': typeof types.UpdateProjectMemberRoleDocument;
  '\n  mutation RemoveProjectMember($projectId: UUID!, $userId: UUID!) {\n    removeProjectMember(projectId: $projectId, userId: $userId)\n  }\n': typeof types.RemoveProjectMemberDocument;
  '\n  fragment SprintSummary on Sprint {\n    id\n    name\n    goal\n    state\n    startDate\n    endDate\n    capacity\n    projectId\n    taskCount\n  }\n': typeof types.SprintSummaryFragmentDoc;
  '\n  fragment SprintTask on Task {\n    id\n    title\n    status\n    priority\n    storyPoints\n    sprintId\n    assignee {\n      id\n      name\n      avatarUrl\n    }\n  }\n': typeof types.SprintTaskFragmentDoc;
  '\n  query ProjectSprints($projectId: UUID!, $first: Int, $after: String) {\n    project(id: $projectId) {\n      id\n      sprints(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            ...SprintSummary\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n': typeof types.ProjectSprintsDocument;
  '\n  query Sprint($id: UUID!, $tasksFirst: Int, $tasksAfter: String) {\n    sprint(id: $id) {\n      ...SprintSummary\n      metrics {\n        totalStoryPoints\n        completedStoryPoints\n        remainingStoryPoints\n        totalTasks\n        completedTasks\n        completionRate\n        velocity\n        capacity\n        overCapacity\n        workloadDistribution {\n          assigneeId\n          storyPoints\n          taskCount\n          user {\n            id\n            name\n            avatarUrl\n          }\n        }\n      }\n      burndown {\n        date\n        idealRemaining\n        actualRemaining\n      }\n      tasks(first: $tasksFirst, after: $tasksAfter) {\n        edges {\n          cursor\n          node {\n            ...SprintTask\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n': typeof types.SprintDocument;
  '\n  query SprintTaskCandidates($projectId: UUID!, $first: Int) {\n    project(id: $projectId) {\n      id\n      tasks(first: $first, sortField: CREATED_AT, sortDirection: DESC) {\n        edges {\n          cursor\n          node {\n            id\n            title\n            status\n            sprintId\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n': typeof types.SprintTaskCandidatesDocument;
  '\n  mutation CreateSprint($projectId: UUID!, $input: CreateSprintInput!) {\n    createSprint(projectId: $projectId, input: $input) {\n      ...SprintSummary\n    }\n  }\n': typeof types.CreateSprintDocument;
  '\n  mutation UpdateSprint($id: UUID!, $input: UpdateSprintInput!) {\n    updateSprint(id: $id, input: $input) {\n      ...SprintSummary\n    }\n  }\n': typeof types.UpdateSprintDocument;
  '\n  mutation ChangeSprintState($id: UUID!, $state: SprintState!) {\n    changeSprintState(id: $id, state: $state) {\n      id\n      state\n    }\n  }\n': typeof types.ChangeSprintStateDocument;
  '\n  mutation DeleteSprint($id: UUID!) {\n    deleteSprint(id: $id)\n  }\n': typeof types.DeleteSprintDocument;
  '\n  mutation AddTaskToSprint($sprintId: UUID!, $taskId: UUID!) {\n    addTaskToSprint(sprintId: $sprintId, taskId: $taskId) {\n      id\n    }\n  }\n': typeof types.AddTaskToSprintDocument;
  '\n  mutation RemoveTaskFromSprint($sprintId: UUID!, $taskId: UUID!) {\n    removeTaskFromSprint(sprintId: $sprintId, taskId: $taskId) {\n      id\n    }\n  }\n': typeof types.RemoveTaskFromSprintDocument;
  '\n  fragment TaskPerson on User {\n    id\n    name\n    avatarUrl\n  }\n': typeof types.TaskPersonFragmentDoc;
  '\n  fragment TaskCard on Task {\n    id\n    title\n    priority\n    status\n    storyPoints\n    projectId\n    assigneeId\n    reporterId\n    sprintId\n    epicId\n    dueDate\n    createdAt\n    assignee {\n      ...TaskPerson\n    }\n    labels {\n      id\n      name\n    }\n  }\n': typeof types.TaskCardFragmentDoc;
  '\n  fragment TaskPage on TaskConnection {\n    edges {\n      cursor\n      node {\n        ...TaskCard\n      }\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    totalCount\n  }\n': typeof types.TaskPageFragmentDoc;
  '\n  fragment TaskDetail on Task {\n    ...TaskCard\n    description\n    loggedSeconds\n    updatedAt\n    reporter {\n      ...TaskPerson\n    }\n    watchers {\n      ...TaskPerson\n    }\n    dependencies {\n      id\n      title\n      status\n    }\n  }\n': typeof types.TaskDetailFragmentDoc;
  '\n  fragment TaskActivity on ActivityLog {\n    id\n    type\n    metadata\n    createdAt\n    actor {\n      id\n      name\n    }\n  }\n': typeof types.TaskActivityFragmentDoc;
  '\n  query ProjectBoard($projectId: UUID!, $first: Int) {\n    project(id: $projectId) {\n      id\n      backlog: tasks(first: $first, filter: { status: BACKLOG }) {\n        ...TaskPage\n      }\n      todo: tasks(first: $first, filter: { status: TODO }) {\n        ...TaskPage\n      }\n      inProgress: tasks(first: $first, filter: { status: IN_PROGRESS }) {\n        ...TaskPage\n      }\n      inReview: tasks(first: $first, filter: { status: IN_REVIEW }) {\n        ...TaskPage\n      }\n      testing: tasks(first: $first, filter: { status: TESTING }) {\n        ...TaskPage\n      }\n      done: tasks(first: $first, filter: { status: DONE }) {\n        ...TaskPage\n      }\n      blocked: tasks(first: $first, filter: { status: BLOCKED }) {\n        ...TaskPage\n      }\n    }\n  }\n': typeof types.ProjectBoardDocument;
  '\n  query ProjectBoardColumn(\n    $projectId: UUID!\n    $status: TaskStatus!\n    $first: Int\n    $after: String\n  ) {\n    project(id: $projectId) {\n      id\n      tasks(first: $first, after: $after, filter: { status: $status }) {\n        ...TaskPage\n      }\n    }\n  }\n': typeof types.ProjectBoardColumnDocument;
  '\n  query ProjectTasks(\n    $projectId: UUID!\n    $first: Int\n    $after: String\n    $filter: TaskFilter\n    $sortField: TaskSortField\n    $sortDirection: SortDirection\n  ) {\n    project(id: $projectId) {\n      id\n      tasks(\n        first: $first\n        after: $after\n        filter: $filter\n        sortField: $sortField\n        sortDirection: $sortDirection\n      ) {\n        ...TaskPage\n      }\n    }\n  }\n': typeof types.ProjectTasksDocument;
  '\n  query ProjectTaskOptions($projectId: UUID!, $first: Int) {\n    project(id: $projectId) {\n      id\n      tasks(first: $first, sortField: CREATED_AT, sortDirection: DESC) {\n        edges {\n          cursor\n          node {\n            id\n            title\n            status\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n': typeof types.ProjectTaskOptionsDocument;
  '\n  query ProjectPlanning($projectId: UUID!, $first: Int) {\n    project(id: $projectId) {\n      id\n      sprints(first: $first) {\n        edges {\n          cursor\n          node {\n            id\n            name\n            state\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n      epics(first: $first) {\n        edges {\n          cursor\n          node {\n            id\n            name\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n': typeof types.ProjectPlanningDocument;
  '\n  query Task($id: UUID!, $activitiesFirst: Int, $activitiesAfter: String) {\n    task(id: $id) {\n      ...TaskDetail\n      activities(first: $activitiesFirst, after: $activitiesAfter) {\n        edges {\n          cursor\n          node {\n            ...TaskActivity\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n': typeof types.TaskDocument;
  '\n  mutation CreateTask($projectId: UUID!, $input: CreateTaskInput!) {\n    createTask(projectId: $projectId, input: $input) {\n      ...TaskCard\n    }\n  }\n': typeof types.CreateTaskDocument;
  '\n  mutation UpdateTask($id: UUID!, $input: UpdateTaskInput!) {\n    updateTask(id: $id, input: $input) {\n      id\n      title\n      description\n      priority\n      dueDate\n      updatedAt\n    }\n  }\n': typeof types.UpdateTaskDocument;
  '\n  mutation ChangeTaskStatus($id: UUID!, $status: TaskStatus!) {\n    changeTaskStatus(id: $id, status: $status) {\n      __typename\n      id\n      status\n    }\n  }\n': typeof types.ChangeTaskStatusDocument;
  '\n  mutation AssignTask($id: UUID!, $assigneeId: UUID) {\n    assignTask(id: $id, assigneeId: $assigneeId) {\n      __typename\n      id\n      assigneeId\n      assignee {\n        __typename\n        ...TaskPerson\n      }\n    }\n  }\n': typeof types.AssignTaskDocument;
  '\n  mutation SetTaskStoryPoints($id: UUID!, $storyPoints: Int) {\n    setTaskStoryPoints(id: $id, storyPoints: $storyPoints) {\n      __typename\n      id\n      storyPoints\n    }\n  }\n': typeof types.SetTaskStoryPointsDocument;
  '\n  mutation MoveTaskToSprint($id: UUID!, $sprintId: UUID) {\n    moveTaskToSprint(id: $id, sprintId: $sprintId) {\n      id\n      sprintId\n    }\n  }\n': typeof types.MoveTaskToSprintDocument;
  '\n  mutation DeleteTask($id: UUID!) {\n    deleteTask(id: $id)\n  }\n': typeof types.DeleteTaskDocument;
  '\n  mutation LogTaskTime($id: UUID!, $seconds: Int!) {\n    logTaskTime(id: $id, seconds: $seconds) {\n      id\n      loggedSeconds\n    }\n  }\n': typeof types.LogTaskTimeDocument;
  '\n  mutation AddTaskDependency($taskId: UUID!, $dependsOnTaskId: UUID!) {\n    addTaskDependency(taskId: $taskId, dependsOnTaskId: $dependsOnTaskId) {\n      id\n      dependencies {\n        id\n        title\n        status\n      }\n    }\n  }\n': typeof types.AddTaskDependencyDocument;
  '\n  mutation RemoveTaskDependency($taskId: UUID!, $dependsOnTaskId: UUID!) {\n    removeTaskDependency(taskId: $taskId, dependsOnTaskId: $dependsOnTaskId) {\n      id\n      dependencies {\n        id\n        title\n        status\n      }\n    }\n  }\n': typeof types.RemoveTaskDependencyDocument;
  '\n  mutation WatchTask($taskId: UUID!) {\n    watchTask(taskId: $taskId) {\n      id\n      watchers {\n        ...TaskPerson\n      }\n    }\n  }\n': typeof types.WatchTaskDocument;
  '\n  mutation UnwatchTask($taskId: UUID!) {\n    unwatchTask(taskId: $taskId) {\n      id\n      watchers {\n        ...TaskPerson\n      }\n    }\n  }\n': typeof types.UnwatchTaskDocument;
  '\n  mutation AddTaskLabel($taskId: UUID!, $name: String!) {\n    addTaskLabel(taskId: $taskId, name: $name) {\n      id\n      labels {\n        id\n        name\n      }\n    }\n  }\n': typeof types.AddTaskLabelDocument;
  '\n  mutation RemoveTaskLabel($taskId: UUID!, $name: String!) {\n    removeTaskLabel(taskId: $taskId, name: $name) {\n      id\n      labels {\n        id\n        name\n      }\n    }\n  }\n': typeof types.RemoveTaskLabelDocument;
  '\n  query Team($id: UUID!) {\n    team(id: $id) {\n      id\n      name\n      description\n      projectId\n      memberCount\n      members {\n        id\n        role\n        responsibilities\n        availability\n        workload\n        createdAt\n        user {\n          id\n          name\n          email\n          avatarUrl\n        }\n      }\n    }\n  }\n': typeof types.TeamDocument;
  '\n  mutation CreateTeam($projectId: UUID!, $input: CreateTeamInput!) {\n    createTeam(projectId: $projectId, input: $input) {\n      id\n      name\n      description\n      memberCount\n    }\n  }\n': typeof types.CreateTeamDocument;
  '\n  mutation UpdateTeam($id: UUID!, $input: UpdateTeamInput!) {\n    updateTeam(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n': typeof types.UpdateTeamDocument;
  '\n  mutation DeleteTeam($id: UUID!) {\n    deleteTeam(id: $id)\n  }\n': typeof types.DeleteTeamDocument;
  '\n  mutation AddTeamMember(\n    $teamId: UUID!\n    $userId: UUID!\n    $input: AddTeamMemberInput!\n  ) {\n    addTeamMember(teamId: $teamId, userId: $userId, input: $input) {\n      id\n      role\n      responsibilities\n      availability\n      workload\n    }\n  }\n': typeof types.AddTeamMemberDocument;
  '\n  mutation UpdateTeamMember(\n    $teamId: UUID!\n    $userId: UUID!\n    $input: UpdateTeamMemberInput!\n  ) {\n    updateTeamMember(teamId: $teamId, userId: $userId, input: $input) {\n      id\n      role\n      responsibilities\n      availability\n      workload\n    }\n  }\n': typeof types.UpdateTeamMemberDocument;
  '\n  mutation RemoveTeamMember($teamId: UUID!, $userId: UUID!) {\n    removeTeamMember(teamId: $teamId, userId: $userId)\n  }\n': typeof types.RemoveTeamMemberDocument;
  '\n  query MyProfile {\n    me {\n      id\n      email\n      name\n      avatarUrl\n      seniority\n      skills\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n': typeof types.MyProfileDocument;
  '\n  query UserProfile($id: UUID!) {\n    user(id: $id) {\n      id\n      name\n      avatarUrl\n      seniority\n      skills\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n      teamMemberships {\n        teamId\n        teamName\n        role\n        availability\n        workload\n      }\n    }\n  }\n': typeof types.UserProfileDocument;
  '\n  mutation UpdateProfile($input: UpdateProfileInput!) {\n    updateProfile(input: $input) {\n      id\n      name\n      avatarUrl\n      seniority\n    }\n  }\n': typeof types.UpdateProfileDocument;
  '\n  mutation AddSkill($skill: String!) {\n    addSkill(skill: $skill) {\n      id\n      skills\n    }\n  }\n': typeof types.AddSkillDocument;
  '\n  mutation RemoveSkill($skill: String!) {\n    removeSkill(skill: $skill) {\n      id\n      skills\n    }\n  }\n': typeof types.RemoveSkillDocument;
  '\n  mutation AddExpertise($input: AddExpertiseInput!) {\n    addExpertise(input: $input) {\n      id\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n': typeof types.AddExpertiseDocument;
  '\n  mutation RemoveExpertise($tag: String!) {\n    removeExpertise(tag: $tag) {\n      id\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n': typeof types.RemoveExpertiseDocument;
  '\n  query Health {\n    health {\n      status\n      uptimeSeconds\n      timestamp\n    }\n  }\n': typeof types.HealthDocument;
};
const documents: Documents = {
  '\n  query CurrentUser {\n    me {\n      id\n      email\n      name\n      avatarUrl\n      seniority\n      organizationCount\n    }\n  }\n':
    types.CurrentUserDocument,
  '\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      accessToken\n      user {\n        id\n        email\n        name\n        avatarUrl\n        seniority\n        organizationCount\n      }\n    }\n  }\n':
    types.LoginDocument,
  '\n  mutation Register($input: RegisterInput!) {\n    register(input: $input) {\n      accessToken\n      user {\n        id\n        email\n        name\n        avatarUrl\n        seniority\n        organizationCount\n      }\n    }\n  }\n':
    types.RegisterDocument,
  '\n  mutation Logout {\n    logout\n  }\n': types.LogoutDocument,
  '\n  query Sessions {\n    sessions {\n      id\n      userAgent\n      ipAddress\n      createdAt\n      expiresAt\n      current\n    }\n  }\n':
    types.SessionsDocument,
  '\n  mutation RevokeSession($sessionId: UUID!) {\n    revokeSession(sessionId: $sessionId)\n  }\n':
    types.RevokeSessionDocument,
  '\n  mutation ChangePassword($input: ChangePasswordInput!) {\n    changePassword(input: $input)\n  }\n':
    types.ChangePasswordDocument,
  '\n  mutation RequestPasswordReset($email: String!) {\n    requestPasswordReset(email: $email)\n  }\n':
    types.RequestPasswordResetDocument,
  '\n  mutation AcceptInvitation($token: String!) {\n    acceptInvitation(token: $token) {\n      id\n      role\n      user {\n        id\n        name\n      }\n    }\n  }\n':
    types.AcceptInvitationDocument,
  '\n  fragment CommentPerson on User {\n    id\n    name\n    avatarUrl\n  }\n':
    types.CommentPersonFragmentDoc,
  '\n  fragment AttachmentItem on Attachment {\n    id\n    filename\n    contentType\n    sizeBytes\n    createdAt\n    uploadedBy {\n      id\n      name\n    }\n  }\n':
    types.AttachmentItemFragmentDoc,
  '\n  fragment CommentBody on Comment {\n    __typename\n    id\n    body\n    resolved\n    edited\n    editedAt\n    taskId\n    parentCommentId\n    createdAt\n    author {\n      __typename\n      ...CommentPerson\n    }\n    mentions {\n      __typename\n      id\n      name\n    }\n    attachments {\n      ...AttachmentItem\n    }\n  }\n':
    types.CommentBodyFragmentDoc,
  '\n  fragment CommentThread on Comment {\n    ...CommentBody\n    replies {\n      ...CommentBody\n    }\n  }\n':
    types.CommentThreadFragmentDoc,
  '\n  query TaskComments($taskId: UUID!, $first: Int, $after: String) {\n    task(id: $taskId) {\n      id\n      comments(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            ...CommentThread\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n':
    types.TaskCommentsDocument,
  '\n  query LinkedComment($id: UUID!) {\n    comment(id: $id) {\n      ...CommentThread\n    }\n  }\n':
    types.LinkedCommentDocument,
  '\n  query TaskAttachments($taskId: UUID!) {\n    task(id: $taskId) {\n      id\n      attachments {\n        ...AttachmentItem\n      }\n    }\n  }\n':
    types.TaskAttachmentsDocument,
  '\n  mutation CreateComment($taskId: UUID!, $input: CreateCommentInput!) {\n    createComment(taskId: $taskId, input: $input) {\n      ...CommentThread\n    }\n  }\n':
    types.CreateCommentDocument,
  '\n  mutation EditComment($id: UUID!, $input: UpdateCommentInput!) {\n    editComment(id: $id, input: $input) {\n      id\n      body\n      edited\n      editedAt\n    }\n  }\n':
    types.EditCommentDocument,
  '\n  mutation ResolveComment($id: UUID!, $resolved: Boolean!) {\n    resolveComment(id: $id, resolved: $resolved) {\n      __typename\n      id\n      resolved\n    }\n  }\n':
    types.ResolveCommentDocument,
  '\n  mutation DeleteComment($id: UUID!) {\n    deleteComment(id: $id)\n  }\n':
    types.DeleteCommentDocument,
  '\n  mutation AddTaskAttachment($taskId: UUID!, $input: AddAttachmentInput!) {\n    addTaskAttachment(taskId: $taskId, input: $input) {\n      ...AttachmentItem\n    }\n  }\n':
    types.AddTaskAttachmentDocument,
  '\n  mutation AddCommentAttachment(\n    $commentId: UUID!\n    $input: AddAttachmentInput!\n  ) {\n    addCommentAttachment(commentId: $commentId, input: $input) {\n      ...AttachmentItem\n    }\n  }\n':
    types.AddCommentAttachmentDocument,
  '\n  mutation RemoveAttachment($id: UUID!) {\n    removeAttachment(id: $id)\n  }\n':
    types.RemoveAttachmentDocument,
  '\n  fragment EpicSummary on Epic {\n    id\n    name\n    description\n    projectId\n    progress\n    completedTasks\n    totalTasks\n  }\n':
    types.EpicSummaryFragmentDoc,
  '\n  query ProjectEpics($projectId: UUID!, $first: Int, $after: String) {\n    project(id: $projectId) {\n      id\n      epics(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            ...EpicSummary\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n':
    types.ProjectEpicsDocument,
  '\n  query Epic($id: UUID!, $tasksFirst: Int, $tasksAfter: String) {\n    epic(id: $id) {\n      ...EpicSummary\n      milestones {\n        id\n        name\n        description\n        dueDate\n        epicId\n      }\n      tasks(first: $tasksFirst, after: $tasksAfter) {\n        edges {\n          cursor\n          node {\n            id\n            title\n            status\n            storyPoints\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n':
    types.EpicDocument,
  '\n  mutation CreateEpic($projectId: UUID!, $input: CreateEpicInput!) {\n    createEpic(projectId: $projectId, input: $input) {\n      ...EpicSummary\n    }\n  }\n':
    types.CreateEpicDocument,
  '\n  mutation UpdateEpic($id: UUID!, $input: UpdateEpicInput!) {\n    updateEpic(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n':
    types.UpdateEpicDocument,
  '\n  mutation DeleteEpic($id: UUID!) {\n    deleteEpic(id: $id)\n  }\n':
    types.DeleteEpicDocument,
  '\n  mutation RefreshEpicProgress($id: UUID!) {\n    refreshEpicProgress(id: $id) {\n      id\n      progress\n      completedTasks\n      totalTasks\n    }\n  }\n':
    types.RefreshEpicProgressDocument,
  '\n  mutation CreateMilestone($projectId: UUID!, $input: CreateMilestoneInput!) {\n    createMilestone(projectId: $projectId, input: $input) {\n      id\n      name\n      description\n      dueDate\n      epicId\n    }\n  }\n':
    types.CreateMilestoneDocument,
  '\n  mutation DeleteMilestone($id: UUID!) {\n    deleteMilestone(id: $id)\n  }\n':
    types.DeleteMilestoneDocument,
  '\n  query MyNotifications($first: Int, $after: String, $unreadOnly: Boolean) {\n    myNotifications(first: $first, after: $after, unreadOnly: $unreadOnly) {\n      edges {\n        cursor\n        node {\n          id\n          type\n          title\n          body\n          read\n          createdAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n':
    types.MyNotificationsDocument,
  '\n  query UnreadNotificationCount {\n    unreadNotificationCount\n  }\n':
    types.UnreadNotificationCountDocument,
  '\n  query MyOrganizations($first: Int, $after: String) {\n    myOrganizations(first: $first, after: $after) {\n      edges {\n        cursor\n        node {\n          id\n          name\n          description\n          logoUrl\n          memberCount\n          projectCount\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n':
    types.MyOrganizationsDocument,
  '\n  query Organization($id: UUID!, $first: Int, $after: String) {\n    organization(id: $id) {\n      id\n      name\n      description\n      logoUrl\n      memberCount\n      projectCount\n      owner {\n        id\n        name\n      }\n      members(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            id\n            role\n            createdAt\n            user {\n              id\n              name\n              email\n              avatarUrl\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n':
    types.OrganizationDocument,
  '\n  query OrganizationProjects(\n    $id: UUID!\n    $status: ProjectState\n    $first: Int\n    $after: String\n  ) {\n    organization(id: $id) {\n      id\n      projects(first: $first, after: $after, status: $status) {\n        edges {\n          cursor\n          node {\n            id\n            name\n            description\n            status\n            memberCount\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n':
    types.OrganizationProjectsDocument,
  '\n  query OrganizationInvitations($organizationId: UUID!) {\n    organizationInvitations(organizationId: $organizationId) {\n      id\n      email\n      role\n      status\n      expiresAt\n      createdAt\n    }\n  }\n':
    types.OrganizationInvitationsDocument,
  '\n  mutation CreateOrganization($input: CreateOrganizationInput!) {\n    createOrganization(input: $input) {\n      id\n      name\n      description\n      logoUrl\n      memberCount\n      projectCount\n    }\n  }\n':
    types.CreateOrganizationDocument,
  '\n  mutation UpdateOrganization($id: UUID!, $input: UpdateOrganizationInput!) {\n    updateOrganization(id: $id, input: $input) {\n      id\n      name\n      description\n      logoUrl\n    }\n  }\n':
    types.UpdateOrganizationDocument,
  '\n  mutation DeleteOrganization($id: UUID!) {\n    deleteOrganization(id: $id)\n  }\n':
    types.DeleteOrganizationDocument,
  '\n  mutation UpdateMemberRole(\n    $organizationId: UUID!\n    $userId: UUID!\n    $role: OrgRole!\n  ) {\n    updateMemberRole(\n      organizationId: $organizationId\n      userId: $userId\n      role: $role\n    ) {\n      id\n      role\n    }\n  }\n':
    types.UpdateMemberRoleDocument,
  '\n  mutation RemoveMember($organizationId: UUID!, $userId: UUID!) {\n    removeMember(organizationId: $organizationId, userId: $userId)\n  }\n':
    types.RemoveMemberDocument,
  '\n  mutation InviteToOrganization(\n    $organizationId: UUID!\n    $input: InviteMemberInput!\n  ) {\n    inviteToOrganization(organizationId: $organizationId, input: $input) {\n      id\n      email\n      role\n      status\n      expiresAt\n      createdAt\n    }\n  }\n':
    types.InviteToOrganizationDocument,
  '\n  mutation RevokeInvitation($invitationId: UUID!) {\n    revokeInvitation(invitationId: $invitationId)\n  }\n':
    types.RevokeInvitationDocument,
  '\n  query Project($id: UUID!, $first: Int, $after: String) {\n    project(id: $id) {\n      id\n      name\n      description\n      status\n      organizationId\n      memberCount\n      teamCount\n      settings {\n        workflow\n      }\n      members(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            id\n            role\n            createdAt\n            user {\n              id\n              name\n              email\n              avatarUrl\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n      teams {\n        id\n        name\n        description\n        memberCount\n        members {\n          id\n          role\n          user {\n            id\n          }\n        }\n      }\n    }\n  }\n':
    types.ProjectDocument,
  '\n  mutation CreateProject($organizationId: UUID!, $input: CreateProjectInput!) {\n    createProject(organizationId: $organizationId, input: $input) {\n      id\n      name\n      description\n      status\n      memberCount\n    }\n  }\n':
    types.CreateProjectDocument,
  '\n  mutation UpdateProject($id: UUID!, $input: UpdateProjectInput!) {\n    updateProject(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n':
    types.UpdateProjectDocument,
  '\n  mutation ChangeProjectStatus($id: UUID!, $status: ProjectState!) {\n    changeProjectStatus(id: $id, status: $status) {\n      id\n      status\n    }\n  }\n':
    types.ChangeProjectStatusDocument,
  '\n  mutation DeleteProject($id: UUID!) {\n    deleteProject(id: $id)\n  }\n':
    types.DeleteProjectDocument,
  '\n  mutation ConfigureWorkflow($id: UUID!, $workflow: JSON!) {\n    configureWorkflow(id: $id, workflow: $workflow) {\n      id\n      settings {\n        workflow\n      }\n    }\n  }\n':
    types.ConfigureWorkflowDocument,
  '\n  mutation AddProjectMember(\n    $projectId: UUID!\n    $userId: UUID!\n    $role: ProjectRole!\n  ) {\n    addProjectMember(projectId: $projectId, userId: $userId, role: $role) {\n      id\n      role\n    }\n  }\n':
    types.AddProjectMemberDocument,
  '\n  mutation UpdateProjectMemberRole(\n    $projectId: UUID!\n    $userId: UUID!\n    $role: ProjectRole!\n  ) {\n    updateProjectMemberRole(\n      projectId: $projectId\n      userId: $userId\n      role: $role\n    ) {\n      id\n      role\n    }\n  }\n':
    types.UpdateProjectMemberRoleDocument,
  '\n  mutation RemoveProjectMember($projectId: UUID!, $userId: UUID!) {\n    removeProjectMember(projectId: $projectId, userId: $userId)\n  }\n':
    types.RemoveProjectMemberDocument,
  '\n  fragment SprintSummary on Sprint {\n    id\n    name\n    goal\n    state\n    startDate\n    endDate\n    capacity\n    projectId\n    taskCount\n  }\n':
    types.SprintSummaryFragmentDoc,
  '\n  fragment SprintTask on Task {\n    id\n    title\n    status\n    priority\n    storyPoints\n    sprintId\n    assignee {\n      id\n      name\n      avatarUrl\n    }\n  }\n':
    types.SprintTaskFragmentDoc,
  '\n  query ProjectSprints($projectId: UUID!, $first: Int, $after: String) {\n    project(id: $projectId) {\n      id\n      sprints(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            ...SprintSummary\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n':
    types.ProjectSprintsDocument,
  '\n  query Sprint($id: UUID!, $tasksFirst: Int, $tasksAfter: String) {\n    sprint(id: $id) {\n      ...SprintSummary\n      metrics {\n        totalStoryPoints\n        completedStoryPoints\n        remainingStoryPoints\n        totalTasks\n        completedTasks\n        completionRate\n        velocity\n        capacity\n        overCapacity\n        workloadDistribution {\n          assigneeId\n          storyPoints\n          taskCount\n          user {\n            id\n            name\n            avatarUrl\n          }\n        }\n      }\n      burndown {\n        date\n        idealRemaining\n        actualRemaining\n      }\n      tasks(first: $tasksFirst, after: $tasksAfter) {\n        edges {\n          cursor\n          node {\n            ...SprintTask\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n':
    types.SprintDocument,
  '\n  query SprintTaskCandidates($projectId: UUID!, $first: Int) {\n    project(id: $projectId) {\n      id\n      tasks(first: $first, sortField: CREATED_AT, sortDirection: DESC) {\n        edges {\n          cursor\n          node {\n            id\n            title\n            status\n            sprintId\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n':
    types.SprintTaskCandidatesDocument,
  '\n  mutation CreateSprint($projectId: UUID!, $input: CreateSprintInput!) {\n    createSprint(projectId: $projectId, input: $input) {\n      ...SprintSummary\n    }\n  }\n':
    types.CreateSprintDocument,
  '\n  mutation UpdateSprint($id: UUID!, $input: UpdateSprintInput!) {\n    updateSprint(id: $id, input: $input) {\n      ...SprintSummary\n    }\n  }\n':
    types.UpdateSprintDocument,
  '\n  mutation ChangeSprintState($id: UUID!, $state: SprintState!) {\n    changeSprintState(id: $id, state: $state) {\n      id\n      state\n    }\n  }\n':
    types.ChangeSprintStateDocument,
  '\n  mutation DeleteSprint($id: UUID!) {\n    deleteSprint(id: $id)\n  }\n':
    types.DeleteSprintDocument,
  '\n  mutation AddTaskToSprint($sprintId: UUID!, $taskId: UUID!) {\n    addTaskToSprint(sprintId: $sprintId, taskId: $taskId) {\n      id\n    }\n  }\n':
    types.AddTaskToSprintDocument,
  '\n  mutation RemoveTaskFromSprint($sprintId: UUID!, $taskId: UUID!) {\n    removeTaskFromSprint(sprintId: $sprintId, taskId: $taskId) {\n      id\n    }\n  }\n':
    types.RemoveTaskFromSprintDocument,
  '\n  fragment TaskPerson on User {\n    id\n    name\n    avatarUrl\n  }\n':
    types.TaskPersonFragmentDoc,
  '\n  fragment TaskCard on Task {\n    id\n    title\n    priority\n    status\n    storyPoints\n    projectId\n    assigneeId\n    reporterId\n    sprintId\n    epicId\n    dueDate\n    createdAt\n    assignee {\n      ...TaskPerson\n    }\n    labels {\n      id\n      name\n    }\n  }\n':
    types.TaskCardFragmentDoc,
  '\n  fragment TaskPage on TaskConnection {\n    edges {\n      cursor\n      node {\n        ...TaskCard\n      }\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    totalCount\n  }\n':
    types.TaskPageFragmentDoc,
  '\n  fragment TaskDetail on Task {\n    ...TaskCard\n    description\n    loggedSeconds\n    updatedAt\n    reporter {\n      ...TaskPerson\n    }\n    watchers {\n      ...TaskPerson\n    }\n    dependencies {\n      id\n      title\n      status\n    }\n  }\n':
    types.TaskDetailFragmentDoc,
  '\n  fragment TaskActivity on ActivityLog {\n    id\n    type\n    metadata\n    createdAt\n    actor {\n      id\n      name\n    }\n  }\n':
    types.TaskActivityFragmentDoc,
  '\n  query ProjectBoard($projectId: UUID!, $first: Int) {\n    project(id: $projectId) {\n      id\n      backlog: tasks(first: $first, filter: { status: BACKLOG }) {\n        ...TaskPage\n      }\n      todo: tasks(first: $first, filter: { status: TODO }) {\n        ...TaskPage\n      }\n      inProgress: tasks(first: $first, filter: { status: IN_PROGRESS }) {\n        ...TaskPage\n      }\n      inReview: tasks(first: $first, filter: { status: IN_REVIEW }) {\n        ...TaskPage\n      }\n      testing: tasks(first: $first, filter: { status: TESTING }) {\n        ...TaskPage\n      }\n      done: tasks(first: $first, filter: { status: DONE }) {\n        ...TaskPage\n      }\n      blocked: tasks(first: $first, filter: { status: BLOCKED }) {\n        ...TaskPage\n      }\n    }\n  }\n':
    types.ProjectBoardDocument,
  '\n  query ProjectBoardColumn(\n    $projectId: UUID!\n    $status: TaskStatus!\n    $first: Int\n    $after: String\n  ) {\n    project(id: $projectId) {\n      id\n      tasks(first: $first, after: $after, filter: { status: $status }) {\n        ...TaskPage\n      }\n    }\n  }\n':
    types.ProjectBoardColumnDocument,
  '\n  query ProjectTasks(\n    $projectId: UUID!\n    $first: Int\n    $after: String\n    $filter: TaskFilter\n    $sortField: TaskSortField\n    $sortDirection: SortDirection\n  ) {\n    project(id: $projectId) {\n      id\n      tasks(\n        first: $first\n        after: $after\n        filter: $filter\n        sortField: $sortField\n        sortDirection: $sortDirection\n      ) {\n        ...TaskPage\n      }\n    }\n  }\n':
    types.ProjectTasksDocument,
  '\n  query ProjectTaskOptions($projectId: UUID!, $first: Int) {\n    project(id: $projectId) {\n      id\n      tasks(first: $first, sortField: CREATED_AT, sortDirection: DESC) {\n        edges {\n          cursor\n          node {\n            id\n            title\n            status\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n':
    types.ProjectTaskOptionsDocument,
  '\n  query ProjectPlanning($projectId: UUID!, $first: Int) {\n    project(id: $projectId) {\n      id\n      sprints(first: $first) {\n        edges {\n          cursor\n          node {\n            id\n            name\n            state\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n      epics(first: $first) {\n        edges {\n          cursor\n          node {\n            id\n            name\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n':
    types.ProjectPlanningDocument,
  '\n  query Task($id: UUID!, $activitiesFirst: Int, $activitiesAfter: String) {\n    task(id: $id) {\n      ...TaskDetail\n      activities(first: $activitiesFirst, after: $activitiesAfter) {\n        edges {\n          cursor\n          node {\n            ...TaskActivity\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n':
    types.TaskDocument,
  '\n  mutation CreateTask($projectId: UUID!, $input: CreateTaskInput!) {\n    createTask(projectId: $projectId, input: $input) {\n      ...TaskCard\n    }\n  }\n':
    types.CreateTaskDocument,
  '\n  mutation UpdateTask($id: UUID!, $input: UpdateTaskInput!) {\n    updateTask(id: $id, input: $input) {\n      id\n      title\n      description\n      priority\n      dueDate\n      updatedAt\n    }\n  }\n':
    types.UpdateTaskDocument,
  '\n  mutation ChangeTaskStatus($id: UUID!, $status: TaskStatus!) {\n    changeTaskStatus(id: $id, status: $status) {\n      __typename\n      id\n      status\n    }\n  }\n':
    types.ChangeTaskStatusDocument,
  '\n  mutation AssignTask($id: UUID!, $assigneeId: UUID) {\n    assignTask(id: $id, assigneeId: $assigneeId) {\n      __typename\n      id\n      assigneeId\n      assignee {\n        __typename\n        ...TaskPerson\n      }\n    }\n  }\n':
    types.AssignTaskDocument,
  '\n  mutation SetTaskStoryPoints($id: UUID!, $storyPoints: Int) {\n    setTaskStoryPoints(id: $id, storyPoints: $storyPoints) {\n      __typename\n      id\n      storyPoints\n    }\n  }\n':
    types.SetTaskStoryPointsDocument,
  '\n  mutation MoveTaskToSprint($id: UUID!, $sprintId: UUID) {\n    moveTaskToSprint(id: $id, sprintId: $sprintId) {\n      id\n      sprintId\n    }\n  }\n':
    types.MoveTaskToSprintDocument,
  '\n  mutation DeleteTask($id: UUID!) {\n    deleteTask(id: $id)\n  }\n':
    types.DeleteTaskDocument,
  '\n  mutation LogTaskTime($id: UUID!, $seconds: Int!) {\n    logTaskTime(id: $id, seconds: $seconds) {\n      id\n      loggedSeconds\n    }\n  }\n':
    types.LogTaskTimeDocument,
  '\n  mutation AddTaskDependency($taskId: UUID!, $dependsOnTaskId: UUID!) {\n    addTaskDependency(taskId: $taskId, dependsOnTaskId: $dependsOnTaskId) {\n      id\n      dependencies {\n        id\n        title\n        status\n      }\n    }\n  }\n':
    types.AddTaskDependencyDocument,
  '\n  mutation RemoveTaskDependency($taskId: UUID!, $dependsOnTaskId: UUID!) {\n    removeTaskDependency(taskId: $taskId, dependsOnTaskId: $dependsOnTaskId) {\n      id\n      dependencies {\n        id\n        title\n        status\n      }\n    }\n  }\n':
    types.RemoveTaskDependencyDocument,
  '\n  mutation WatchTask($taskId: UUID!) {\n    watchTask(taskId: $taskId) {\n      id\n      watchers {\n        ...TaskPerson\n      }\n    }\n  }\n':
    types.WatchTaskDocument,
  '\n  mutation UnwatchTask($taskId: UUID!) {\n    unwatchTask(taskId: $taskId) {\n      id\n      watchers {\n        ...TaskPerson\n      }\n    }\n  }\n':
    types.UnwatchTaskDocument,
  '\n  mutation AddTaskLabel($taskId: UUID!, $name: String!) {\n    addTaskLabel(taskId: $taskId, name: $name) {\n      id\n      labels {\n        id\n        name\n      }\n    }\n  }\n':
    types.AddTaskLabelDocument,
  '\n  mutation RemoveTaskLabel($taskId: UUID!, $name: String!) {\n    removeTaskLabel(taskId: $taskId, name: $name) {\n      id\n      labels {\n        id\n        name\n      }\n    }\n  }\n':
    types.RemoveTaskLabelDocument,
  '\n  query Team($id: UUID!) {\n    team(id: $id) {\n      id\n      name\n      description\n      projectId\n      memberCount\n      members {\n        id\n        role\n        responsibilities\n        availability\n        workload\n        createdAt\n        user {\n          id\n          name\n          email\n          avatarUrl\n        }\n      }\n    }\n  }\n':
    types.TeamDocument,
  '\n  mutation CreateTeam($projectId: UUID!, $input: CreateTeamInput!) {\n    createTeam(projectId: $projectId, input: $input) {\n      id\n      name\n      description\n      memberCount\n    }\n  }\n':
    types.CreateTeamDocument,
  '\n  mutation UpdateTeam($id: UUID!, $input: UpdateTeamInput!) {\n    updateTeam(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n':
    types.UpdateTeamDocument,
  '\n  mutation DeleteTeam($id: UUID!) {\n    deleteTeam(id: $id)\n  }\n':
    types.DeleteTeamDocument,
  '\n  mutation AddTeamMember(\n    $teamId: UUID!\n    $userId: UUID!\n    $input: AddTeamMemberInput!\n  ) {\n    addTeamMember(teamId: $teamId, userId: $userId, input: $input) {\n      id\n      role\n      responsibilities\n      availability\n      workload\n    }\n  }\n':
    types.AddTeamMemberDocument,
  '\n  mutation UpdateTeamMember(\n    $teamId: UUID!\n    $userId: UUID!\n    $input: UpdateTeamMemberInput!\n  ) {\n    updateTeamMember(teamId: $teamId, userId: $userId, input: $input) {\n      id\n      role\n      responsibilities\n      availability\n      workload\n    }\n  }\n':
    types.UpdateTeamMemberDocument,
  '\n  mutation RemoveTeamMember($teamId: UUID!, $userId: UUID!) {\n    removeTeamMember(teamId: $teamId, userId: $userId)\n  }\n':
    types.RemoveTeamMemberDocument,
  '\n  query MyProfile {\n    me {\n      id\n      email\n      name\n      avatarUrl\n      seniority\n      skills\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n':
    types.MyProfileDocument,
  '\n  query UserProfile($id: UUID!) {\n    user(id: $id) {\n      id\n      name\n      avatarUrl\n      seniority\n      skills\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n      teamMemberships {\n        teamId\n        teamName\n        role\n        availability\n        workload\n      }\n    }\n  }\n':
    types.UserProfileDocument,
  '\n  mutation UpdateProfile($input: UpdateProfileInput!) {\n    updateProfile(input: $input) {\n      id\n      name\n      avatarUrl\n      seniority\n    }\n  }\n':
    types.UpdateProfileDocument,
  '\n  mutation AddSkill($skill: String!) {\n    addSkill(skill: $skill) {\n      id\n      skills\n    }\n  }\n':
    types.AddSkillDocument,
  '\n  mutation RemoveSkill($skill: String!) {\n    removeSkill(skill: $skill) {\n      id\n      skills\n    }\n  }\n':
    types.RemoveSkillDocument,
  '\n  mutation AddExpertise($input: AddExpertiseInput!) {\n    addExpertise(input: $input) {\n      id\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n':
    types.AddExpertiseDocument,
  '\n  mutation RemoveExpertise($tag: String!) {\n    removeExpertise(tag: $tag) {\n      id\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n':
    types.RemoveExpertiseDocument,
  '\n  query Health {\n    health {\n      status\n      uptimeSeconds\n      timestamp\n    }\n  }\n':
    types.HealthDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query CurrentUser {\n    me {\n      id\n      email\n      name\n      avatarUrl\n      seniority\n      organizationCount\n    }\n  }\n',
): (typeof documents)['\n  query CurrentUser {\n    me {\n      id\n      email\n      name\n      avatarUrl\n      seniority\n      organizationCount\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      accessToken\n      user {\n        id\n        email\n        name\n        avatarUrl\n        seniority\n        organizationCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      accessToken\n      user {\n        id\n        email\n        name\n        avatarUrl\n        seniority\n        organizationCount\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation Register($input: RegisterInput!) {\n    register(input: $input) {\n      accessToken\n      user {\n        id\n        email\n        name\n        avatarUrl\n        seniority\n        organizationCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation Register($input: RegisterInput!) {\n    register(input: $input) {\n      accessToken\n      user {\n        id\n        email\n        name\n        avatarUrl\n        seniority\n        organizationCount\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation Logout {\n    logout\n  }\n',
): (typeof documents)['\n  mutation Logout {\n    logout\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query Sessions {\n    sessions {\n      id\n      userAgent\n      ipAddress\n      createdAt\n      expiresAt\n      current\n    }\n  }\n',
): (typeof documents)['\n  query Sessions {\n    sessions {\n      id\n      userAgent\n      ipAddress\n      createdAt\n      expiresAt\n      current\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RevokeSession($sessionId: UUID!) {\n    revokeSession(sessionId: $sessionId)\n  }\n',
): (typeof documents)['\n  mutation RevokeSession($sessionId: UUID!) {\n    revokeSession(sessionId: $sessionId)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation ChangePassword($input: ChangePasswordInput!) {\n    changePassword(input: $input)\n  }\n',
): (typeof documents)['\n  mutation ChangePassword($input: ChangePasswordInput!) {\n    changePassword(input: $input)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RequestPasswordReset($email: String!) {\n    requestPasswordReset(email: $email)\n  }\n',
): (typeof documents)['\n  mutation RequestPasswordReset($email: String!) {\n    requestPasswordReset(email: $email)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation AcceptInvitation($token: String!) {\n    acceptInvitation(token: $token) {\n      id\n      role\n      user {\n        id\n        name\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation AcceptInvitation($token: String!) {\n    acceptInvitation(token: $token) {\n      id\n      role\n      user {\n        id\n        name\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment CommentPerson on User {\n    id\n    name\n    avatarUrl\n  }\n',
): (typeof documents)['\n  fragment CommentPerson on User {\n    id\n    name\n    avatarUrl\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment AttachmentItem on Attachment {\n    id\n    filename\n    contentType\n    sizeBytes\n    createdAt\n    uploadedBy {\n      id\n      name\n    }\n  }\n',
): (typeof documents)['\n  fragment AttachmentItem on Attachment {\n    id\n    filename\n    contentType\n    sizeBytes\n    createdAt\n    uploadedBy {\n      id\n      name\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment CommentBody on Comment {\n    __typename\n    id\n    body\n    resolved\n    edited\n    editedAt\n    taskId\n    parentCommentId\n    createdAt\n    author {\n      __typename\n      ...CommentPerson\n    }\n    mentions {\n      __typename\n      id\n      name\n    }\n    attachments {\n      ...AttachmentItem\n    }\n  }\n',
): (typeof documents)['\n  fragment CommentBody on Comment {\n    __typename\n    id\n    body\n    resolved\n    edited\n    editedAt\n    taskId\n    parentCommentId\n    createdAt\n    author {\n      __typename\n      ...CommentPerson\n    }\n    mentions {\n      __typename\n      id\n      name\n    }\n    attachments {\n      ...AttachmentItem\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment CommentThread on Comment {\n    ...CommentBody\n    replies {\n      ...CommentBody\n    }\n  }\n',
): (typeof documents)['\n  fragment CommentThread on Comment {\n    ...CommentBody\n    replies {\n      ...CommentBody\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query TaskComments($taskId: UUID!, $first: Int, $after: String) {\n    task(id: $taskId) {\n      id\n      comments(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            ...CommentThread\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  query TaskComments($taskId: UUID!, $first: Int, $after: String) {\n    task(id: $taskId) {\n      id\n      comments(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            ...CommentThread\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query LinkedComment($id: UUID!) {\n    comment(id: $id) {\n      ...CommentThread\n    }\n  }\n',
): (typeof documents)['\n  query LinkedComment($id: UUID!) {\n    comment(id: $id) {\n      ...CommentThread\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query TaskAttachments($taskId: UUID!) {\n    task(id: $taskId) {\n      id\n      attachments {\n        ...AttachmentItem\n      }\n    }\n  }\n',
): (typeof documents)['\n  query TaskAttachments($taskId: UUID!) {\n    task(id: $taskId) {\n      id\n      attachments {\n        ...AttachmentItem\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation CreateComment($taskId: UUID!, $input: CreateCommentInput!) {\n    createComment(taskId: $taskId, input: $input) {\n      ...CommentThread\n    }\n  }\n',
): (typeof documents)['\n  mutation CreateComment($taskId: UUID!, $input: CreateCommentInput!) {\n    createComment(taskId: $taskId, input: $input) {\n      ...CommentThread\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation EditComment($id: UUID!, $input: UpdateCommentInput!) {\n    editComment(id: $id, input: $input) {\n      id\n      body\n      edited\n      editedAt\n    }\n  }\n',
): (typeof documents)['\n  mutation EditComment($id: UUID!, $input: UpdateCommentInput!) {\n    editComment(id: $id, input: $input) {\n      id\n      body\n      edited\n      editedAt\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation ResolveComment($id: UUID!, $resolved: Boolean!) {\n    resolveComment(id: $id, resolved: $resolved) {\n      __typename\n      id\n      resolved\n    }\n  }\n',
): (typeof documents)['\n  mutation ResolveComment($id: UUID!, $resolved: Boolean!) {\n    resolveComment(id: $id, resolved: $resolved) {\n      __typename\n      id\n      resolved\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DeleteComment($id: UUID!) {\n    deleteComment(id: $id)\n  }\n',
): (typeof documents)['\n  mutation DeleteComment($id: UUID!) {\n    deleteComment(id: $id)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation AddTaskAttachment($taskId: UUID!, $input: AddAttachmentInput!) {\n    addTaskAttachment(taskId: $taskId, input: $input) {\n      ...AttachmentItem\n    }\n  }\n',
): (typeof documents)['\n  mutation AddTaskAttachment($taskId: UUID!, $input: AddAttachmentInput!) {\n    addTaskAttachment(taskId: $taskId, input: $input) {\n      ...AttachmentItem\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation AddCommentAttachment(\n    $commentId: UUID!\n    $input: AddAttachmentInput!\n  ) {\n    addCommentAttachment(commentId: $commentId, input: $input) {\n      ...AttachmentItem\n    }\n  }\n',
): (typeof documents)['\n  mutation AddCommentAttachment(\n    $commentId: UUID!\n    $input: AddAttachmentInput!\n  ) {\n    addCommentAttachment(commentId: $commentId, input: $input) {\n      ...AttachmentItem\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RemoveAttachment($id: UUID!) {\n    removeAttachment(id: $id)\n  }\n',
): (typeof documents)['\n  mutation RemoveAttachment($id: UUID!) {\n    removeAttachment(id: $id)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment EpicSummary on Epic {\n    id\n    name\n    description\n    projectId\n    progress\n    completedTasks\n    totalTasks\n  }\n',
): (typeof documents)['\n  fragment EpicSummary on Epic {\n    id\n    name\n    description\n    projectId\n    progress\n    completedTasks\n    totalTasks\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query ProjectEpics($projectId: UUID!, $first: Int, $after: String) {\n    project(id: $projectId) {\n      id\n      epics(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            ...EpicSummary\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  query ProjectEpics($projectId: UUID!, $first: Int, $after: String) {\n    project(id: $projectId) {\n      id\n      epics(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            ...EpicSummary\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query Epic($id: UUID!, $tasksFirst: Int, $tasksAfter: String) {\n    epic(id: $id) {\n      ...EpicSummary\n      milestones {\n        id\n        name\n        description\n        dueDate\n        epicId\n      }\n      tasks(first: $tasksFirst, after: $tasksAfter) {\n        edges {\n          cursor\n          node {\n            id\n            title\n            status\n            storyPoints\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  query Epic($id: UUID!, $tasksFirst: Int, $tasksAfter: String) {\n    epic(id: $id) {\n      ...EpicSummary\n      milestones {\n        id\n        name\n        description\n        dueDate\n        epicId\n      }\n      tasks(first: $tasksFirst, after: $tasksAfter) {\n        edges {\n          cursor\n          node {\n            id\n            title\n            status\n            storyPoints\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation CreateEpic($projectId: UUID!, $input: CreateEpicInput!) {\n    createEpic(projectId: $projectId, input: $input) {\n      ...EpicSummary\n    }\n  }\n',
): (typeof documents)['\n  mutation CreateEpic($projectId: UUID!, $input: CreateEpicInput!) {\n    createEpic(projectId: $projectId, input: $input) {\n      ...EpicSummary\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateEpic($id: UUID!, $input: UpdateEpicInput!) {\n    updateEpic(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateEpic($id: UUID!, $input: UpdateEpicInput!) {\n    updateEpic(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DeleteEpic($id: UUID!) {\n    deleteEpic(id: $id)\n  }\n',
): (typeof documents)['\n  mutation DeleteEpic($id: UUID!) {\n    deleteEpic(id: $id)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RefreshEpicProgress($id: UUID!) {\n    refreshEpicProgress(id: $id) {\n      id\n      progress\n      completedTasks\n      totalTasks\n    }\n  }\n',
): (typeof documents)['\n  mutation RefreshEpicProgress($id: UUID!) {\n    refreshEpicProgress(id: $id) {\n      id\n      progress\n      completedTasks\n      totalTasks\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation CreateMilestone($projectId: UUID!, $input: CreateMilestoneInput!) {\n    createMilestone(projectId: $projectId, input: $input) {\n      id\n      name\n      description\n      dueDate\n      epicId\n    }\n  }\n',
): (typeof documents)['\n  mutation CreateMilestone($projectId: UUID!, $input: CreateMilestoneInput!) {\n    createMilestone(projectId: $projectId, input: $input) {\n      id\n      name\n      description\n      dueDate\n      epicId\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DeleteMilestone($id: UUID!) {\n    deleteMilestone(id: $id)\n  }\n',
): (typeof documents)['\n  mutation DeleteMilestone($id: UUID!) {\n    deleteMilestone(id: $id)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query MyNotifications($first: Int, $after: String, $unreadOnly: Boolean) {\n    myNotifications(first: $first, after: $after, unreadOnly: $unreadOnly) {\n      edges {\n        cursor\n        node {\n          id\n          type\n          title\n          body\n          read\n          createdAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n',
): (typeof documents)['\n  query MyNotifications($first: Int, $after: String, $unreadOnly: Boolean) {\n    myNotifications(first: $first, after: $after, unreadOnly: $unreadOnly) {\n      edges {\n        cursor\n        node {\n          id\n          type\n          title\n          body\n          read\n          createdAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query UnreadNotificationCount {\n    unreadNotificationCount\n  }\n',
): (typeof documents)['\n  query UnreadNotificationCount {\n    unreadNotificationCount\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query MyOrganizations($first: Int, $after: String) {\n    myOrganizations(first: $first, after: $after) {\n      edges {\n        cursor\n        node {\n          id\n          name\n          description\n          logoUrl\n          memberCount\n          projectCount\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n',
): (typeof documents)['\n  query MyOrganizations($first: Int, $after: String) {\n    myOrganizations(first: $first, after: $after) {\n      edges {\n        cursor\n        node {\n          id\n          name\n          description\n          logoUrl\n          memberCount\n          projectCount\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query Organization($id: UUID!, $first: Int, $after: String) {\n    organization(id: $id) {\n      id\n      name\n      description\n      logoUrl\n      memberCount\n      projectCount\n      owner {\n        id\n        name\n      }\n      members(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            id\n            role\n            createdAt\n            user {\n              id\n              name\n              email\n              avatarUrl\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  query Organization($id: UUID!, $first: Int, $after: String) {\n    organization(id: $id) {\n      id\n      name\n      description\n      logoUrl\n      memberCount\n      projectCount\n      owner {\n        id\n        name\n      }\n      members(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            id\n            role\n            createdAt\n            user {\n              id\n              name\n              email\n              avatarUrl\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query OrganizationProjects(\n    $id: UUID!\n    $status: ProjectState\n    $first: Int\n    $after: String\n  ) {\n    organization(id: $id) {\n      id\n      projects(first: $first, after: $after, status: $status) {\n        edges {\n          cursor\n          node {\n            id\n            name\n            description\n            status\n            memberCount\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  query OrganizationProjects(\n    $id: UUID!\n    $status: ProjectState\n    $first: Int\n    $after: String\n  ) {\n    organization(id: $id) {\n      id\n      projects(first: $first, after: $after, status: $status) {\n        edges {\n          cursor\n          node {\n            id\n            name\n            description\n            status\n            memberCount\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query OrganizationInvitations($organizationId: UUID!) {\n    organizationInvitations(organizationId: $organizationId) {\n      id\n      email\n      role\n      status\n      expiresAt\n      createdAt\n    }\n  }\n',
): (typeof documents)['\n  query OrganizationInvitations($organizationId: UUID!) {\n    organizationInvitations(organizationId: $organizationId) {\n      id\n      email\n      role\n      status\n      expiresAt\n      createdAt\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation CreateOrganization($input: CreateOrganizationInput!) {\n    createOrganization(input: $input) {\n      id\n      name\n      description\n      logoUrl\n      memberCount\n      projectCount\n    }\n  }\n',
): (typeof documents)['\n  mutation CreateOrganization($input: CreateOrganizationInput!) {\n    createOrganization(input: $input) {\n      id\n      name\n      description\n      logoUrl\n      memberCount\n      projectCount\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateOrganization($id: UUID!, $input: UpdateOrganizationInput!) {\n    updateOrganization(id: $id, input: $input) {\n      id\n      name\n      description\n      logoUrl\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateOrganization($id: UUID!, $input: UpdateOrganizationInput!) {\n    updateOrganization(id: $id, input: $input) {\n      id\n      name\n      description\n      logoUrl\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DeleteOrganization($id: UUID!) {\n    deleteOrganization(id: $id)\n  }\n',
): (typeof documents)['\n  mutation DeleteOrganization($id: UUID!) {\n    deleteOrganization(id: $id)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateMemberRole(\n    $organizationId: UUID!\n    $userId: UUID!\n    $role: OrgRole!\n  ) {\n    updateMemberRole(\n      organizationId: $organizationId\n      userId: $userId\n      role: $role\n    ) {\n      id\n      role\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateMemberRole(\n    $organizationId: UUID!\n    $userId: UUID!\n    $role: OrgRole!\n  ) {\n    updateMemberRole(\n      organizationId: $organizationId\n      userId: $userId\n      role: $role\n    ) {\n      id\n      role\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RemoveMember($organizationId: UUID!, $userId: UUID!) {\n    removeMember(organizationId: $organizationId, userId: $userId)\n  }\n',
): (typeof documents)['\n  mutation RemoveMember($organizationId: UUID!, $userId: UUID!) {\n    removeMember(organizationId: $organizationId, userId: $userId)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation InviteToOrganization(\n    $organizationId: UUID!\n    $input: InviteMemberInput!\n  ) {\n    inviteToOrganization(organizationId: $organizationId, input: $input) {\n      id\n      email\n      role\n      status\n      expiresAt\n      createdAt\n    }\n  }\n',
): (typeof documents)['\n  mutation InviteToOrganization(\n    $organizationId: UUID!\n    $input: InviteMemberInput!\n  ) {\n    inviteToOrganization(organizationId: $organizationId, input: $input) {\n      id\n      email\n      role\n      status\n      expiresAt\n      createdAt\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RevokeInvitation($invitationId: UUID!) {\n    revokeInvitation(invitationId: $invitationId)\n  }\n',
): (typeof documents)['\n  mutation RevokeInvitation($invitationId: UUID!) {\n    revokeInvitation(invitationId: $invitationId)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query Project($id: UUID!, $first: Int, $after: String) {\n    project(id: $id) {\n      id\n      name\n      description\n      status\n      organizationId\n      memberCount\n      teamCount\n      settings {\n        workflow\n      }\n      members(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            id\n            role\n            createdAt\n            user {\n              id\n              name\n              email\n              avatarUrl\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n      teams {\n        id\n        name\n        description\n        memberCount\n        members {\n          id\n          role\n          user {\n            id\n          }\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  query Project($id: UUID!, $first: Int, $after: String) {\n    project(id: $id) {\n      id\n      name\n      description\n      status\n      organizationId\n      memberCount\n      teamCount\n      settings {\n        workflow\n      }\n      members(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            id\n            role\n            createdAt\n            user {\n              id\n              name\n              email\n              avatarUrl\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n      teams {\n        id\n        name\n        description\n        memberCount\n        members {\n          id\n          role\n          user {\n            id\n          }\n        }\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation CreateProject($organizationId: UUID!, $input: CreateProjectInput!) {\n    createProject(organizationId: $organizationId, input: $input) {\n      id\n      name\n      description\n      status\n      memberCount\n    }\n  }\n',
): (typeof documents)['\n  mutation CreateProject($organizationId: UUID!, $input: CreateProjectInput!) {\n    createProject(organizationId: $organizationId, input: $input) {\n      id\n      name\n      description\n      status\n      memberCount\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateProject($id: UUID!, $input: UpdateProjectInput!) {\n    updateProject(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateProject($id: UUID!, $input: UpdateProjectInput!) {\n    updateProject(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation ChangeProjectStatus($id: UUID!, $status: ProjectState!) {\n    changeProjectStatus(id: $id, status: $status) {\n      id\n      status\n    }\n  }\n',
): (typeof documents)['\n  mutation ChangeProjectStatus($id: UUID!, $status: ProjectState!) {\n    changeProjectStatus(id: $id, status: $status) {\n      id\n      status\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DeleteProject($id: UUID!) {\n    deleteProject(id: $id)\n  }\n',
): (typeof documents)['\n  mutation DeleteProject($id: UUID!) {\n    deleteProject(id: $id)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation ConfigureWorkflow($id: UUID!, $workflow: JSON!) {\n    configureWorkflow(id: $id, workflow: $workflow) {\n      id\n      settings {\n        workflow\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation ConfigureWorkflow($id: UUID!, $workflow: JSON!) {\n    configureWorkflow(id: $id, workflow: $workflow) {\n      id\n      settings {\n        workflow\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation AddProjectMember(\n    $projectId: UUID!\n    $userId: UUID!\n    $role: ProjectRole!\n  ) {\n    addProjectMember(projectId: $projectId, userId: $userId, role: $role) {\n      id\n      role\n    }\n  }\n',
): (typeof documents)['\n  mutation AddProjectMember(\n    $projectId: UUID!\n    $userId: UUID!\n    $role: ProjectRole!\n  ) {\n    addProjectMember(projectId: $projectId, userId: $userId, role: $role) {\n      id\n      role\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateProjectMemberRole(\n    $projectId: UUID!\n    $userId: UUID!\n    $role: ProjectRole!\n  ) {\n    updateProjectMemberRole(\n      projectId: $projectId\n      userId: $userId\n      role: $role\n    ) {\n      id\n      role\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateProjectMemberRole(\n    $projectId: UUID!\n    $userId: UUID!\n    $role: ProjectRole!\n  ) {\n    updateProjectMemberRole(\n      projectId: $projectId\n      userId: $userId\n      role: $role\n    ) {\n      id\n      role\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RemoveProjectMember($projectId: UUID!, $userId: UUID!) {\n    removeProjectMember(projectId: $projectId, userId: $userId)\n  }\n',
): (typeof documents)['\n  mutation RemoveProjectMember($projectId: UUID!, $userId: UUID!) {\n    removeProjectMember(projectId: $projectId, userId: $userId)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment SprintSummary on Sprint {\n    id\n    name\n    goal\n    state\n    startDate\n    endDate\n    capacity\n    projectId\n    taskCount\n  }\n',
): (typeof documents)['\n  fragment SprintSummary on Sprint {\n    id\n    name\n    goal\n    state\n    startDate\n    endDate\n    capacity\n    projectId\n    taskCount\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment SprintTask on Task {\n    id\n    title\n    status\n    priority\n    storyPoints\n    sprintId\n    assignee {\n      id\n      name\n      avatarUrl\n    }\n  }\n',
): (typeof documents)['\n  fragment SprintTask on Task {\n    id\n    title\n    status\n    priority\n    storyPoints\n    sprintId\n    assignee {\n      id\n      name\n      avatarUrl\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query ProjectSprints($projectId: UUID!, $first: Int, $after: String) {\n    project(id: $projectId) {\n      id\n      sprints(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            ...SprintSummary\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  query ProjectSprints($projectId: UUID!, $first: Int, $after: String) {\n    project(id: $projectId) {\n      id\n      sprints(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            ...SprintSummary\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query Sprint($id: UUID!, $tasksFirst: Int, $tasksAfter: String) {\n    sprint(id: $id) {\n      ...SprintSummary\n      metrics {\n        totalStoryPoints\n        completedStoryPoints\n        remainingStoryPoints\n        totalTasks\n        completedTasks\n        completionRate\n        velocity\n        capacity\n        overCapacity\n        workloadDistribution {\n          assigneeId\n          storyPoints\n          taskCount\n          user {\n            id\n            name\n            avatarUrl\n          }\n        }\n      }\n      burndown {\n        date\n        idealRemaining\n        actualRemaining\n      }\n      tasks(first: $tasksFirst, after: $tasksAfter) {\n        edges {\n          cursor\n          node {\n            ...SprintTask\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  query Sprint($id: UUID!, $tasksFirst: Int, $tasksAfter: String) {\n    sprint(id: $id) {\n      ...SprintSummary\n      metrics {\n        totalStoryPoints\n        completedStoryPoints\n        remainingStoryPoints\n        totalTasks\n        completedTasks\n        completionRate\n        velocity\n        capacity\n        overCapacity\n        workloadDistribution {\n          assigneeId\n          storyPoints\n          taskCount\n          user {\n            id\n            name\n            avatarUrl\n          }\n        }\n      }\n      burndown {\n        date\n        idealRemaining\n        actualRemaining\n      }\n      tasks(first: $tasksFirst, after: $tasksAfter) {\n        edges {\n          cursor\n          node {\n            ...SprintTask\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query SprintTaskCandidates($projectId: UUID!, $first: Int) {\n    project(id: $projectId) {\n      id\n      tasks(first: $first, sortField: CREATED_AT, sortDirection: DESC) {\n        edges {\n          cursor\n          node {\n            id\n            title\n            status\n            sprintId\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  query SprintTaskCandidates($projectId: UUID!, $first: Int) {\n    project(id: $projectId) {\n      id\n      tasks(first: $first, sortField: CREATED_AT, sortDirection: DESC) {\n        edges {\n          cursor\n          node {\n            id\n            title\n            status\n            sprintId\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation CreateSprint($projectId: UUID!, $input: CreateSprintInput!) {\n    createSprint(projectId: $projectId, input: $input) {\n      ...SprintSummary\n    }\n  }\n',
): (typeof documents)['\n  mutation CreateSprint($projectId: UUID!, $input: CreateSprintInput!) {\n    createSprint(projectId: $projectId, input: $input) {\n      ...SprintSummary\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateSprint($id: UUID!, $input: UpdateSprintInput!) {\n    updateSprint(id: $id, input: $input) {\n      ...SprintSummary\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateSprint($id: UUID!, $input: UpdateSprintInput!) {\n    updateSprint(id: $id, input: $input) {\n      ...SprintSummary\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation ChangeSprintState($id: UUID!, $state: SprintState!) {\n    changeSprintState(id: $id, state: $state) {\n      id\n      state\n    }\n  }\n',
): (typeof documents)['\n  mutation ChangeSprintState($id: UUID!, $state: SprintState!) {\n    changeSprintState(id: $id, state: $state) {\n      id\n      state\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DeleteSprint($id: UUID!) {\n    deleteSprint(id: $id)\n  }\n',
): (typeof documents)['\n  mutation DeleteSprint($id: UUID!) {\n    deleteSprint(id: $id)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation AddTaskToSprint($sprintId: UUID!, $taskId: UUID!) {\n    addTaskToSprint(sprintId: $sprintId, taskId: $taskId) {\n      id\n    }\n  }\n',
): (typeof documents)['\n  mutation AddTaskToSprint($sprintId: UUID!, $taskId: UUID!) {\n    addTaskToSprint(sprintId: $sprintId, taskId: $taskId) {\n      id\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RemoveTaskFromSprint($sprintId: UUID!, $taskId: UUID!) {\n    removeTaskFromSprint(sprintId: $sprintId, taskId: $taskId) {\n      id\n    }\n  }\n',
): (typeof documents)['\n  mutation RemoveTaskFromSprint($sprintId: UUID!, $taskId: UUID!) {\n    removeTaskFromSprint(sprintId: $sprintId, taskId: $taskId) {\n      id\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment TaskPerson on User {\n    id\n    name\n    avatarUrl\n  }\n',
): (typeof documents)['\n  fragment TaskPerson on User {\n    id\n    name\n    avatarUrl\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment TaskCard on Task {\n    id\n    title\n    priority\n    status\n    storyPoints\n    projectId\n    assigneeId\n    reporterId\n    sprintId\n    epicId\n    dueDate\n    createdAt\n    assignee {\n      ...TaskPerson\n    }\n    labels {\n      id\n      name\n    }\n  }\n',
): (typeof documents)['\n  fragment TaskCard on Task {\n    id\n    title\n    priority\n    status\n    storyPoints\n    projectId\n    assigneeId\n    reporterId\n    sprintId\n    epicId\n    dueDate\n    createdAt\n    assignee {\n      ...TaskPerson\n    }\n    labels {\n      id\n      name\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment TaskPage on TaskConnection {\n    edges {\n      cursor\n      node {\n        ...TaskCard\n      }\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    totalCount\n  }\n',
): (typeof documents)['\n  fragment TaskPage on TaskConnection {\n    edges {\n      cursor\n      node {\n        ...TaskCard\n      }\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    totalCount\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment TaskDetail on Task {\n    ...TaskCard\n    description\n    loggedSeconds\n    updatedAt\n    reporter {\n      ...TaskPerson\n    }\n    watchers {\n      ...TaskPerson\n    }\n    dependencies {\n      id\n      title\n      status\n    }\n  }\n',
): (typeof documents)['\n  fragment TaskDetail on Task {\n    ...TaskCard\n    description\n    loggedSeconds\n    updatedAt\n    reporter {\n      ...TaskPerson\n    }\n    watchers {\n      ...TaskPerson\n    }\n    dependencies {\n      id\n      title\n      status\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment TaskActivity on ActivityLog {\n    id\n    type\n    metadata\n    createdAt\n    actor {\n      id\n      name\n    }\n  }\n',
): (typeof documents)['\n  fragment TaskActivity on ActivityLog {\n    id\n    type\n    metadata\n    createdAt\n    actor {\n      id\n      name\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query ProjectBoard($projectId: UUID!, $first: Int) {\n    project(id: $projectId) {\n      id\n      backlog: tasks(first: $first, filter: { status: BACKLOG }) {\n        ...TaskPage\n      }\n      todo: tasks(first: $first, filter: { status: TODO }) {\n        ...TaskPage\n      }\n      inProgress: tasks(first: $first, filter: { status: IN_PROGRESS }) {\n        ...TaskPage\n      }\n      inReview: tasks(first: $first, filter: { status: IN_REVIEW }) {\n        ...TaskPage\n      }\n      testing: tasks(first: $first, filter: { status: TESTING }) {\n        ...TaskPage\n      }\n      done: tasks(first: $first, filter: { status: DONE }) {\n        ...TaskPage\n      }\n      blocked: tasks(first: $first, filter: { status: BLOCKED }) {\n        ...TaskPage\n      }\n    }\n  }\n',
): (typeof documents)['\n  query ProjectBoard($projectId: UUID!, $first: Int) {\n    project(id: $projectId) {\n      id\n      backlog: tasks(first: $first, filter: { status: BACKLOG }) {\n        ...TaskPage\n      }\n      todo: tasks(first: $first, filter: { status: TODO }) {\n        ...TaskPage\n      }\n      inProgress: tasks(first: $first, filter: { status: IN_PROGRESS }) {\n        ...TaskPage\n      }\n      inReview: tasks(first: $first, filter: { status: IN_REVIEW }) {\n        ...TaskPage\n      }\n      testing: tasks(first: $first, filter: { status: TESTING }) {\n        ...TaskPage\n      }\n      done: tasks(first: $first, filter: { status: DONE }) {\n        ...TaskPage\n      }\n      blocked: tasks(first: $first, filter: { status: BLOCKED }) {\n        ...TaskPage\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query ProjectBoardColumn(\n    $projectId: UUID!\n    $status: TaskStatus!\n    $first: Int\n    $after: String\n  ) {\n    project(id: $projectId) {\n      id\n      tasks(first: $first, after: $after, filter: { status: $status }) {\n        ...TaskPage\n      }\n    }\n  }\n',
): (typeof documents)['\n  query ProjectBoardColumn(\n    $projectId: UUID!\n    $status: TaskStatus!\n    $first: Int\n    $after: String\n  ) {\n    project(id: $projectId) {\n      id\n      tasks(first: $first, after: $after, filter: { status: $status }) {\n        ...TaskPage\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query ProjectTasks(\n    $projectId: UUID!\n    $first: Int\n    $after: String\n    $filter: TaskFilter\n    $sortField: TaskSortField\n    $sortDirection: SortDirection\n  ) {\n    project(id: $projectId) {\n      id\n      tasks(\n        first: $first\n        after: $after\n        filter: $filter\n        sortField: $sortField\n        sortDirection: $sortDirection\n      ) {\n        ...TaskPage\n      }\n    }\n  }\n',
): (typeof documents)['\n  query ProjectTasks(\n    $projectId: UUID!\n    $first: Int\n    $after: String\n    $filter: TaskFilter\n    $sortField: TaskSortField\n    $sortDirection: SortDirection\n  ) {\n    project(id: $projectId) {\n      id\n      tasks(\n        first: $first\n        after: $after\n        filter: $filter\n        sortField: $sortField\n        sortDirection: $sortDirection\n      ) {\n        ...TaskPage\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query ProjectTaskOptions($projectId: UUID!, $first: Int) {\n    project(id: $projectId) {\n      id\n      tasks(first: $first, sortField: CREATED_AT, sortDirection: DESC) {\n        edges {\n          cursor\n          node {\n            id\n            title\n            status\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  query ProjectTaskOptions($projectId: UUID!, $first: Int) {\n    project(id: $projectId) {\n      id\n      tasks(first: $first, sortField: CREATED_AT, sortDirection: DESC) {\n        edges {\n          cursor\n          node {\n            id\n            title\n            status\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query ProjectPlanning($projectId: UUID!, $first: Int) {\n    project(id: $projectId) {\n      id\n      sprints(first: $first) {\n        edges {\n          cursor\n          node {\n            id\n            name\n            state\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n      epics(first: $first) {\n        edges {\n          cursor\n          node {\n            id\n            name\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  query ProjectPlanning($projectId: UUID!, $first: Int) {\n    project(id: $projectId) {\n      id\n      sprints(first: $first) {\n        edges {\n          cursor\n          node {\n            id\n            name\n            state\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n      epics(first: $first) {\n        edges {\n          cursor\n          node {\n            id\n            name\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query Task($id: UUID!, $activitiesFirst: Int, $activitiesAfter: String) {\n    task(id: $id) {\n      ...TaskDetail\n      activities(first: $activitiesFirst, after: $activitiesAfter) {\n        edges {\n          cursor\n          node {\n            ...TaskActivity\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  query Task($id: UUID!, $activitiesFirst: Int, $activitiesAfter: String) {\n    task(id: $id) {\n      ...TaskDetail\n      activities(first: $activitiesFirst, after: $activitiesAfter) {\n        edges {\n          cursor\n          node {\n            ...TaskActivity\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation CreateTask($projectId: UUID!, $input: CreateTaskInput!) {\n    createTask(projectId: $projectId, input: $input) {\n      ...TaskCard\n    }\n  }\n',
): (typeof documents)['\n  mutation CreateTask($projectId: UUID!, $input: CreateTaskInput!) {\n    createTask(projectId: $projectId, input: $input) {\n      ...TaskCard\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateTask($id: UUID!, $input: UpdateTaskInput!) {\n    updateTask(id: $id, input: $input) {\n      id\n      title\n      description\n      priority\n      dueDate\n      updatedAt\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateTask($id: UUID!, $input: UpdateTaskInput!) {\n    updateTask(id: $id, input: $input) {\n      id\n      title\n      description\n      priority\n      dueDate\n      updatedAt\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation ChangeTaskStatus($id: UUID!, $status: TaskStatus!) {\n    changeTaskStatus(id: $id, status: $status) {\n      __typename\n      id\n      status\n    }\n  }\n',
): (typeof documents)['\n  mutation ChangeTaskStatus($id: UUID!, $status: TaskStatus!) {\n    changeTaskStatus(id: $id, status: $status) {\n      __typename\n      id\n      status\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation AssignTask($id: UUID!, $assigneeId: UUID) {\n    assignTask(id: $id, assigneeId: $assigneeId) {\n      __typename\n      id\n      assigneeId\n      assignee {\n        __typename\n        ...TaskPerson\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation AssignTask($id: UUID!, $assigneeId: UUID) {\n    assignTask(id: $id, assigneeId: $assigneeId) {\n      __typename\n      id\n      assigneeId\n      assignee {\n        __typename\n        ...TaskPerson\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation SetTaskStoryPoints($id: UUID!, $storyPoints: Int) {\n    setTaskStoryPoints(id: $id, storyPoints: $storyPoints) {\n      __typename\n      id\n      storyPoints\n    }\n  }\n',
): (typeof documents)['\n  mutation SetTaskStoryPoints($id: UUID!, $storyPoints: Int) {\n    setTaskStoryPoints(id: $id, storyPoints: $storyPoints) {\n      __typename\n      id\n      storyPoints\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation MoveTaskToSprint($id: UUID!, $sprintId: UUID) {\n    moveTaskToSprint(id: $id, sprintId: $sprintId) {\n      id\n      sprintId\n    }\n  }\n',
): (typeof documents)['\n  mutation MoveTaskToSprint($id: UUID!, $sprintId: UUID) {\n    moveTaskToSprint(id: $id, sprintId: $sprintId) {\n      id\n      sprintId\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DeleteTask($id: UUID!) {\n    deleteTask(id: $id)\n  }\n',
): (typeof documents)['\n  mutation DeleteTask($id: UUID!) {\n    deleteTask(id: $id)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation LogTaskTime($id: UUID!, $seconds: Int!) {\n    logTaskTime(id: $id, seconds: $seconds) {\n      id\n      loggedSeconds\n    }\n  }\n',
): (typeof documents)['\n  mutation LogTaskTime($id: UUID!, $seconds: Int!) {\n    logTaskTime(id: $id, seconds: $seconds) {\n      id\n      loggedSeconds\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation AddTaskDependency($taskId: UUID!, $dependsOnTaskId: UUID!) {\n    addTaskDependency(taskId: $taskId, dependsOnTaskId: $dependsOnTaskId) {\n      id\n      dependencies {\n        id\n        title\n        status\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation AddTaskDependency($taskId: UUID!, $dependsOnTaskId: UUID!) {\n    addTaskDependency(taskId: $taskId, dependsOnTaskId: $dependsOnTaskId) {\n      id\n      dependencies {\n        id\n        title\n        status\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RemoveTaskDependency($taskId: UUID!, $dependsOnTaskId: UUID!) {\n    removeTaskDependency(taskId: $taskId, dependsOnTaskId: $dependsOnTaskId) {\n      id\n      dependencies {\n        id\n        title\n        status\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation RemoveTaskDependency($taskId: UUID!, $dependsOnTaskId: UUID!) {\n    removeTaskDependency(taskId: $taskId, dependsOnTaskId: $dependsOnTaskId) {\n      id\n      dependencies {\n        id\n        title\n        status\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation WatchTask($taskId: UUID!) {\n    watchTask(taskId: $taskId) {\n      id\n      watchers {\n        ...TaskPerson\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation WatchTask($taskId: UUID!) {\n    watchTask(taskId: $taskId) {\n      id\n      watchers {\n        ...TaskPerson\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UnwatchTask($taskId: UUID!) {\n    unwatchTask(taskId: $taskId) {\n      id\n      watchers {\n        ...TaskPerson\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UnwatchTask($taskId: UUID!) {\n    unwatchTask(taskId: $taskId) {\n      id\n      watchers {\n        ...TaskPerson\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation AddTaskLabel($taskId: UUID!, $name: String!) {\n    addTaskLabel(taskId: $taskId, name: $name) {\n      id\n      labels {\n        id\n        name\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation AddTaskLabel($taskId: UUID!, $name: String!) {\n    addTaskLabel(taskId: $taskId, name: $name) {\n      id\n      labels {\n        id\n        name\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RemoveTaskLabel($taskId: UUID!, $name: String!) {\n    removeTaskLabel(taskId: $taskId, name: $name) {\n      id\n      labels {\n        id\n        name\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation RemoveTaskLabel($taskId: UUID!, $name: String!) {\n    removeTaskLabel(taskId: $taskId, name: $name) {\n      id\n      labels {\n        id\n        name\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query Team($id: UUID!) {\n    team(id: $id) {\n      id\n      name\n      description\n      projectId\n      memberCount\n      members {\n        id\n        role\n        responsibilities\n        availability\n        workload\n        createdAt\n        user {\n          id\n          name\n          email\n          avatarUrl\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  query Team($id: UUID!) {\n    team(id: $id) {\n      id\n      name\n      description\n      projectId\n      memberCount\n      members {\n        id\n        role\n        responsibilities\n        availability\n        workload\n        createdAt\n        user {\n          id\n          name\n          email\n          avatarUrl\n        }\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation CreateTeam($projectId: UUID!, $input: CreateTeamInput!) {\n    createTeam(projectId: $projectId, input: $input) {\n      id\n      name\n      description\n      memberCount\n    }\n  }\n',
): (typeof documents)['\n  mutation CreateTeam($projectId: UUID!, $input: CreateTeamInput!) {\n    createTeam(projectId: $projectId, input: $input) {\n      id\n      name\n      description\n      memberCount\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateTeam($id: UUID!, $input: UpdateTeamInput!) {\n    updateTeam(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateTeam($id: UUID!, $input: UpdateTeamInput!) {\n    updateTeam(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DeleteTeam($id: UUID!) {\n    deleteTeam(id: $id)\n  }\n',
): (typeof documents)['\n  mutation DeleteTeam($id: UUID!) {\n    deleteTeam(id: $id)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation AddTeamMember(\n    $teamId: UUID!\n    $userId: UUID!\n    $input: AddTeamMemberInput!\n  ) {\n    addTeamMember(teamId: $teamId, userId: $userId, input: $input) {\n      id\n      role\n      responsibilities\n      availability\n      workload\n    }\n  }\n',
): (typeof documents)['\n  mutation AddTeamMember(\n    $teamId: UUID!\n    $userId: UUID!\n    $input: AddTeamMemberInput!\n  ) {\n    addTeamMember(teamId: $teamId, userId: $userId, input: $input) {\n      id\n      role\n      responsibilities\n      availability\n      workload\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateTeamMember(\n    $teamId: UUID!\n    $userId: UUID!\n    $input: UpdateTeamMemberInput!\n  ) {\n    updateTeamMember(teamId: $teamId, userId: $userId, input: $input) {\n      id\n      role\n      responsibilities\n      availability\n      workload\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateTeamMember(\n    $teamId: UUID!\n    $userId: UUID!\n    $input: UpdateTeamMemberInput!\n  ) {\n    updateTeamMember(teamId: $teamId, userId: $userId, input: $input) {\n      id\n      role\n      responsibilities\n      availability\n      workload\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RemoveTeamMember($teamId: UUID!, $userId: UUID!) {\n    removeTeamMember(teamId: $teamId, userId: $userId)\n  }\n',
): (typeof documents)['\n  mutation RemoveTeamMember($teamId: UUID!, $userId: UUID!) {\n    removeTeamMember(teamId: $teamId, userId: $userId)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query MyProfile {\n    me {\n      id\n      email\n      name\n      avatarUrl\n      seniority\n      skills\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n',
): (typeof documents)['\n  query MyProfile {\n    me {\n      id\n      email\n      name\n      avatarUrl\n      seniority\n      skills\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query UserProfile($id: UUID!) {\n    user(id: $id) {\n      id\n      name\n      avatarUrl\n      seniority\n      skills\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n      teamMemberships {\n        teamId\n        teamName\n        role\n        availability\n        workload\n      }\n    }\n  }\n',
): (typeof documents)['\n  query UserProfile($id: UUID!) {\n    user(id: $id) {\n      id\n      name\n      avatarUrl\n      seniority\n      skills\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n      teamMemberships {\n        teamId\n        teamName\n        role\n        availability\n        workload\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateProfile($input: UpdateProfileInput!) {\n    updateProfile(input: $input) {\n      id\n      name\n      avatarUrl\n      seniority\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateProfile($input: UpdateProfileInput!) {\n    updateProfile(input: $input) {\n      id\n      name\n      avatarUrl\n      seniority\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation AddSkill($skill: String!) {\n    addSkill(skill: $skill) {\n      id\n      skills\n    }\n  }\n',
): (typeof documents)['\n  mutation AddSkill($skill: String!) {\n    addSkill(skill: $skill) {\n      id\n      skills\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RemoveSkill($skill: String!) {\n    removeSkill(skill: $skill) {\n      id\n      skills\n    }\n  }\n',
): (typeof documents)['\n  mutation RemoveSkill($skill: String!) {\n    removeSkill(skill: $skill) {\n      id\n      skills\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation AddExpertise($input: AddExpertiseInput!) {\n    addExpertise(input: $input) {\n      id\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation AddExpertise($input: AddExpertiseInput!) {\n    addExpertise(input: $input) {\n      id\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RemoveExpertise($tag: String!) {\n    removeExpertise(tag: $tag) {\n      id\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation RemoveExpertise($tag: String!) {\n    removeExpertise(tag: $tag) {\n      id\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query Health {\n    health {\n      status\n      uptimeSeconds\n      timestamp\n    }\n  }\n',
): (typeof documents)['\n  query Health {\n    health {\n      status\n      uptimeSeconds\n      timestamp\n    }\n  }\n'];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> =
  TDocumentNode extends DocumentNode<infer TType, any> ? TType : never;
