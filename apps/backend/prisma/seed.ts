import { PrismaClient } from '@prisma/client';

/**
 * Development seed: a demo organization with a project, team, sprint, and a few
 * tasks so the API has data to query. Idempotent via stable emails/upserts.
 *
 * NOTE: passwordHash here is a placeholder, not a real hash — proper hashing
 * lands with the auth module (ROADMAP Phase 3). Do not run this against prod.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const owner = await prisma.user.upsert({
    where: { email: 'owner@optitask.dev' },
    update: {},
    create: {
      email: 'owner@optitask.dev',
      name: 'Olivia Owner',
      passwordHash: 'seed-placeholder',
      seniority: 'PRINCIPAL',
      statistics: { create: {} },
    },
  });

  const dev = await prisma.user.upsert({
    where: { email: 'dev@optitask.dev' },
    update: {},
    create: {
      email: 'dev@optitask.dev',
      name: 'Devon Developer',
      passwordHash: 'seed-placeholder',
      seniority: 'SENIOR',
      statistics: { create: {} },
      skills: { create: [{ skill: 'TypeScript' }, { skill: 'PostgreSQL' }] },
      expertise: {
        create: [{ tag: 'backend', confidenceScore: 0.9 }],
      },
    },
  });

  const organization = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Acme Agile',
      description: 'Demo organization',
      ownerId: owner.id,
      members: {
        create: [
          { userId: owner.id, role: 'OWNER' },
          { userId: dev.id, role: 'MEMBER' },
        ],
      },
    },
  });

  const project = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      organizationId: organization.id,
      name: 'OptiTask Platform',
      description: 'Build the OptiTask backend',
      status: 'ACTIVE',
      settings: { create: {} },
      members: {
        create: [
          { userId: owner.id, role: 'ADMIN' },
          { userId: dev.id, role: 'MEMBER' },
        ],
      },
    },
  });

  const team = await prisma.team.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      projectId: project.id,
      name: 'Core Team',
      members: {
        create: [
          { userId: owner.id, role: 'LEAD' },
          { userId: dev.id, role: 'MEMBER' },
        ],
      },
    },
  });

  const sprint = await prisma.sprint.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      projectId: project.id,
      name: 'Sprint 1',
      goal: 'Stand up the persistence layer',
      state: 'ACTIVE',
      capacity: 40,
    },
  });

  await prisma.task.upsert({
    where: { id: '00000000-0000-0000-0000-000000000005' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000005',
      projectId: project.id,
      sprintId: sprint.id,
      title: 'Design database schema',
      description: 'Model all OptiTask entities in Prisma',
      priority: 'HIGH',
      status: 'DONE',
      storyPoints: 5,
      assigneeId: dev.id,
      reporterId: owner.id,
    },
  });

  await prisma.task.upsert({
    where: { id: '00000000-0000-0000-0000-000000000006' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000006',
      projectId: project.id,
      sprintId: sprint.id,
      title: 'Wire GraphQL platform',
      description: 'Context, errors, pagination, DataLoaders',
      priority: 'MEDIUM',
      status: 'TODO',
      storyPoints: 8,
      reporterId: owner.id,
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete: 2 users, 1 org/project/team/sprint, 2 tasks.');
}

main()
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
