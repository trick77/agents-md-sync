## Project

Internal REST API for the identity service. Spring Boot application built with Maven that fronts the user, group, and role tables and is called by every other internal service for authz checks. Response-time budgets are strict (p99 < 50ms); prefer straightforward JDBC over heavy ORM features on hot paths.
