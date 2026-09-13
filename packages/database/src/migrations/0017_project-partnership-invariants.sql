UPDATE "project_participant" AS "participation"
SET
	"represented_organization_id" = "project"."organization_id",
	"display_name" = "user"."name",
	"email" = lower(trim("user"."email"))
FROM "project", "user"
WHERE "project"."id" = "participation"."project_id"
	AND "user"."id" = "participation"."user_id";
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "assert_project_organization_invariants"("target_project_id" text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "project_partner_organization" AS "partnership"
		INNER JOIN "project" ON "project"."id" = "partnership"."project_id"
		WHERE "partnership"."project_id" = "target_project_id"
			AND "partnership"."organization_id" = "project"."organization_id"
	) THEN
		RAISE EXCEPTION 'A Hosting Organization cannot be a Partner Organization for the same Project'
			USING ERRCODE = '23514';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM "project_participant" AS "participation"
		INNER JOIN "project" ON "project"."id" = "participation"."project_id"
		LEFT JOIN "project_partner_organization" AS "partnership"
			ON "partnership"."project_id" = "participation"."project_id"
			AND "partnership"."organization_id" = "participation"."represented_organization_id"
		WHERE "participation"."project_id" = "target_project_id"
			AND "participation"."represented_organization_id" <> "project"."organization_id"
			AND "partnership"."id" IS NULL
	) THEN
		RAISE EXCEPTION 'A Project Participation represented Organization must be its Hosting Organization or an assigned Partner Organization'
			USING ERRCODE = '23514';
	END IF;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "check_project_organization_invariants"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	"new_project_id" text;
	"old_project_id" text;
BEGIN
	IF TG_TABLE_NAME = 'project' THEN
		"new_project_id" := NEW."id";
		"old_project_id" := OLD."id";
	ELSE
		IF TG_OP <> 'DELETE' THEN
			"new_project_id" := NEW."project_id";
		END IF;
		IF TG_OP <> 'INSERT' THEN
			"old_project_id" := OLD."project_id";
		END IF;
	END IF;

	IF "old_project_id" IS NOT NULL THEN
		PERFORM "assert_project_organization_invariants"("old_project_id");
	END IF;
	IF "new_project_id" IS NOT NULL AND "new_project_id" IS DISTINCT FROM "old_project_id" THEN
		PERFORM "assert_project_organization_invariants"("new_project_id");
	END IF;

	RETURN NULL;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "project_host_organization_invariants" ON "project";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "project_partnership_organization_invariants" ON "project_partner_organization";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "project_participation_organization_invariants" ON "project_participant";
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "project_host_organization_invariants"
AFTER UPDATE OF "organization_id" ON "project"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION "check_project_organization_invariants"();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "project_partnership_organization_invariants"
AFTER INSERT OR UPDATE OR DELETE ON "project_partner_organization"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION "check_project_organization_invariants"();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "project_participation_organization_invariants"
AFTER INSERT OR UPDATE OR DELETE ON "project_participant"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION "check_project_organization_invariants"();
