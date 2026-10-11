-- Preserve every existing role; mark legacy admins and members who hold an explicit
-- hosted-Project or Partner-Partnership coordination assignment.
UPDATE "member" AS m
SET "role" = m."role" || ',project-coordinator'
WHERE ((',' || m."role" || ',') LIKE '%,admin,%' OR (',' || m."role" || ',') LIKE '%,member,%')
  AND (',' || m."role" || ',') NOT LIKE '%,project-coordinator,%'
  AND (
    EXISTS (
      SELECT 1 FROM "project" AS p
      WHERE p."organization_id" = m."organization_id"
        AND p."responsible_user_id" = m."user_id"
    )
    OR EXISTS (
      SELECT 1 FROM "partner_coordinator_assignment" AS a
      JOIN "project_partner_organization" AS pp ON pp."id" = a."partnership_id"
      WHERE pp."organization_id" = m."organization_id"
        AND a."user_id" = m."user_id"
    )
  );
