ALTER TABLE "project_shared_travel_leg" ALTER COLUMN "distance_km" SET DATA TYPE decimal(10,1) USING "distance_km"::decimal(10,1);--> statement-breakpoint
DROP INDEX "participant_entry_token_pending_email_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "participant_entry_token_pending_email_unique" ON "participant_entry_token" ("project_id","email") WHERE "status" = 'pending' and "email" is not null;--> statement-breakpoint
DROP INDEX "project_participant_project_email_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "project_participant_project_email_unique" ON "project_participant" ("project_id","email") WHERE "email" is not null;--> statement-breakpoint
DROP INDEX "project_participant_project_user_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "project_participant_project_user_unique" ON "project_participant" ("project_id","user_id") WHERE "user_id" is not null;--> statement-breakpoint
DROP INDEX "project_name_trigram_idx";--> statement-breakpoint
CREATE INDEX "project_name_trigram_idx" ON "project" USING gin (lower("name") gin_trgm_ops) WHERE "archived" = false;--> statement-breakpoint
ALTER TABLE "claim_history" DROP CONSTRAINT "claim_history_reason_required", ADD CONSTRAINT "claim_history_reason_required" CHECK ("event_type" not in ('correction_requested', 'rejected', 'payment_corrected') or (nullif(trim("reason"), '') is not null));--> statement-breakpoint
ALTER TABLE "claim" DROP CONSTRAINT "claim_approved_amount_nonnegative", ADD CONSTRAINT "claim_approved_amount_nonnegative" CHECK ("approved_amount_eur" is null or "approved_amount_eur" >= 0);--> statement-breakpoint
ALTER TABLE "cost_allocation" DROP CONSTRAINT "cost_allocation_nonnegative", ADD CONSTRAINT "cost_allocation_nonnegative" CHECK (("percentage" is null or "percentage" >= 0) and ("amount_eur" is null or "amount_eur" >= 0) and not ("percentage" is not null and "amount_eur" is not null));--> statement-breakpoint
ALTER TABLE "duplicate_review_task" DROP CONSTRAINT "duplicate_review_lifecycle_check", ADD CONSTRAINT "duplicate_review_lifecycle_check" CHECK ((
      ("status" = 'open' and "assigned_to_user_id" is null and "decision" is null and "survivor_participation_id" is null and "resolved_at" is null) or
      ("status" = 'assigned' and "assigned_to_user_id" is not null and "decision" is null and "survivor_participation_id" is null and "resolved_at" is null) or
      ("status" = 'resolved' and "assigned_to_user_id" is not null and "decision" is not null and "survivor_participation_id" = "existing_participation_id" and "resolved_at" is not null)
    ));--> statement-breakpoint
ALTER TABLE "participant_journey" DROP CONSTRAINT "participant_journey_distance_positive", ADD CONSTRAINT "participant_journey_distance_positive" CHECK ("erasmus_distance_km" > 0);--> statement-breakpoint
ALTER TABLE "project_funding_band" DROP CONSTRAINT "project_funding_band_range", ADD CONSTRAINT "project_funding_band_range" CHECK ("min_km" >= 0 and "max_km" >= "min_km");--> statement-breakpoint
ALTER TABLE "project_funding_band" DROP CONSTRAINT "project_funding_band_rates", ADD CONSTRAINT "project_funding_band_rates" CHECK ("standard_eur" >= 0 and "green_eur" >= 0);--> statement-breakpoint
ALTER TABLE "project_participant" DROP CONSTRAINT "project_participant_email_normalized", ADD CONSTRAINT "project_participant_email_normalized" CHECK ("email" is null or "email" = lower(trim("email")));--> statement-breakpoint
ALTER TABLE "project_participant" DROP CONSTRAINT "project_participant_not_merged_into_self", ADD CONSTRAINT "project_participant_not_merged_into_self" CHECK ("merged_into_participant_id" is null or "merged_into_participant_id" <> "id");--> statement-breakpoint
ALTER TABLE "project_participant" DROP CONSTRAINT "project_participant_merge_fields_consistent", ADD CONSTRAINT "project_participant_merge_fields_consistent" CHECK (("merged_into_participant_id" is null and "merged_at" is null and "merged_by_user_id" is null) or ("merged_into_participant_id" is not null and "merged_at" is not null and "merged_by_user_id" is not null));--> statement-breakpoint
ALTER TABLE "proof_document" DROP CONSTRAINT "proof_document_size_positive", ADD CONSTRAINT "proof_document_size_positive" CHECK ("byte_size" > 0);--> statement-breakpoint
ALTER TABLE "travel_cost_entry" DROP CONSTRAINT "travel_cost_entry_positive", ADD CONSTRAINT "travel_cost_entry_positive" CHECK ("amount_eur" > 0);