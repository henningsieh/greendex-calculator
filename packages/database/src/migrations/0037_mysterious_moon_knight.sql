CREATE TABLE "cost_tracker_project_archive_event" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cost_tracker_archive_event_reason_check" CHECK (("cost_tracker_project_archive_event"."action" = 'archive' AND "cost_tracker_project_archive_event"."reason" IS NULL) OR ("cost_tracker_project_archive_event"."action" = 'reopen' AND "cost_tracker_project_archive_event"."reason" IS NOT NULL AND length(trim("cost_tracker_project_archive_event"."reason")) > 0))
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "cost_tracker_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_tracker_project_archive_event" ADD CONSTRAINT "cost_tracker_project_archive_event_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_tracker_project_archive_event" ADD CONSTRAINT "cost_tracker_project_archive_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cost_tracker_project_archive_event_project_idx" ON "cost_tracker_project_archive_event" USING btree ("project_id","created_at");