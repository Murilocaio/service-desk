-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','gestor','tecnico','solicitante');
CREATE TYPE public.ticket_status AS ENUM ('novo','triagem','atribuido','atendimento','aguardando_usuario','aguardando_terceiro','validacao','resolvido','encerrado','reaberto','cancelado');
CREATE TYPE public.ticket_priority AS ENUM ('p1','p2','p3','p4');
CREATE TYPE public.level_scale AS ENUM ('baixo','medio','alto','critico');

-- UPDATED_AT
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  phone text,
  position text,
  department text,
  team_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','gestor'));
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;

-- TEAMS
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  manager_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.in_team(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _team_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id
  );
$$;

-- CATALOGS
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcategories TO authenticated;
GRANT ALL ON public.subcategories TO service_role;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.concessionaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  state text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.concessionaires TO authenticated;
GRANT ALL ON public.concessionaires TO service_role;
ALTER TABLE public.concessionaires ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  document text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sla_config (
  priority public.ticket_priority PRIMARY KEY,
  response_hours integer NOT NULL DEFAULT 2,
  resolution_hours integer NOT NULL DEFAULT 24,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_config TO authenticated;
GRANT ALL ON public.sla_config TO service_role;
ALTER TABLE public.sla_config ENABLE ROW LEVEL SECURITY;

-- TICKET NUMBER COUNTER
CREATE TABLE public.ticket_counters (
  year integer PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.ticket_counters TO service_role;
ALTER TABLE public.ticket_counters ENABLE ROW LEVEL SECURITY;

-- TICKETS
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status public.ticket_status NOT NULL DEFAULT 'novo',
  priority public.ticket_priority NOT NULL DEFAULT 'p3',
  impact public.level_scale NOT NULL DEFAULT 'medio',
  urgency public.level_scale NOT NULL DEFAULT 'medio',
  category_id uuid REFERENCES public.categories(id),
  subcategory_id uuid REFERENCES public.subcategories(id),
  team_id uuid REFERENCES public.teams(id),
  assignee_id uuid,
  created_by uuid NOT NULL,
  requester_user_id uuid,
  requester_name text,
  requester_email text,
  requester_phone text,
  requester_department text,
  company_id uuid REFERENCES public.companies(id),
  unit text,
  address text,
  city text,
  state text,
  zip_code text,
  landmark text,
  latitude numeric,
  longitude numeric,
  concessionaire_id uuid REFERENCES public.concessionaires(id),
  installation_number text,
  request_number text,
  service_order text,
  project_number text,
  art text,
  technical_manager text,
  due_at timestamptz,
  solution text,
  resolved_at timestamptz,
  closed_at timestamptz,
  closed_by uuid,
  reopen_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_priority ON public.tickets(priority);
CREATE INDEX idx_tickets_assignee ON public.tickets(assignee_id);
CREATE INDEX idx_tickets_created_by ON public.tickets(created_by);
CREATE INDEX idx_tickets_team ON public.tickets(team_id);
CREATE INDEX idx_tickets_created_at ON public.tickets(created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tickets_updated BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ticket_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'participante',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_participants TO authenticated;
GRANT ALL ON public.ticket_participants TO service_role;
ALTER TABLE public.ticket_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_ticket(_ticket_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_manager(_user_id) OR EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = _ticket_id AND (
      t.created_by = _user_id
      OR t.requester_user_id = _user_id
      OR t.assignee_id = _user_id
      OR public.in_team(_user_id, t.team_id)
      OR EXISTS (SELECT 1 FROM public.ticket_participants p WHERE p.ticket_id = t.id AND p.user_id = _user_id)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_ticket(_ticket_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_manager(_user_id) OR EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = _ticket_id AND (
      t.assignee_id = _user_id
      OR public.in_team(_user_id, t.team_id)
      OR EXISTS (SELECT 1 FROM public.ticket_participants p WHERE p.ticket_id = t.id AND p.user_id = _user_id)
    )
  );
$$;

CREATE TABLE public.ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  parent_id uuid REFERENCES public.ticket_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_ticket ON public.ticket_comments(ticket_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_comments TO authenticated;
GRANT ALL ON public.ticket_comments TO service_role;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size bigint,
  is_image boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_attachments_ticket ON public.ticket_attachments(ticket_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_attachments TO authenticated;
GRANT ALL ON public.ticket_attachments TO service_role;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ticket_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  description text,
  minutes_spent integer NOT NULL DEFAULT 0,
  result text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_ticket ON public.ticket_activities(ticket_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_activities TO authenticated;
GRANT ALL ON public.ticket_activities TO service_role;
ALTER TABLE public.ticket_activities ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ticket_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  field text,
  old_value text,
  new_value text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_history_ticket ON public.ticket_history(ticket_id);
GRANT SELECT, INSERT ON public.ticket_history TO authenticated;
GRANT ALL ON public.ticket_history TO service_role;
ALTER TABLE public.ticket_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ticket_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL UNIQUE REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ticket_ratings TO authenticated;
GRANT ALL ON public.ticket_ratings TO service_role;
ALTER TABLE public.ticket_ratings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  ticket_number text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- TICKET NUMBER + SLA DUE DATE
CREATE OR REPLACE FUNCTION public.tickets_before_insert() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE y integer := EXTRACT(YEAR FROM now())::int; n integer; h integer;
BEGIN
  INSERT INTO public.ticket_counters(year, last_number) VALUES (y, 1)
  ON CONFLICT (year) DO UPDATE SET last_number = public.ticket_counters.last_number + 1
  RETURNING last_number INTO n;
  NEW.number := 'ME-' || y || '-' || lpad(n::text, 6, '0');
  SELECT resolution_hours INTO h FROM public.sla_config WHERE priority = NEW.priority;
  IF h IS NOT NULL THEN NEW.due_at := now() + (h || ' hours')::interval; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER tickets_number BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.tickets_before_insert();

-- PROFILE BOOTSTRAP
CREATE OR REPLACE FUNCTION public.ensure_profile(_full_name text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid := auth.uid(); _email text := (auth.jwt() ->> 'email');
BEGIN
  IF _id IS NULL THEN RETURN; END IF;
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (_id, coalesce(_email,''), coalesce(nullif(_full_name,''), split_part(coalesce(_email,'usuario'), '@', 1)))
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _id) THEN
    IF lower(coalesce(_email,'')) = 'caio.rocha@meconsulting.com.br' THEN
      INSERT INTO public.user_roles(user_id, role) VALUES (_id, 'admin');
    ELSE
      INSERT INTO public.user_roles(user_id, role) VALUES (_id, 'solicitante');
    END IF;
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.ensure_profile(text) TO authenticated;

-- POLICIES
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "teams_select" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "teams_manage" ON public.teams FOR ALL TO authenticated USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));
CREATE POLICY "team_members_select" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_members_manage" ON public.team_members FOR ALL TO authenticated USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "categories_select" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_manage" ON public.categories FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "subcategories_select" ON public.subcategories FOR SELECT TO authenticated USING (true);
CREATE POLICY "subcategories_manage" ON public.subcategories FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "concessionaires_select" ON public.concessionaires FOR SELECT TO authenticated USING (true);
CREATE POLICY "concessionaires_manage" ON public.concessionaires FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "companies_select" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies_manage" ON public.companies FOR ALL TO authenticated USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));
CREATE POLICY "sla_select" ON public.sla_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "sla_manage" ON public.sla_config FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "tickets_select" ON public.tickets FOR SELECT TO authenticated USING (
  public.is_manager(auth.uid())
  OR created_by = auth.uid()
  OR requester_user_id = auth.uid()
  OR assignee_id = auth.uid()
  OR public.in_team(auth.uid(), team_id)
  OR EXISTS (SELECT 1 FROM public.ticket_participants p WHERE p.ticket_id = tickets.id AND p.user_id = auth.uid())
);
CREATE POLICY "tickets_insert" ON public.tickets FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "tickets_update" ON public.tickets FOR UPDATE TO authenticated USING (
  public.is_manager(auth.uid()) OR created_by = auth.uid() OR assignee_id = auth.uid()
  OR public.in_team(auth.uid(), team_id)
  OR EXISTS (SELECT 1 FROM public.ticket_participants p WHERE p.ticket_id = tickets.id AND p.user_id = auth.uid())
) WITH CHECK (true);
CREATE POLICY "tickets_delete_admin" ON public.tickets FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "participants_select" ON public.ticket_participants FOR SELECT TO authenticated USING (public.can_view_ticket(ticket_id, auth.uid()));
CREATE POLICY "participants_manage" ON public.ticket_participants FOR ALL TO authenticated USING (public.can_edit_ticket(ticket_id, auth.uid())) WITH CHECK (public.can_edit_ticket(ticket_id, auth.uid()));

CREATE POLICY "comments_select" ON public.ticket_comments FOR SELECT TO authenticated USING (public.can_view_ticket(ticket_id, auth.uid()));
CREATE POLICY "comments_insert" ON public.ticket_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_view_ticket(ticket_id, auth.uid()));
CREATE POLICY "comments_delete_admin" ON public.ticket_comments FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "attachments_select" ON public.ticket_attachments FOR SELECT TO authenticated USING (public.can_view_ticket(ticket_id, auth.uid()));
CREATE POLICY "attachments_insert" ON public.ticket_attachments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_view_ticket(ticket_id, auth.uid()));
CREATE POLICY "attachments_delete" ON public.ticket_attachments FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_manager(auth.uid()));

CREATE POLICY "activities_select" ON public.ticket_activities FOR SELECT TO authenticated USING (public.can_view_ticket(ticket_id, auth.uid()));
CREATE POLICY "activities_insert" ON public.ticket_activities FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_view_ticket(ticket_id, auth.uid()));
CREATE POLICY "activities_update_own" ON public.ticket_activities FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_manager(auth.uid())) WITH CHECK (true);

CREATE POLICY "history_select" ON public.ticket_history FOR SELECT TO authenticated USING (public.can_view_ticket(ticket_id, auth.uid()));
CREATE POLICY "history_insert" ON public.ticket_history FOR INSERT TO authenticated WITH CHECK (public.can_view_ticket(ticket_id, auth.uid()));

CREATE POLICY "ratings_select" ON public.ticket_ratings FOR SELECT TO authenticated USING (public.can_view_ticket(ticket_id, auth.uid()));
CREATE POLICY "ratings_insert" ON public.ticket_ratings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_view_ticket(ticket_id, auth.uid()));
CREATE POLICY "ratings_update_own" ON public.ticket_ratings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "audit_select_admin" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- SEED
INSERT INTO public.sla_config(priority, response_hours, resolution_hours) VALUES
  ('p1', 1, 4), ('p2', 2, 8), ('p3', 4, 24), ('p4', 8, 72);

INSERT INTO public.categories(name) VALUES
  ('Projetos de Alta Tensão'),('Projetos de Média Tensão'),('Projetos de Baixa Tensão'),
  ('Iluminação Pública'),('Fiscalização'),('Regularização de Uso'),('Telefonia'),
  ('Cabos de Telecomunicação'),('Vistoria'),('Levantamento'),('Engenharia'),('Projetos'),
  ('Campo'),('Documentação'),('Administrativo'),('Comercial'),('Outros');

INSERT INTO public.concessionaires(name, state) VALUES
  ('ENEL','SP'),('CPFL','SP'),('Light','RJ'),('Cemig','MG'),('Outra',NULL);

INSERT INTO public.teams(name, description) VALUES
  ('Engenharia','Equipe de engenharia'),('Projetos','Equipe de projetos'),
  ('Campo','Equipe de campo'),('Fiscalização','Equipe de fiscalização'),
  ('Administrativo','Equipe administrativa'),('Comercial','Equipe comercial'),('TI','Tecnologia da informação');