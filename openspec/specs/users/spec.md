# Users Specification

## Purpose

User management restricted to administrators: list users, create users, and change roles. Operators must never create users.

## Requirements

### Requirement: Admin-only User Management

The system MUST restrict all user-management endpoints (list, create, change role) to users with the `admin` role and MUST return 403 to others. An operator MUST NOT create users.

#### Scenario: Admin manages users

- GIVEN an authenticated admin
- WHEN they list, create, or change roles of users
- THEN the operation succeeds

#### Scenario: Operator cannot create users

- GIVEN an authenticated operator
- WHEN they attempt to create a user (POST /api/v1/users)
- THEN the system returns 403 and no user is created

#### Scenario: Unauthenticated request

- GIVEN an unauthenticated request
- WHEN it targets a user-management endpoint
- THEN the system returns 401

### Requirement: Roles (admin / operator)

The system MUST support exactly two roles, `admin` and `operator`, in Fase 1. Role values MUST be validated against these two.

#### Scenario: Invalid role value

- GIVEN a role change request
- WHEN the target role is not `admin` or `operator`
- THEN the system rejects it with a validation error

### Requirement: Seed Admin (idempotent)

The system MUST create an initial admin user at initialization if none exists, and MUST be idempotent (running twice does not duplicate the admin).

#### Scenario: Fresh database

- GIVEN a fresh database with no users
- WHEN initialization runs
- THEN one admin user is created

#### Scenario: Admin already present

- GIVEN an admin already present
- WHEN initialization runs again
- THEN no duplicate admin is created and existing data is unchanged

### Requirement: last_access_at tracking

The system MUST record `last_access_at` on a user when they log in successfully.

#### Scenario: Successful login

- GIVEN a successful login
- WHEN the session is established
- THEN the user's `last_access_at` is updated to the login time

### Requirement: Minimal Admin UI Page

The frontend MUST provide a minimal admin page (Spanish UI) that lists users and allows creating users and changing roles, while code identifiers stay English.

#### Scenario: Admin manages users in UI

- GIVEN an admin viewing the admin page
- WHEN they manage users
- THEN the page shows users in Spanish and submits changes to the user-management endpoints
