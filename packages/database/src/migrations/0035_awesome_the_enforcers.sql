-- Main migration 0016 already created Organization country; retain its required constraint.
ALTER TABLE "member" ALTER COLUMN "role" SET DEFAULT 'participant';--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "country" SET NOT NULL;
