CREATE TABLE "partner_organization_setup_link" (
	"id" text PRIMARY KEY NOT NULL,
	"secret_hash" text NOT NULL,
	"project_id" text NOT NULL,
	"recipient_email" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"consumed_at" timestamp,
	"consumed_by_user_id" text,
	"partnership_id" text
);
--> statement-breakpoint
ALTER TABLE "partner_organization_setup_link" ADD CONSTRAINT "partner_organization_setup_link_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_organization_setup_link" ADD CONSTRAINT "partner_organization_setup_link_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_organization_setup_link" ADD CONSTRAINT "partner_organization_setup_link_consumed_by_user_id_user_id_fk" FOREIGN KEY ("consumed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_organization_setup_link" ADD CONSTRAINT "partner_organization_setup_link_partnership_id_project_partner_organization_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "public"."project_partner_organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_setup_link_project_idx" ON "partner_organization_setup_link" USING btree ("project_id");