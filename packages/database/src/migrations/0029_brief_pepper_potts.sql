CREATE TABLE "host_project_assignment" (
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "host_project_assignment_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
INSERT INTO "host_project_assignment" ("project_id", "user_id")
SELECT "id", "responsible_user_id" FROM "project";
--> statement-breakpoint
ALTER TABLE "project" DROP CONSTRAINT "project_responsible_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "host_project_assignment" ADD CONSTRAINT "host_project_assignment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_project_assignment" ADD CONSTRAINT "host_project_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" DROP COLUMN "responsible_user_id";