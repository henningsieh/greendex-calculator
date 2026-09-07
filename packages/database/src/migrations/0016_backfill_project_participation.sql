UPDATE "project_participant" AS participation
SET
  "represented_organization_id" = project."organization_id",
  "display_name" = app_user."name",
  "email" = lower(trim(app_user."email"))
FROM "project", "user" AS app_user
WHERE participation."project_id" = project."id"
  AND participation."user_id" = app_user."id";
--> statement-breakpoint
UPDATE "member" AS membership
SET "role" = normalized_roles."role"
FROM LATERAL (
  SELECT string_agg(role_name, ',' ORDER BY first_position) AS role
  FROM (
    SELECT
      CASE WHEN trim(role_value) = 'member' THEN 'participant' ELSE trim(role_value) END AS role_name,
      min(position) AS first_position
    FROM unnest(string_to_array(membership."role", ',')) WITH ORDINALITY AS roles(role_value, position)
    WHERE trim(role_value) <> ''
    GROUP BY CASE WHEN trim(role_value) = 'member' THEN 'participant' ELSE trim(role_value) END
  ) AS deduplicated_roles
) AS normalized_roles
WHERE normalized_roles."role" IS DISTINCT FROM membership."role";
