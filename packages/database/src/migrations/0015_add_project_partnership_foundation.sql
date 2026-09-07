CREATE TABLE "project_partner_organization" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_participant" DROP CONSTRAINT "project_participant_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "project_participant" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project_participant" ALTER COLUMN "country" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project_participant" ADD COLUMN "represented_organization_id" text;--> statement-breakpoint
ALTER TABLE "project_participant" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "project_participant" ADD COLUMN "email" text;--> statement-breakpoint
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
ALTER TABLE "project_participant" ADD CONSTRAINT "project_participant_merged_by_user_id_user_id_fk" FOREIGN KEY ("merged_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_participant" ADD CONSTRAINT "project_participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;