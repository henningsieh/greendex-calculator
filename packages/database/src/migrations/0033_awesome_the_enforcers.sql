ALTER TABLE "member" ALTER COLUMN "role" SET DEFAULT 'participant';--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "country" text NOT NULL;