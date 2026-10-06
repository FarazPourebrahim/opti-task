import { lazy, useState } from 'react';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router';
import type { RouteObject } from 'react-router';
import {
  GuestRoute,
  ProtectedRoute,
} from '@/modules/auth/components/ProtectedRoute';
import { RootLayout } from '@/modules/shell/components/RootLayout';
import { RouteErrorBoundary } from '@/modules/shell/components/RouteErrorBoundary';
import { NotFoundPage } from '@/modules/shell/NotFound.page';
import { CRUMB_IDS, ROUTES } from '@/shared/routes/route.constants';
import type { RouteHandle } from '@/shared/routes/route.types';

/*
 * Every page is its own chunk: a visitor on the sign-in screen downloads
 * neither the app shell nor any feature.
 */
const LoginPage = lazy(async () => ({
  default: (await import('@/modules/auth/Login.page')).LoginPage,
}));
const RegisterPage = lazy(async () => ({
  default: (await import('@/modules/auth/Register.page')).RegisterPage,
}));
const ForgotPasswordPage = lazy(async () => ({
  default: (await import('@/modules/auth/ForgotPassword.page'))
    .ForgotPasswordPage,
}));
const AcceptInvitationPage = lazy(async () => ({
  default: (await import('@/modules/auth/AcceptInvitation.page'))
    .AcceptInvitationPage,
}));
const SessionsPage = lazy(async () => ({
  default: (await import('@/modules/auth/Sessions.page')).SessionsPage,
}));
const SecurityPage = lazy(async () => ({
  default: (await import('@/modules/auth/Security.page')).SecurityPage,
}));
const ProfilePage = lazy(async () => ({
  default: (await import('@/modules/user/Profile.page')).ProfilePage,
}));
const UserProfilePage = lazy(async () => ({
  default: (await import('@/modules/user/UserProfile.page')).UserProfilePage,
}));
const OrganizationsPage = lazy(async () => ({
  default: (await import('@/modules/organization/Organizations.page'))
    .OrganizationsPage,
}));
const OrganizationPage = lazy(async () => ({
  default: (await import('@/modules/organization/Organization.page'))
    .OrganizationPage,
}));
const OrganizationProjectsPage = lazy(async () => ({
  default: (await import('@/modules/organization/OrganizationProjects.page'))
    .OrganizationProjectsPage,
}));
const OrganizationMembersPage = lazy(async () => ({
  default: (await import('@/modules/organization/OrganizationMembers.page'))
    .OrganizationMembersPage,
}));
const OrganizationInvitationsPage = lazy(async () => ({
  default: (await import('@/modules/organization/OrganizationInvitations.page'))
    .OrganizationInvitationsPage,
}));
const OrganizationSettingsPage = lazy(async () => ({
  default: (await import('@/modules/organization/OrganizationSettings.page'))
    .OrganizationSettingsPage,
}));
const ProjectPage = lazy(async () => ({
  default: (await import('@/modules/project/Project.page')).ProjectPage,
}));
const ProjectOverviewPage = lazy(async () => ({
  default: (await import('@/modules/project/ProjectOverview.page'))
    .ProjectOverviewPage,
}));
const ProjectMembersPage = lazy(async () => ({
  default: (await import('@/modules/project/ProjectMembers.page'))
    .ProjectMembersPage,
}));
const ProjectSettingsPage = lazy(async () => ({
  default: (await import('@/modules/project/ProjectSettings.page'))
    .ProjectSettingsPage,
}));
const TeamsPage = lazy(async () => ({
  default: (await import('@/modules/team/Teams.page')).TeamsPage,
}));
const TeamPage = lazy(async () => ({
  default: (await import('@/modules/team/Team.page')).TeamPage,
}));
const BoardPage = lazy(async () => ({
  default: (await import('@/modules/task/Board.page')).BoardPage,
}));
const TaskListPage = lazy(async () => ({
  default: (await import('@/modules/task/TaskList.page')).TaskListPage,
}));
const TaskDetailPage = lazy(async () => ({
  default: (await import('@/modules/task/TaskDetail.page')).TaskDetailPage,
}));
const SprintsPage = lazy(async () => ({
  default: (await import('@/modules/sprint/Sprints.page')).SprintsPage,
}));
const SprintDetailPage = lazy(async () => ({
  default: (await import('@/modules/sprint/SprintDetail.page'))
    .SprintDetailPage,
}));
const EpicsPage = lazy(async () => ({
  default: (await import('@/modules/epic/Epics.page')).EpicsPage,
}));
const EpicDetailPage = lazy(async () => ({
  default: (await import('@/modules/epic/EpicDetail.page')).EpicDetailPage,
}));
const AiRecommendationsPage = lazy(async () => ({
  default: (await import('@/modules/ai/AiRecommendations.page'))
    .AiRecommendationsPage,
}));
const ProjectAnalyticsPage = lazy(async () => ({
  default: (await import('@/modules/analytics/ProjectAnalytics.page'))
    .ProjectAnalyticsPage,
}));
const NotificationsPage = lazy(async () => ({
  default: (await import('@/modules/notification/Notifications.page'))
    .NotificationsPage,
}));
const AppLayout = lazy(async () => ({
  default: (await import('@/modules/shell/components/AppLayout')).AppLayout,
}));
const HomePage = lazy(async () => ({
  default: (await import('@/modules/home/Home.page')).HomePage,
}));

/**
 * Route tree: path → page, guards and layout nesting. Nothing else belongs
 * here — no data fetching, no business logic.
 */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary standalone />,
    children: [
      {
        element: <GuestRoute />,
        children: [
          { path: ROUTES.login, element: <LoginPage /> },
          { path: ROUTES.register, element: <RegisterPage /> },
          { path: ROUTES.forgotPassword, element: <ForgotPasswordPage /> },
        ],
      },
      // Open to both: a signed-out visitor is asked to sign in and come back.
      { path: ROUTES.acceptInvitation, element: <AcceptInvitationPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            handle: { crumb: 'nav.home' } satisfies RouteHandle,
            children: [
              {
                // Inside the layout, so a failing page leaves the shell up.
                errorElement: <RouteErrorBoundary />,
                children: [
                  { path: ROUTES.home, element: <HomePage /> },
                  {
                    path: ROUTES.account,
                    handle: { crumb: 'nav.account' } satisfies RouteHandle,
                    children: [
                      {
                        index: true,
                        element: (
                          <Navigate to={ROUTES.accountSessions} replace />
                        ),
                      },
                      {
                        path: ROUTES.accountProfile,
                        element: <ProfilePage />,
                        handle: { crumb: 'nav.profile' } satisfies RouteHandle,
                      },
                      {
                        path: ROUTES.accountSessions,
                        element: <SessionsPage />,
                        handle: { crumb: 'nav.sessions' } satisfies RouteHandle,
                      },
                      {
                        path: ROUTES.accountSecurity,
                        element: <SecurityPage />,
                        handle: { crumb: 'nav.security' } satisfies RouteHandle,
                      },
                    ],
                  },
                  {
                    path: ROUTES.organizations,
                    handle: {
                      crumb: 'nav.organizations',
                    } satisfies RouteHandle,
                    children: [
                      { index: true, element: <OrganizationsPage /> },
                      {
                        path: ROUTES.organization,
                        element: <OrganizationPage />,
                        handle: {
                          crumb: 'nav.organization',
                          crumbId: CRUMB_IDS.organization,
                        } satisfies RouteHandle,
                        children: [
                          {
                            index: true,
                            element: <OrganizationProjectsPage />,
                          },
                          {
                            path: ROUTES.organizationMembers,
                            element: <OrganizationMembersPage />,
                            handle: {
                              crumb: 'nav.members',
                            } satisfies RouteHandle,
                          },
                          {
                            path: ROUTES.organizationInvitations,
                            element: <OrganizationInvitationsPage />,
                            handle: {
                              crumb: 'nav.invitations',
                            } satisfies RouteHandle,
                          },
                          {
                            path: ROUTES.organizationSettings,
                            element: <OrganizationSettingsPage />,
                            handle: {
                              crumb: 'nav.settings',
                            } satisfies RouteHandle,
                          },
                        ],
                      },
                    ],
                  },
                  {
                    path: ROUTES.project,
                    element: <ProjectPage />,
                    handle: {
                      crumb: 'nav.project',
                      crumbId: CRUMB_IDS.project,
                    } satisfies RouteHandle,
                    children: [
                      { index: true, element: <ProjectOverviewPage /> },
                      {
                        path: ROUTES.projectBoard,
                        element: <BoardPage />,
                        handle: { crumb: 'nav.board' } satisfies RouteHandle,
                      },
                      {
                        path: ROUTES.projectTasks,
                        handle: { crumb: 'nav.tasks' } satisfies RouteHandle,
                        children: [
                          { index: true, element: <TaskListPage /> },
                          {
                            path: ROUTES.task,
                            element: <TaskDetailPage />,
                            handle: {
                              crumb: 'nav.task',
                              crumbId: CRUMB_IDS.task,
                            } satisfies RouteHandle,
                          },
                        ],
                      },
                      {
                        path: ROUTES.projectSprints,
                        handle: { crumb: 'nav.sprints' } satisfies RouteHandle,
                        children: [
                          { index: true, element: <SprintsPage /> },
                          {
                            path: ROUTES.sprint,
                            element: <SprintDetailPage />,
                            handle: {
                              crumb: 'nav.sprint',
                              crumbId: CRUMB_IDS.sprint,
                            } satisfies RouteHandle,
                          },
                        ],
                      },
                      {
                        path: ROUTES.projectEpics,
                        handle: { crumb: 'nav.epics' } satisfies RouteHandle,
                        children: [
                          { index: true, element: <EpicsPage /> },
                          {
                            path: ROUTES.epic,
                            element: <EpicDetailPage />,
                            handle: {
                              crumb: 'nav.epic',
                              crumbId: CRUMB_IDS.epic,
                            } satisfies RouteHandle,
                          },
                        ],
                      },
                      {
                        path: ROUTES.projectAi,
                        element: <AiRecommendationsPage />,
                        handle: { crumb: 'nav.ai' } satisfies RouteHandle,
                      },
                      {
                        path: ROUTES.projectAnalytics,
                        element: <ProjectAnalyticsPage />,
                        handle: {
                          crumb: 'nav.analytics',
                        } satisfies RouteHandle,
                      },
                      {
                        path: ROUTES.projectMembers,
                        element: <ProjectMembersPage />,
                        handle: { crumb: 'nav.members' } satisfies RouteHandle,
                      },
                      {
                        path: ROUTES.projectTeams,
                        handle: { crumb: 'nav.teams' } satisfies RouteHandle,
                        children: [
                          { index: true, element: <TeamsPage /> },
                          {
                            path: ROUTES.team,
                            element: <TeamPage />,
                            handle: {
                              crumb: 'nav.team',
                              crumbId: CRUMB_IDS.team,
                            } satisfies RouteHandle,
                          },
                        ],
                      },
                      {
                        path: ROUTES.projectSettings,
                        element: <ProjectSettingsPage />,
                        handle: { crumb: 'nav.settings' } satisfies RouteHandle,
                      },
                    ],
                  },
                  {
                    path: ROUTES.notifications,
                    element: <NotificationsPage />,
                    handle: {
                      crumb: 'nav.notifications',
                    } satisfies RouteHandle,
                  },
                  {
                    path: ROUTES.user,
                    element: <UserProfilePage />,
                    handle: {
                      crumb: 'nav.person',
                      crumbId: CRUMB_IDS.user,
                    } satisfies RouteHandle,
                  },
                  { path: '*', element: <NotFoundPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

export function App() {
  // Created once: a router rebuilt on re-render would reset the history stack.
  const [router] = useState(() => createBrowserRouter(routes));

  return <RouterProvider router={router} />;
}
