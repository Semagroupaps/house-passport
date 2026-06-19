-- House Passport — sikkerhedslag v2 (køres som admin/superuser EFTER prisma migrate)
-- To adgangsmønstre + LÆSE- og SKRIVE-policies (USING + WITH CHECK).
-- Policy-helpers er SECURITY DEFINER, så selve adgangsevalueringen ikke selv
-- begrænses af RLS (undgår rekursion). Appen forbinder som hp_app (NOSUPERUSER).

-- 1) APP-ROLLE (ikke superuser, ikke bypassrls)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hp_app') THEN
    CREATE ROLE hp_app LOGIN PASSWORD 'hp_app_pw' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO hp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hp_app;

-- 2) INVARIANT: højst én aktiv ejer pr. bolig
CREATE UNIQUE INDEX IF NOT EXISTS one_active_owner
  ON ownership_period (property_id) WHERE valid_to IS NULL;

-- 3) KONTEKST-HELPERS (læser transaction-lokal kontekst sat af appen)
CREATE OR REPLACE FUNCTION app_person() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.current_person_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app_org() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid $$;

-- 4) ADGANGS-HELPERS (SECURITY DEFINER -> ser alle rækker under evaluering)
CREATE OR REPLACE FUNCTION is_current_owner(pid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM ownership_period op
    WHERE op.property_id = pid AND op.person_id = app_person() AND op.valid_to IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION can_read_property(pid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT is_current_owner(pid)
      OR EXISTS (
        SELECT 1 FROM access_grant g
        WHERE g.property_id = pid AND (g.valid_to IS NULL OR g.valid_to > now())
          AND ((g.subject_type='person'       AND g.subject_id = app_person())
            OR (g.subject_type='organization' AND g.subject_id = app_org())));
$$;

CREATE OR REPLACE FUNCTION can_read_document(pid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT is_current_owner(pid)
      OR EXISTS (
        SELECT 1 FROM access_grant g
        WHERE g.property_id = pid AND (g.valid_to IS NULL OR g.valid_to > now())
          AND 'documents:read' = ANY (g.scope)
          AND ((g.subject_type='person'       AND g.subject_id = app_person())
            OR (g.subject_type='organization' AND g.subject_id = app_org())));
$$;

CREATE OR REPLACE FUNCTION can_write_document(pid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT is_current_owner(pid)
      OR EXISTS (
        SELECT 1 FROM access_grant g
        WHERE g.property_id = pid AND (g.valid_to IS NULL OR g.valid_to > now())
          AND g.permission IN ('write','admin')
          AND 'documents:write' = ANY (g.scope)
          AND ((g.subject_type='person'       AND g.subject_id = app_person())
            OR (g.subject_type='organization' AND g.subject_id = app_org())));
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO hp_app;

-- 5) AKTIVÉR + TVING RLS
ALTER TABLE org_membership   ENABLE ROW LEVEL SECURITY; ALTER TABLE org_membership   FORCE ROW LEVEL SECURITY;
ALTER TABLE property         ENABLE ROW LEVEL SECURITY; ALTER TABLE property         FORCE ROW LEVEL SECURITY;
ALTER TABLE ownership_period ENABLE ROW LEVEL SECURITY; ALTER TABLE ownership_period FORCE ROW LEVEL SECURITY;
ALTER TABLE access_grant     ENABLE ROW LEVEL SECURITY; ALTER TABLE access_grant     FORCE ROW LEVEL SECURITY;
ALTER TABLE document         ENABLE ROW LEVEL SECURITY; ALTER TABLE document         FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- MØNSTER 1 — ORG-EJET DATA
-- ============================================================================
DROP POLICY IF EXISTS org_membership_all ON org_membership;
CREATE POLICY org_membership_all ON org_membership
  USING (org_id = app_org()) WITH CHECK (org_id = app_org());

-- ============================================================================
-- MØNSTER 2 — BOLIGDATA (delt commons via ejerskab/grants)
-- ============================================================================

-- PROPERTY
DROP POLICY IF EXISTS property_select ON property;
DROP POLICY IF EXISTS property_insert ON property;
DROP POLICY IF EXISTS property_update ON property;
CREATE POLICY property_select ON property FOR SELECT USING ( can_read_property(id) );
CREATE POLICY property_insert ON property FOR INSERT WITH CHECK ( app_person() IS NOT NULL );
CREATE POLICY property_update ON property FOR UPDATE
  USING ( is_current_owner(id) ) WITH CHECK ( is_current_owner(id) );

-- OWNERSHIP_PERIOD
DROP POLICY IF EXISTS ownership_select ON ownership_period;
DROP POLICY IF EXISTS ownership_insert ON ownership_period;
DROP POLICY IF EXISTS ownership_update ON ownership_period;
CREATE POLICY ownership_select ON ownership_period FOR SELECT
  USING ( person_id = app_person() OR is_current_owner(property_id) );
CREATE POLICY ownership_insert ON ownership_period FOR INSERT
  WITH CHECK ( person_id = app_person() );   -- man kan kun gøre SIG SELV til ejer
CREATE POLICY ownership_update ON ownership_period FOR UPDATE
  USING ( person_id = app_person() ) WITH CHECK ( person_id = app_person() );

-- ACCESS_GRANT
DROP POLICY IF EXISTS grant_select ON access_grant;
DROP POLICY IF EXISTS grant_insert ON access_grant;
DROP POLICY IF EXISTS grant_delete ON access_grant;
CREATE POLICY grant_select ON access_grant FOR SELECT USING (
  granted_by = app_person()
  OR (subject_type='person'       AND subject_id = app_person())
  OR (subject_type='organization' AND subject_id = app_org())
  OR is_current_owner(property_id)
);
CREATE POLICY grant_insert ON access_grant FOR INSERT
  WITH CHECK ( granted_by = app_person() AND is_current_owner(property_id) ); -- kun ejeren uddeler
CREATE POLICY grant_delete ON access_grant FOR DELETE
  USING ( granted_by = app_person() OR is_current_owner(property_id) );

-- DOCUMENT
DROP POLICY IF EXISTS document_select ON document;
DROP POLICY IF EXISTS document_insert ON document;
DROP POLICY IF EXISTS document_update ON document;
CREATE POLICY document_select ON document FOR SELECT USING ( can_read_document(property_id) );
CREATE POLICY document_insert ON document FOR INSERT WITH CHECK ( can_write_document(property_id) );
CREATE POLICY document_update ON document FOR UPDATE
  USING ( can_write_document(property_id) ) WITH CHECK ( can_write_document(property_id) );

-- MAINTENANCE_TASK + WARRANTY (boligdata — samme commons-mønster)
ALTER TABLE maintenance_task ENABLE ROW LEVEL SECURITY; ALTER TABLE maintenance_task FORCE ROW LEVEL SECURITY;
ALTER TABLE warranty         ENABLE ROW LEVEL SECURITY; ALTER TABLE warranty         FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS maint_select ON maintenance_task;
DROP POLICY IF EXISTS maint_insert ON maintenance_task;
DROP POLICY IF EXISTS maint_update ON maintenance_task;
CREATE POLICY maint_select ON maintenance_task FOR SELECT USING ( can_read_property(property_id) );
CREATE POLICY maint_insert ON maintenance_task FOR INSERT WITH CHECK ( is_current_owner(property_id) );
CREATE POLICY maint_update ON maintenance_task FOR UPDATE
  USING ( is_current_owner(property_id) ) WITH CHECK ( is_current_owner(property_id) );

DROP POLICY IF EXISTS warranty_select ON warranty;
DROP POLICY IF EXISTS warranty_insert ON warranty;
CREATE POLICY warranty_select ON warranty FOR SELECT USING ( can_read_property(property_id) );
CREATE POLICY warranty_insert ON warranty FOR INSERT WITH CHECK ( is_current_owner(property_id) );

-- ============================================================================
-- 6) EMBEDDINGS (pgvector) — bevidst UDEN for Prisma (vector-typen kan ikke
--    udtrykkes i schemaet; tilgås via raw SQL). Samme grant-RLS som dokumenter,
--    så AI-søgning aldrig lækker på tværs af boliger (Trin 6.3-reglen).
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document_chunk (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  property_id uuid NOT NULL,
  chunk_index int  NOT NULL DEFAULT 0,
  chunk_text  text,
  embedding   vector(1536)
);
CREATE INDEX IF NOT EXISTS document_chunk_hnsw
  ON document_chunk USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS document_chunk_by_property
  ON document_chunk (property_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON document_chunk TO hp_app;
ALTER TABLE document_chunk ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunk FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chunk_select ON document_chunk;
DROP POLICY IF EXISTS chunk_write  ON document_chunk;
CREATE POLICY chunk_select ON document_chunk FOR SELECT USING ( can_read_document(property_id) );
CREATE POLICY chunk_write  ON document_chunk FOR INSERT WITH CHECK ( can_write_document(property_id) );

-- ============================================================================
-- 7) PERSON — en person kan kun læse/opdatere sig selv (fx MitID-verificeret-flag)
-- ============================================================================
ALTER TABLE person ENABLE ROW LEVEL SECURITY;
ALTER TABLE person FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS person_self_select ON person;
DROP POLICY IF EXISTS person_self_update ON person;
CREATE POLICY person_self_select ON person FOR SELECT USING ( id = app_person() );
CREATE POLICY person_self_update ON person FOR UPDATE
  USING ( id = app_person() ) WITH CHECK ( id = app_person() );

-- ============================================================================
-- PROPERTY_TRANSFER — tilgås kun via den betroede TransferService (admin-forbindelse).
-- FORCE RLS uden policies => app-rollen (hp_app) nægtes adgang; admin bypasser.
-- ============================================================================
ALTER TABLE property_transfer ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_transfer FORCE ROW LEVEL SECURITY;
