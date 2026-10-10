ALTER TABLE "project_activity" ALTER COLUMN "activity_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "project_activity" ADD COLUMN "participant_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "project_participant" ADD COLUMN "member_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "project_participant" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "project_activity" ADD CONSTRAINT "project_activity_participant_id_project_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."project_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_participant" ADD CONSTRAINT "project_participant_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_participant" DROP COLUMN "role";--> statement-breakpoint
DROP TYPE "public"."activity_type";