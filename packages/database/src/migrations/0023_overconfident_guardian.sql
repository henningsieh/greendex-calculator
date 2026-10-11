CREATE TABLE "partner_coordinator_assignment" (
	"partnership_id" text NOT NULL,
	"user_id" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partner_coordinator_assignment_partnership_id_user_id_pk" PRIMARY KEY("partnership_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "partner_coordinator_assignment" ADD CONSTRAINT "partner_coordinator_assignment_partnership_id_project_partner_organization_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "public"."project_partner_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_coordinator_assignment" ADD CONSTRAINT "partner_coordinator_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;