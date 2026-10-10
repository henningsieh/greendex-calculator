CREATE TYPE "public"."claim_event_type" AS ENUM('submitted', 'correction_requested', 'resubmitted', 'approved', 'rejected', 'reopened', 'paid', 'payment_corrected');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('editable', 'submitted', 'correction_requested', 'approved', 'rejected', 'paid');--> statement-breakpoint
CREATE TYPE "public"."cost_allocation_method" AS ENUM('equal', 'percentage', 'amount');--> statement-breakpoint
CREATE TYPE "public"."journey_trip_type" AS ENUM('one-way', 'round-trip');--> statement-breakpoint
CREATE TYPE "public"."participant_transport_profile" AS ENUM('boat', 'bus', 'train', 'car', 'electricCar', 'plane');--> statement-breakpoint
CREATE TABLE "claim_history" (
	"id" text PRIMARY KEY NOT NULL,
	"claim_id" text NOT NULL,
	"event_type" "claim_event_type" NOT NULL,
	"actor_user_id" text NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"reason" text,
	CONSTRAINT "claim_history_reason_required" CHECK ("claim_history"."event_type" not in ('correction_requested', 'rejected', 'payment_corrected') or (nullif(trim("claim_history"."reason"), '') is not null))
);
--> statement-breakpoint
CREATE TABLE "claim" (
	"id" text PRIMARY KEY NOT NULL,
	"partnership_id" text NOT NULL,
	"status" "claim_status" DEFAULT 'editable' NOT NULL,
	"approved_amount_eur" numeric(14, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "claim_partnership_id_unique" UNIQUE("partnership_id"),
	CONSTRAINT "claim_approved_amount_nonnegative" CHECK ("claim"."approved_amount_eur" is null or "claim"."approved_amount_eur" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cost_allocation" (
	"travel_cost_entry_id" text NOT NULL,
	"project_participant_id" text NOT NULL,
	"percentage" numeric(12, 6),
	"amount_eur" numeric(14, 2),
	CONSTRAINT "cost_allocation_travel_cost_entry_id_project_participant_id_pk" PRIMARY KEY("travel_cost_entry_id","project_participant_id"),
	CONSTRAINT "cost_allocation_nonnegative" CHECK (("cost_allocation"."percentage" is null or "cost_allocation"."percentage" >= 0) and ("cost_allocation"."amount_eur" is null or "cost_allocation"."amount_eur" >= 0) and not ("cost_allocation"."percentage" is not null and "cost_allocation"."amount_eur" is not null))
);
--> statement-breakpoint
CREATE TABLE "participant_journey" (
	"id" text PRIMARY KEY NOT NULL,
	"project_participant_id" text NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"trip_type" "journey_trip_type" NOT NULL,
	"erasmus_distance_km" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "participant_journey_project_participant_id_unique" UNIQUE("project_participant_id"),
	CONSTRAINT "participant_journey_distance_positive" CHECK ("participant_journey"."erasmus_distance_km" > 0)
);
--> statement-breakpoint
CREATE TABLE "partnership_payout_account" (
	"partnership_id" text PRIMARY KEY NOT NULL,
	"payout_account_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_account" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"account_holder" text NOT NULL,
	"iban" text NOT NULL,
	"bic" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_funding_band" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"min_km" numeric(12, 2) NOT NULL,
	"max_km" numeric(12, 2) NOT NULL,
	"standard_eur" numeric(14, 2) NOT NULL,
	"green_eur" numeric(14, 2) NOT NULL,
	CONSTRAINT "project_funding_band_range" CHECK ("project_funding_band"."min_km" >= 0 and "project_funding_band"."max_km" >= "project_funding_band"."min_km"),
	CONSTRAINT "project_funding_band_rates" CHECK ("project_funding_band"."standard_eur" >= 0 and "project_funding_band"."green_eur" >= 0)
);
--> statement-breakpoint
CREATE TABLE "project_funding_snapshot" (
	"project_id" text PRIMARY KEY NOT NULL,
	"rules_version" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proof_document" (
	"id" text PRIMARY KEY NOT NULL,
	"claim_id" text NOT NULL,
	"file_reference" text NOT NULL,
	"original_file_name" text NOT NULL,
	"media_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"checksum" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "proof_document_size_positive" CHECK ("proof_document"."byte_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "travel_cost_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"claim_id" text NOT NULL,
	"transport_profile" "participant_transport_profile" NOT NULL,
	"amount_eur" numeric(14, 2) NOT NULL,
	"allocation_method" "cost_allocation_method" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "travel_cost_entry_positive" CHECK ("travel_cost_entry"."amount_eur" > 0)
);
--> statement-breakpoint
CREATE TABLE "travel_cost_entry_document" (
	"travel_cost_entry_id" text NOT NULL,
	"proof_document_id" text NOT NULL,
	CONSTRAINT "travel_cost_entry_document_travel_cost_entry_id_proof_document_id_pk" PRIMARY KEY("travel_cost_entry_id","proof_document_id")
);
--> statement-breakpoint
ALTER TABLE "claim_history" ADD CONSTRAINT "claim_history_claim_id_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claim"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_history" ADD CONSTRAINT "claim_history_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_partnership_id_project_partner_organization_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "public"."project_partner_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_allocation" ADD CONSTRAINT "cost_allocation_travel_cost_entry_id_travel_cost_entry_id_fk" FOREIGN KEY ("travel_cost_entry_id") REFERENCES "public"."travel_cost_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_allocation" ADD CONSTRAINT "cost_allocation_project_participant_id_project_participant_id_fk" FOREIGN KEY ("project_participant_id") REFERENCES "public"."project_participant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_journey" ADD CONSTRAINT "participant_journey_project_participant_id_project_participant_id_fk" FOREIGN KEY ("project_participant_id") REFERENCES "public"."project_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_payout_account" ADD CONSTRAINT "partnership_payout_account_partnership_id_project_partner_organization_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "public"."project_partner_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_payout_account" ADD CONSTRAINT "partnership_payout_account_payout_account_id_payout_account_id_fk" FOREIGN KEY ("payout_account_id") REFERENCES "public"."payout_account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_account" ADD CONSTRAINT "payout_account_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_funding_band" ADD CONSTRAINT "project_funding_band_project_id_project_funding_snapshot_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_funding_snapshot"("project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_funding_snapshot" ADD CONSTRAINT "project_funding_snapshot_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_document" ADD CONSTRAINT "proof_document_claim_id_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_cost_entry" ADD CONSTRAINT "travel_cost_entry_claim_id_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_cost_entry_document" ADD CONSTRAINT "travel_cost_entry_document_travel_cost_entry_id_travel_cost_entry_id_fk" FOREIGN KEY ("travel_cost_entry_id") REFERENCES "public"."travel_cost_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_cost_entry_document" ADD CONSTRAINT "travel_cost_entry_document_proof_document_id_proof_document_id_fk" FOREIGN KEY ("proof_document_id") REFERENCES "public"."proof_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claim_history_claim_time_idx" ON "claim_history" USING btree ("claim_id","occurred_at");--> statement-breakpoint
CREATE INDEX "cost_allocation_participant_idx" ON "cost_allocation" USING btree ("project_participant_id");--> statement-breakpoint
CREATE INDEX "payout_account_organization_idx" ON "payout_account" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_funding_band_project_min_unique" ON "project_funding_band" USING btree ("project_id","min_km");--> statement-breakpoint
CREATE INDEX "proof_document_claim_idx" ON "proof_document" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "travel_cost_entry_claim_idx" ON "travel_cost_entry" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "travel_cost_entry_document_proof_idx" ON "travel_cost_entry_document" USING btree ("proof_document_id");