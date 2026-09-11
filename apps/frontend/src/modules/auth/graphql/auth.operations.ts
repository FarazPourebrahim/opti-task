import { graphql } from '@/shared/graphql/generated';

/**
 * Authentication operations.
 *
 * `accessToken` is selected on the auth mutations because the WebSocket needs a
 * token it can put in `connectionParams`; the HTTP side authenticates with the
 * HTTP-only cookies the same mutations set. `refreshToken` is deliberately NOT
 * selected — nothing in the client may hold it.
 */

export const CurrentUserQuery = graphql(`
  query CurrentUser {
    me {
      id
      email
      name
      avatarUrl
      seniority
      organizationCount
    }
  }
`);

export const LoginMutation = graphql(`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      user {
        id
        email
        name
        avatarUrl
        seniority
        organizationCount
      }
    }
  }
`);

export const RegisterMutation = graphql(`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      user {
        id
        email
        name
        avatarUrl
        seniority
        organizationCount
      }
    }
  }
`);

export const LogoutMutation = graphql(`
  mutation Logout {
    logout
  }
`);

export const SessionsQuery = graphql(`
  query Sessions {
    sessions {
      id
      userAgent
      ipAddress
      createdAt
      expiresAt
      current
    }
  }
`);

export const RevokeSessionMutation = graphql(`
  mutation RevokeSession($sessionId: UUID!) {
    revokeSession(sessionId: $sessionId)
  }
`);

export const ChangePasswordMutation = graphql(`
  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input)
  }
`);

/**
 * Validates the email and reports success, but issues no reset token and sends
 * no mail — see the backend's known-debt. The UI must not claim otherwise.
 */
export const RequestPasswordResetMutation = graphql(`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email)
  }
`);

export const AcceptInvitationMutation = graphql(`
  mutation AcceptInvitation($token: String!) {
    acceptInvitation(token: $token) {
      id
      role
      user {
        id
        name
      }
    }
  }
`);
