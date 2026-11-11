-- QA ONLY — align physical order of public.convites columns with production.
-- Requires QA to be empty; will never run on the production project.
DO $guard$
BEGIN
 IF EXISTS (SELECT 1 FROM public.convites LIMIT 1) OR EXISTS (SELECT 1 FROM auth.users LIMIT 1)
 THEN RAISE EXCEPTION 'QA_NOT_EMPTY_ABORT_REBUILD'; END IF;
END $guard$;
DROP TABLE public.convites;
CREATE TABLE public.convites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 codigo_hash text NOT NULL UNIQUE CHECK (codigo_hash ~ '^[0-9a-f]{64}$'),
 criado_por uuid NOT NULL REFERENCES public.perfis(id) ON DELETE RESTRICT,
 criado_em timestamptz NOT NULL DEFAULT now(),
 expira_em timestamptz NOT NULL,
 usos_max integer NOT NULL CHECK (usos_max BETWEEN 1 AND 50),
 usos integer NOT NULL DEFAULT 0 CHECK (usos >= 0 AND usos <= usos_max),
 revogado boolean NOT NULL DEFAULT false,
 codigo_curto_hash text
);
CREATE UNIQUE INDEX convites_codigo_curto_hash_uniq ON public.convites(codigo_curto_hash)
 WHERE codigo_curto_hash IS NOT NULL;
CREATE INDEX idx_convites_ativos ON public.convites(expira_em,revogado);
CREATE INDEX idx_convites_criado_por ON public.convites(criado_por);
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;
CREATE POLICY convites_leitura_autorizada ON public.convites FOR SELECT TO authenticated
 USING ((SELECT private.pode_aprovar()));
REVOKE ALL ON public.convites FROM public,anon,authenticated;
GRANT SELECT ON public.convites TO authenticated;
