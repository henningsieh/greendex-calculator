CREATE TABLE "project_partner_organization" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_participant" DROP CONSTRAINT "project_participant_member_id_member_id_fk";
--> statement-breakpoint
ALTER TABLE "project_participant" DROP CONSTRAINT "project_participant_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "project_participant" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project_participant" ALTER COLUMN "country" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project_participant" ADD COLUMN "represented_organization_id" text;--> statement-breakpoint
ALTER TABLE "project_participant" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "project_participant" ADD COLUMN "email" text;--> statement-breakpoint
UPDATE "project_participant" AS "participation"
SET
	"represented_organization_id" = "project"."organization_id",
	"display_name" = "user"."name",
	"email" = lower(trim("user"."email"))
FROM "project", "user"
WHERE "project"."id" = "participation"."project_id"
	AND "user"."id" = "participation"."user_id";--> statement-breakpoint
ALTER TABLE "project_participant" ALTER COLUMN "represented_organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "project_participant" ALTER COLUMN "display_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "project_participant" ADD COLUMN "merged_into_participant_id" text;--> statement-breakpoint
ALTER TABLE "project_participant" ADD COLUMN "merged_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_participant" ADD COLUMN "merged_by_user_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "cost_submission_window_open" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_partner_organization" ADD CONSTRAINT "project_partner_organization_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_partner_organization" ADD CONSTRAINT "project_partner_organization_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_partner_organization_project_org_unique" ON "project_partner_organization" USING btree ("project_id","organization_id");--> statement-breakpoint
CREATE INDEX "project_partner_organization_project_idx" ON "project_partner_organization" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_partner_organization_organization_idx" ON "project_partner_organization" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "project_participant" ADD CONSTRAINT "project_participant_represented_organization_id_organization_id_fk" FOREIGN KEY ("represented_organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_participant" ADD CONSTRAINT "project_participant_merged_into_participant_id_project_participant_id_fk" FOREIGN KEY ("merged_into_participant_id") REFERENCES "public"."project_participant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_participant" ADD CONSTRAINT "project_participant_merged_by_user_id_user_id_fk" FOREIGN KEY ("merged_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_participant" ADD CONSTRAINT "project_participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_participant_project_idx" ON "project_participant" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_participant_represented_org_idx" ON "project_participant" USING btree ("represented_organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_participant_project_email_unique" ON "project_participant" USING btree ("project_id","email") WHERE "project_participant"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "project_participant_project_user_unique" ON "project_participant" USING btree ("project_id","user_id") WHERE "project_participant"."user_id" is not null;--> statement-breakpoint
ALTER TABLE "project_participant" DROP COLUMN "member_id";--> statement-breakpoint
ALTER TABLE "project_participant" ADD CONSTRAINT "project_participant_email_normalized" CHECK ("project_participant"."email" is null or "project_participant"."email" = lower(trim("project_participant"."email")));--> statement-breakpoint
ALTER TABLE "project_participant" ADD CONSTRAINT "project_participant_not_merged_into_self" CHECK ("project_participant"."merged_into_participant_id" is null or "project_participant"."merged_into_participant_id" <> "project_participant"."id");--> statement-breakpoint
ALTER TABLE "project_participant" ADD CONSTRAINT "project_participant_merge_fields_consistent" CHECK (("project_participant"."merged_into_participant_id" is null and "project_participant"."merged_at" is null and "project_participant"."merged_by_user_id" is null) or ("project_participant"."merged_into_participant_id" is not null and "project_participant"."merged_at" is not null and "project_participant"."merged_by_user_id" is not null));--> statement-breakpoint
CREATE FUNCTION "assert_project_organization_invariants"("target_project_id" text)
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
$$;--> statement-breakpoint
CREATE FUNCTION "check_project_organization_invariants"()
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
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "project_host_organization_invariants"
AFTER UPDATE OF "organization_id" ON "project"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION "check_project_organization_invariants"();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "project_partnership_organization_invariants"
AFTER INSERT OR UPDATE OR DELETE ON "project_partner_organization"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION "check_project_organization_invariants"();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "project_participation_organization_invariants"
AFTER INSERT OR UPDATE OR DELETE ON "project_participant"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION "check_project_organization_invariants"();