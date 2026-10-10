CREATE TABLE "participant_agreement_acceptance" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"version" text NOT NULL,
	"content_hash" text NOT NULL,
	"answers" text NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_invitation_bridge" (
	"invitation_id" text PRIMARY KEY NOT NULL,
	"partnership_id" text NOT NULL,
	"project_id" text NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"issued_by_user_id" text NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "participant_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_registration_link" (
	"id" text PRIMARY KEY NOT NULL,
	"partnership_id" text NOT NULL,
	"secret_hash" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"closed_by_user_id" text,
	"closed_at" timestamp,
	CONSTRAINT "participant_registration_link_partnership_id_unique" UNIQUE("partnership_id")
);
--> statement-breakpoint
ALTER TABLE "participant_agreement_acceptance" ADD CONSTRAINT "participant_agreement_acceptance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_invitation_bridge" ADD CONSTRAINT "participant_invitation_bridge_invitation_id_invitation_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_invitation_bridge" ADD CONSTRAINT "participant_invitation_bridge_partnership_id_project_partner_organization_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "public"."project_partner_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_invitation_bridge" ADD CONSTRAINT "participant_invitation_bridge_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_invitation_bridge" ADD CONSTRAINT "participant_invitation_bridge_issued_by_user_id_user_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_profile" ADD CONSTRAINT "participant_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_registration_link" ADD CONSTRAINT "participant_registration_link_partnership_id_project_partner_organization_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "public"."project_partner_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_registration_link" ADD CONSTRAINT "participant_registration_link_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_registration_link" ADD CONSTRAINT "participant_registration_link_closed_by_user_id_user_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "participant_agreement_user_version_unique" ON "participant_agreement_acceptance" USING btree ("user_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "participant_invitation_live_email_unique" ON "participant_invitation_bridge" USING btree ("project_id","email") WHERE "participant_invitation_bridge"."status" = 'pending';