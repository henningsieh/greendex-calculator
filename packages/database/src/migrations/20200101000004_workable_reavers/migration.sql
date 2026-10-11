ALTER TABLE "project_activity" DROP CONSTRAINT "project_activity_participant_id_project_participant_id_fk";
--> statement-breakpoint
ALTER TABLE "project_activity" DROP COLUMN "participant_id";