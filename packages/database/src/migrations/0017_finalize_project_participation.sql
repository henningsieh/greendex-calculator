ALTER TABLE "project_participant" DROP CONSTRAINT "project_participant_member_id_member_id_fk";
--> statement-breakpoint
ALTER TABLE "project_participant" ALTER COLUMN "represented_organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "project_participant" ALTER COLUMN "display_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "project_participant" ADD CONSTRAINT "project_participant_merged_into_participant_id_project_participant_id_fk" FOREIGN KEY ("merged_into_participant_id") REFERENCES "public"."project_participant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_participant_project_idx" ON "project_participant" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_participant_represented_org_idx" ON "project_participant" USING btree ("represented_organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_participant_project_email_unique" ON "project_participant" USING btree ("project_id","email") WHERE "project_participant"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "project_participant_project_user_unique" ON "project_participant" USING btree ("project_id","user_id") WHERE "project_participant"."user_id" is not null;--> statement-breakpoint
ALTER TABLE "project_participant" DROP COLUMN "member_id";--> statement-breakpoint
ALTER TABLE "project_participant" ADD CONSTRAINT "project_participant_email_normalized" CHECK ("project_participant"."email" is null or "project_participant"."email" = lower(trim("project_participant"."email")));--> statement-breakpoint
ALTER TABLE "project_participant" ADD CONSTRAINT "project_participant_not_merged_into_self" CHECK ("project_participant"."merged_into_participant_id" is null or "project_participant"."merged_into_participant_id" <> "project_participant"."id");--> statement-breakpoint
ALTER TABLE "project_participant" ADD CONSTRAINT "project_participant_merge_fields_consistent" CHECK (("project_participant"."merged_into_participant_id" is null and "project_participant"."merged_at" is null and "project_participant"."merged_by_user_id" is null) or ("project_participant"."merged_into_participant_id" is not null and "project_participant"."merged_at" is not null and "project_participant"."merged_by_user_id" is not null));