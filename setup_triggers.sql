-- Função para atualizar o horario_contato na tabela leads
CREATE OR REPLACE FUNCTION public.update_lead_horario_contato()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.leads
  SET horario_contato = NEW.criado_em
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para executar a função sempre que uma nova interação for inserida
DROP TRIGGER IF EXISTS trigger_update_lead_horario on public.interacoes;
CREATE TRIGGER trigger_update_lead_horario
AFTER INSERT ON public.interacoes
FOR EACH ROW
EXECUTE FUNCTION public.update_lead_horario_contato();
