ALTER TABLE "claim" RENAME COLUMN "approved_amount_eur" TO "reimbursement_amount_eur";--> statement-breakpoint
ALTER TABLE "claim" DROP CONSTRAINT "claim_approved_amount_nonnegative";--> statement-breakpoint
ALTER TABLE "claim" DROP CONSTRAINT "claim_approved_amount_required_unless_preparation";--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_reimbursement_amount_nonnegative" CHECK ("claim"."reimbursement_amount_eur" is null or "claim"."reimbursement_amount_eur" >= 0);--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_reimbursement_amount_required_unless_preparation" CHECK ("claim"."status" = 'in_preparation' or "claim"."reimbursement_amount_eur" is not null);