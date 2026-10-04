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
