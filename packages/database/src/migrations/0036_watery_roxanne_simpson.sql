CREATE TABLE "principal_quota_counters" (
	"kind" text NOT NULL,
	"organization_id" text NOT NULL,
	"user_key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" bigint NOT NULL,
	CONSTRAINT "principal_quota_counters_kind_organization_id_user_key_pk" PRIMARY KEY("kind","organization_id","user_key"),
	CONSTRAINT "principal_quota_kind_key" CHECK (("principal_quota_counters"."kind" = 'upload_bytes' and "principal_quota_counters"."user_key" = '') or ("principal_quota_counters"."kind" = 'listing_calls' and "principal_quota_counters"."user_key" <> '')),
	CONSTRAINT "principal_quota_used_nonnegative" CHECK ("principal_quota_counters"."used" >= 0),
	CONSTRAINT "principal_quota_window_valid" CHECK ("principal_quota_counters"."expires_at" > "principal_quota_counters"."window_start" or ("principal_quota_counters"."window_start" = '1970-01-01T00:00:00Z'::timestamptz and "principal_quota_counters"."expires_at" = "principal_quota_counters"."window_start" and "principal_quota_counters"."used" = 0))
);
--> statement-breakpoint
CREATE INDEX "principal_quota_expiry_idx" ON "principal_quota_counters" USING btree ("expires_at");