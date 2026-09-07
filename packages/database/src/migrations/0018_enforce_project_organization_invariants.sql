CREATE FUNCTION validate_project_partner_organization()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "project"
    WHERE "id" = NEW."project_id"
      AND "organization_id" = NEW."organization_id"
  ) THEN
    RAISE EXCEPTION 'A Project owning Organization cannot also be a Partner Organization';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER project_partner_organization_valid
AFTER INSERT OR UPDATE ON "project_partner_organization"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION validate_project_partner_organization();
--> statement-breakpoint
CREATE FUNCTION validate_project_participant_represented_organization()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "project"
    WHERE "id" = NEW."project_id"
      AND "organization_id" = NEW."represented_organization_id"
  ) AND NOT EXISTS (
    SELECT 1
    FROM "project_partner_organization"
    WHERE "project_id" = NEW."project_id"
      AND "organization_id" = NEW."represented_organization_id"
  ) THEN
    RAISE EXCEPTION 'A Project Participation must represent its owning or a Partner Organization';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER project_participant_represented_organization_valid
AFTER INSERT OR UPDATE OF "project_id", "represented_organization_id" ON "project_participant"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION validate_project_participant_represented_organization();
--> statement-breakpoint
CREATE FUNCTION protect_project_organization_relationships()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "project_partner_organization"
    WHERE "project_id" = NEW."id"
      AND "organization_id" = NEW."organization_id"
  ) THEN
    RAISE EXCEPTION 'A Project owning Organization cannot also be a Partner Organization';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "project_participant" AS participation
    WHERE participation."project_id" = NEW."id"
      AND participation."represented_organization_id" <> NEW."organization_id"
      AND NOT EXISTS (
        SELECT 1
        FROM "project_partner_organization" AS partnership
        WHERE partnership."project_id" = NEW."id"
          AND partnership."organization_id" = participation."represented_organization_id"
      )
  ) THEN
    RAISE EXCEPTION 'Changing the Project owning Organization would invalidate a Project Participation';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER project_organization_relationships_valid
AFTER UPDATE OF "organization_id" ON "project"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION protect_project_organization_relationships();
--> statement-breakpoint
CREATE FUNCTION protect_represented_partner_organization()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "project_participant"
    WHERE "project_id" = OLD."project_id"
      AND "represented_organization_id" = OLD."organization_id"
  ) THEN
    RAISE EXCEPTION 'A Partner Organization represented by a Project Participation cannot be removed';
  END IF;

  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER project_partner_organization_in_use
AFTER DELETE OR UPDATE OF "project_id", "organization_id" ON "project_partner_organization"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION protect_represented_partner_organization();
