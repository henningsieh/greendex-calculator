CREATE TYPE "public"."duplicate_review_decision" AS ENUM('same_person', 'distinct_persons', 'dismiss');--> statement-breakpoint
CREATE TYPE "public"."duplicate_review_status" AS ENUM('open', 'assigned', 'resolved');--> statement-breakpoint
CREATE TABLE "duplicate_review_task" (
	"id" text PRIMARY KEY NOT NULL,
	"partnership_id" text NOT NULL,
	"existing_participation_id" text NOT NULL,
	"candidate_user_id" text NOT NULL,
	"candidate_email" text NOT NULL,
	"status" "duplicate_review_status" DEFAULT 'open' NOT NULL,
	"assigned_to_user_id" text,
	"decision" "duplicate_review_decision",
	"survivor_participation_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "duplicate_review_lifecycle_check" CHECK ((
      ("duplicate_review_task"."status" = 'open' and "duplicate_review_task"."assigned_to_user_id" is null and "duplicate_review_task"."decision" is null and "duplicate_review_task"."survivor_participation_id" is null and "duplicate_review_task"."resolved_at" is null) or
      ("duplicate_review_task"."status" = 'assigned' and "duplicate_review_task"."assigned_to_user_id" is not null and "duplicate_review_task"."decision" is null and "duplicate_review_task"."survivor_participation_id" is null and "duplicate_review_task"."resolved_at" is null) or
      ("duplicate_review_task"."status" = 'resolved' and "duplicate_review_task"."assigned_to_user_id" is not null and "duplicate_review_task"."decision" is not null and "duplicate_review_task"."survivor_participation_id" = "duplicate_review_task"."existing_participation_id" and "duplicate_review_task"."resolved_at" is not null)
    ))
);
--> statement-breakpoint
ALTER TABLE "duplicate_review_task" ADD CONSTRAINT "duplicate_review_task_partnership_id_project_partner_organization_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "public"."project_partner_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_review_task" ADD CONSTRAINT "duplicate_review_task_existing_participation_id_project_participant_id_fk" FOREIGN KEY ("existing_participation_id") REFERENCES "public"."project_participant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_review_task" ADD CONSTRAINT "duplicate_review_task_candidate_user_id_user_id_fk" FOREIGN KEY ("candidate_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_review_task" ADD CONSTRAINT "duplicate_review_task_assigned_to_user_id_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_review_task" ADD CONSTRAINT "duplicate_review_task_survivor_participation_id_project_participant_id_fk" FOREIGN KEY ("survivor_participation_id") REFERENCES "public"."project_participant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "duplicate_review_attempt_unique" ON "duplicate_review_task" USING btree ("partnership_id","existing_participation_id","candidate_user_id");