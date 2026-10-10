DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "project_activity"
		WHERE "activity_type" NOT IN ('boat', 'bus', 'train', 'car', 'electricCar')
	) THEN
		RAISE EXCEPTION 'Cannot migrate project_activity: activity_type contains a profile outside the Project Shared Travel profile set';
	END IF;
END $$;--> statement-breakpoint
CREATE TYPE "public"."project_shared_transport_emission_profile" AS ENUM('boat', 'bus', 'train', 'car', 'electricCar');--> statement-breakpoint
ALTER TABLE "project_activity" RENAME TO "project_shared_travel_leg";--> statement-breakpoint
ALTER TABLE "project_shared_travel_leg" RENAME CONSTRAINT "project_activity_pkey" TO "project_shared_travel_leg_pkey";--> statement-breakpoint
ALTER TABLE "project_shared_travel_leg" RENAME CONSTRAINT "project_activity_project_id_project_id_fk" TO "project_shared_travel_leg_project_id_project_id_fk";--> statement-breakpoint
ALTER TABLE "project_shared_travel_leg" RENAME COLUMN "activity_type" TO "transport_emission_profile";--> statement-breakpoint
ALTER TABLE "project_shared_travel_leg" RENAME COLUMN "activity_date" TO "travel_date";--> statement-breakpoint
ALTER TABLE "project_shared_travel_leg" ALTER COLUMN "transport_emission_profile" SET DATA TYPE "project_shared_transport_emission_profile" USING "transport_emission_profile"::"project_shared_transport_emission_profile";--> statement-breakpoint
CREATE VIEW "project_activity" AS
SELECT
	"id",
	"project_id",
	"transport_emission_profile"::text AS "activity_type",
	"distance_km",
	"description",
	"travel_date" AS "activity_date",
	"created_at",
	"updated_at"
FROM "project_shared_travel_leg";--> statement-breakpoint
CREATE FUNCTION "project_activity_compatibility_view_write"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		NEW."created_at" := COALESCE(NEW."created_at", now());
		NEW."updated_at" := COALESCE(NEW."updated_at", now());

		INSERT INTO "project_shared_travel_leg" (
			"id",
			"project_id",
			"transport_emission_profile",
			"distance_km",
			"description",
			"travel_date",
			"created_at",
			"updated_at"
		)
		VALUES (
			NEW."id",
			NEW."project_id",
			NEW."activity_type"::"project_shared_transport_emission_profile",
			NEW."distance_km",
			NEW."description",
			NEW."activity_date",
			NEW."created_at",
			NEW."updated_at"
		);
		RETURN NEW;
	ELSIF TG_OP = 'UPDATE' THEN
		UPDATE "project_shared_travel_leg"
		SET
			"id" = NEW."id",
			"project_id" = NEW."project_id",
			"transport_emission_profile" = NEW."activity_type"::"project_shared_transport_emission_profile",
			"distance_km" = NEW."distance_km",
			"description" = NEW."description",
			"travel_date" = NEW."activity_date",
			"created_at" = NEW."created_at",
			"updated_at" = NEW."updated_at"
		WHERE "id" = OLD."id";
		RETURN NEW;
	END IF;

	DELETE FROM "project_shared_travel_leg" WHERE "id" = OLD."id";
	RETURN OLD;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "project_activity_compatibility_view_write"
INSTEAD OF INSERT OR UPDATE OR DELETE ON "project_activity"
FOR EACH ROW EXECUTE FUNCTION "project_activity_compatibility_view_write"();--> statement-breakpoint
