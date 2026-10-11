---
applyTo: "docs/database/**/*.md,.env.example"
description: "Greendex Coolify database connection boundary"
---

# Coolify Database Connections

Calculator and Cost Tracker reach the same Live PostgreSQL (or the same Preview PostgreSQL) through the private Coolify Docker network. Both shared database resources currently have SSL disabled. Do not add `sslmode` parameters or certificate settings from an old connection string without first checking the managed resource in Coolify.

- Retrieve the active connection details from Coolify; never commit credentials or a complete connection string.
- Both deployed applications use the same Live resource UUID hostname on port `5432`; both preview configurations use the same Preview resource UUID hostname. Local development uses the shared Live port documented in [the shared setup](./development-databases.md).
- Keep connection and deployment changes in Coolify-managed configuration. Generated compose files are not source files.
- For schema and migration work, follow the [Drizzle map](../agents/instructions/drizzle.md). For platform behavior, use the [Coolify route](../agents/integrations.md#coolify-deployment-and-api).

If a future managed database enables SSL, use the current Coolify connection guidance and installed PostgreSQL driver documentation to derive the connection string for that resource.
