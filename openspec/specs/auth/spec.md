# Auth Specification

## Purpose

Authentication and authorization for Telary Color. Users log in to obtain a JWT, and protected endpoints resolve the current user and enforce role-based access through DI dependencies.

## Requirements

### Requirement: JWT Login (POST /api/v1/auth/login)

The system MUST accept an OAuth2 password form (username + password) at `POST /api/v1/auth/login` and MUST require `python-multipart` to parse form data. On valid credentials, the system MUST return a JWT signed with HS256 carrying the user identity and an expiry of 12 hours.

#### Scenario: Successful login

- GIVEN a registered user providing correct username and password
- WHEN they POST to `/api/v1/auth/login` with OAuth2 form data
- THEN the system returns 200 with a JWT access token valid for 12 hours
- AND the user's `last_access_at` is updated

#### Scenario: Invalid password

- GIVEN a user providing an incorrect password
- WHEN they POST to `/api/v1/auth/login`
- THEN the system returns 401 and issues no token

### Requirement: Current User (GET /api/v1/auth/me)

The system MUST expose `GET /api/v1/auth/me` that resolves the current user from the `Authorization: Bearer` token and MUST return 401 for missing or invalid tokens.

#### Scenario: Valid token

- GIVEN a valid bearer token
- WHEN the user requests `/api/v1/auth/me`
- THEN the system returns 200 with the current user's profile

#### Scenario: Missing or expired token

- GIVEN no token or an expired token
- WHEN the user requests `/api/v1/auth/me`
- THEN the system returns 401

### Requirement: Password Hashing and Validation

The system MUST hash passwords directly with bcrypt (NOT passlib) for login and credential comparison, and MUST reject passwords exceeding 72 bytes. The system MUST use English identifiers for API fields and Spanish text for user-facing UI messages.

#### Scenario: Password within limit

- GIVEN a password of 72 bytes or fewer
- WHEN it is hashed or verified
- THEN bcrypt validates it successfully

#### Scenario: Password exceeding limit

- GIVEN a password longer than 72 bytes
- WHEN the user attempts to set it
- THEN the system rejects it with a validation error

### Requirement: DI-based Authentication Dependencies

The system MUST expose `get_current_user` and `require_roles` dependency functions used to protect endpoints. CORS MUST NOT be enabled (single-origin deployment where FastAPI serves the frontend build).

#### Scenario: Protecting an endpoint

- GIVEN a protected endpoint using `get_current_user`
- WHEN an unauthenticated request arrives
- THEN the endpoint returns 401 before executing business logic
