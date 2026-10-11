CREATE TABLE "participant_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"partnership_id" text NOT NULL,
	"project_id" text NOT NULL,
	"email" text NOT NULL,
	"secret_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"issued_by_user_id" text NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "participant_invitation" ADD CONSTRAINT "participant_invitation_partnership_id_project_partner_organization_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "public"."project_partner_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_invitation" ADD CONSTRAINT "participant_invitation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_invitation" ADD CONSTRAINT "participant_invitation_issued_by_user_id_user_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "participant_invitation_partnership_idx" ON "participant_invitation" USING btree ("partnership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participant_invitation_pending_email_unique" ON "participant_invitation" USING btree ("project_id","email") WHERE "participant_invitation"."status" = 'pending';