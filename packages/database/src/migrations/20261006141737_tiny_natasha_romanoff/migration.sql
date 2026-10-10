ALTER TABLE "project" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "completed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_completed_by_user_id_user_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;