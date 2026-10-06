/**
 * The backend, spoken to directly. Tests use it to arrange a workspace quickly
 * and to act as "someone else"; what a test is ABOUT always goes through the
 * browser.
 */

import { noteRequest, waitForBudget } from './pace';

const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:4000/graphql';

export const PASSWORD = 'secret123';

type GraphqlError = { message: string; extensions?: { code?: string } };

export async function gql<Data>(
  token: string | null,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<Data> {
  await waitForBudget();
  noteRequest();
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json()) as {
    data?: Data;
    errors?: GraphqlError[];
  };

  if (body.errors?.length || !body.data) {
    throw new Error(
      `GraphQL request failed: ${JSON.stringify(body.errors)}\n${query}`,
    );
  }
  return body.data;
}

export type Account = {
  id: string;
  name: string;
  email: string;
  token: string;
};

let counter = 0;

/** An address no other run, and no other test in this run, has used. */
export function uniqueEmail(label: string): string {
  counter += 1;
  return `${label}-${Date.now()}-${counter}@e2e.optitask.test`;
}

export async function register(name: string, label: string): Promise<Account> {
  const email = uniqueEmail(label);
  const data = await gql<{
    register: { accessToken: string; user: { id: string } };
  }>(
    null,
    `mutation ($input: RegisterInput!) {
      register(input: $input) { accessToken user { id } }
    }`,
    { input: { email, name, password: PASSWORD } },
  );

  return {
    id: data.register.user.id,
    name,
    email,
    token: data.register.accessToken,
  };
}

const DAY = 86_400_000;

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString();
}

export type Workspace = {
  owner: Account;
  member: Account;
  organizationId: string;
  projectId: string;
  teamId: string;
  sprintId: string;
  epicId: string;
  /** In the backlog, unassigned. */
  backlogTaskId: string;
  backlogTaskTitle: string;
  /** In progress, assigned to the member, with a comment thread. */
  activeTaskId: string;
  activeTaskTitle: string;
};

/**
 * An organisation with one project in it, filled in enough for every screen to
 * have something to show: a team, an active sprint, an epic with a milestone,
 * tasks in several statuses, a comment thread, a mention and AI suggestions.
 */
export async function seedWorkspace(): Promise<Workspace> {
  const owner = await register('Ada Lovelace', 'owner');
  const member = await register('Bao Nguyen', 'member');
  const as = owner.token;

  const { createOrganization } = await gql<{
    createOrganization: { id: string };
  }>(
    as,
    `mutation { createOrganization(input: { name: "Acme Robotics", description: "Builds friendly robots." }) { id } }`,
  );
  const organizationId = createOrganization.id;

  const { createProject } = await gql<{ createProject: { id: string } }>(
    as,
    `mutation ($o: UUID!) { createProject(organizationId: $o, input: { name: "Website relaunch", description: "The new public site." }) { id } }`,
    { o: organizationId },
  );
  const projectId = createProject.id;

  await gql(
    as,
    `mutation ($p: UUID!, $u: UUID!) { addProjectMember(projectId: $p, userId: $u, role: MEMBER) { id } }`,
    { p: projectId, u: member.id },
  );

  const { createTeam } = await gql<{ createTeam: { id: string } }>(
    as,
    `mutation ($p: UUID!) { createTeam(projectId: $p, input: { name: "Platform", description: "Keeps the lights on." }) { id } }`,
    { p: projectId },
  );
  const teamId = createTeam.id;
  await gql(
    as,
    `mutation ($t: UUID!, $u: UUID!) { addTeamMember(teamId: $t, userId: $u, input: { role: LEAD, availability: AVAILABLE, workload: 3 }) { id } }`,
    { t: teamId, u: owner.id },
  );
  await gql(
    as,
    `mutation ($t: UUID!, $u: UUID!) { addTeamMember(teamId: $t, userId: $u, input: { role: MEMBER, availability: BUSY, workload: 7, responsibilities: "On-call rota" }) { id } }`,
    { t: teamId, u: member.id },
  );

  const { createSprint } = await gql<{ createSprint: { id: string } }>(
    as,
    `mutation ($p: UUID!, $i: CreateSprintInput!) { createSprint(projectId: $p, input: $i) { id } }`,
    {
      p: projectId,
      i: {
        name: 'Sprint 1',
        goal: 'Ship sign-in.',
        startDate: daysFromNow(-5),
        endDate: daysFromNow(9),
        capacity: 20,
      },
    },
  );
  const sprintId = createSprint.id;

  const { createEpic } = await gql<{ createEpic: { id: string } }>(
    as,
    `mutation ($p: UUID!) { createEpic(projectId: $p, input: { name: "Accounts", description: "Everything about signing in." }) { id } }`,
    { p: projectId },
  );
  const epicId = createEpic.id;
  await gql(
    as,
    `mutation ($p: UUID!, $e: UUID!, $d: DateTime!) { createMilestone(projectId: $p, input: { name: "Beta", epicId: $e, dueDate: $d }) { id } }`,
    { p: projectId, e: epicId, d: daysFromNow(20) },
  );

  const specs = [
    {
      title: 'Build the login form',
      priority: 'HIGH',
      storyPoints: 5,
      assigneeId: owner.id,
      path: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'DONE'],
    },
    {
      title: 'Session expiry handling',
      priority: 'CRITICAL',
      storyPoints: 8,
      assigneeId: member.id,
      path: ['TODO', 'IN_PROGRESS'],
    },
    {
      title: 'Password reset email',
      priority: 'MEDIUM',
      storyPoints: 3,
      assigneeId: member.id,
      path: ['TODO'],
    },
    {
      title: 'Rate limit sign-in attempts',
      priority: 'LOW',
      storyPoints: 2,
      assigneeId: null,
      path: [],
    },
  ];

  const taskIds: string[] = [];
  for (const { path, ...input } of specs) {
    const { createTask } = await gql<{ createTask: { id: string } }>(
      as,
      `mutation ($p: UUID!, $i: CreateTaskInput!) { createTask(projectId: $p, input: $i) { id } }`,
      {
        p: projectId,
        i: {
          ...input,
          sprintId,
          epicId,
          dueDate: daysFromNow(3),
          description: 'Seeded for the end-to-end suite.',
        },
      },
    );
    for (const status of path) {
      await changeTaskStatus(owner, createTask.id, status);
    }
    taskIds.push(createTask.id);
  }
  const [, activeTaskId, , backlogTaskId] = taskIds as [
    string,
    string,
    string,
    string,
  ];

  await gql(
    as,
    `mutation ($id: UUID!) { changeSprintState(id: $id, state: ACTIVE) { id } }`,
    { id: sprintId },
  );
  await gql(
    as,
    `mutation ($t: UUID!) { addTaskLabel(taskId: $t, name: "auth") { id } }`,
    { t: activeTaskId },
  );

  const commentId = await addComment(
    owner,
    activeTaskId,
    'Should the session last 15 minutes or 30?',
  );
  // A reply that mentions the owner: their first notification.
  await gql(
    member.token,
    `mutation ($t: UUID!, $c: UUID!, $u: UUID!) { createComment(taskId: $t, input: { body: "30, with a silent refresh.", parentCommentId: $c, mentionedUserIds: [$u] }) { id } }`,
    { t: activeTaskId, c: commentId, u: owner.id },
  );

  await gql(
    as,
    `mutation ($t: UUID!) { requestAssignmentRecommendation(taskId: $t) { id } }`,
    { t: backlogTaskId },
  );
  await gql(
    as,
    `mutation ($s: UUID!) { requestSprintHealthAnalysis(sprintId: $s) { id } }`,
    { s: sprintId },
  );

  return {
    owner,
    member,
    organizationId,
    projectId,
    teamId,
    sprintId,
    epicId,
    backlogTaskId,
    backlogTaskTitle: 'Rate limit sign-in attempts',
    activeTaskId,
    activeTaskTitle: 'Session expiry handling',
  };
}

export async function changeTaskStatus(
  as: Account,
  taskId: string,
  status: string,
): Promise<void> {
  await gql(
    as.token,
    `mutation ($id: UUID!, $s: TaskStatus!) { changeTaskStatus(id: $id, status: $s) { id } }`,
    { id: taskId, s: status },
  );
}

export async function addComment(
  as: Account,
  taskId: string,
  body: string,
): Promise<string> {
  const data = await gql<{ createComment: { id: string } }>(
    as.token,
    `mutation ($t: UUID!, $b: String!) { createComment(taskId: $t, input: { body: $b }) { id } }`,
    { t: taskId, b: body },
  );
  return data.createComment.id;
}

export async function taskStatus(as: Account, taskId: string): Promise<string> {
  const data = await gql<{ task: { status: string } }>(
    as.token,
    `query ($id: UUID!) { task(id: $id) { status } }`,
    { id: taskId },
  );
  return data.task.status;
}
