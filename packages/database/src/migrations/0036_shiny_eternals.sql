-- Pre-deploy: this query must return zero rows; resolve any duplicates before applying.
-- SELECT project_id, count(*) FROM project_partner_organization GROUP BY project_id HAVING count(*) > 1;
CREATE UNIQUE INDEX "project_partner_organization_project_unique" ON "project_partner_organization" USING btree ("project_id");
