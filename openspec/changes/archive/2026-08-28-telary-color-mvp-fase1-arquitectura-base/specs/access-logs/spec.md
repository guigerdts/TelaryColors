# Access Logs Specification

## Purpose

Audit trail recording every data-mutating action and every login, associating each event with a user and a timestamp.

## Requirements

### Requirement: Audit Logging of Data-Mutating Actions

The system MUST write an `access_logs` entry (user_id, timestamp, action) for every data-mutating action (create, update, delete) across managed resources.

#### Scenario: Mutating action logged

- GIVEN an authenticated user
- WHEN they create, update, or delete a resource
- THEN an `access_logs` row is recorded with the user, timestamp, and action

#### Scenario: Read-only action not logged

- GIVEN a read-only request (list, get, search)
- WHEN executed
- THEN no access_log row is required

### Requirement: Login Auditing

The system MUST record a login event in `access_logs` each time a user authenticates successfully.

#### Scenario: Successful login logged

- GIVEN a user logging in successfully
- WHEN the session is established
- THEN an `access_logs` entry is written for the login

### Requirement: Audit Record Integrity

Each `access_logs` row SHOULD reference the acting user via `user_id` and MUST include an immutable `timestamp`. Audit records MUST NOT be auto-modified by later updates to the referenced user.

#### Scenario: Historical record unchanged

- GIVEN an access_log entry referencing a user
- WHEN the user's profile is later updated
- THEN the historical audit row remains unchanged
