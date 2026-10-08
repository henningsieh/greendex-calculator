CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
CREATE INDEX "project_hosted_overview_operational_idx" ON "project" USING btree ("organization_id","archived","cost_submission_window_open" DESC NULLS LAST,"start_date","id");--> statement-breakpoint
CREATE INDEX "project_hosted_overview_date_idx" ON "project" USING btree ("organization_id","archived","start_date","end_date","id");--> statement-breakpoint
CREATE INDEX "project_name_trigram_idx" ON "project" USING gin (lower("name") gin_trgm_ops) WHERE "project"."archived" = false;