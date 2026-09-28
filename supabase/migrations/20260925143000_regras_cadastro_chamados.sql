-- Ajustes solicitados no cadastro de chamados
-- Garante o catálogo permitido e desativa as demais sem apagar histórico.
INSERT INTO public.categories(name) VALUES
  ('Administrativo'), ('TI'), ('Fiscalização'), ('AT'), ('Cadastro Subterrâneo'), ('Treinamentos')
ON CONFLICT (name) DO UPDATE SET is_active = true;

UPDATE public.categories
SET is_active = (name IN ('Administrativo', 'TI', 'Fiscalização', 'AT', 'Cadastro Subterrâneo', 'Treinamentos'));

-- Subcategorias e concessionárias deixam de ser usadas no fluxo.
UPDATE public.subcategories SET is_active = false;
UPDATE public.concessionaires SET is_active = false;

-- O formulário trabalha apenas com SLA baixo, médio e alto.
DELETE FROM public.sla_config WHERE priority = 'p1';
