import React, { useState, useEffect, useCallback, useId, useRef, type ReactNode } from 'react';
import { api, COR_PRIMARIA_PADRAO, COR_SECUNDARIA_PADRAO } from '../api/client';
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react';
import { Button, Field, PageHeader, Panel } from '../components/ui';

interface OficinaProps {
  empresaId: string;
  /** Avisa o app quando o formulário tem alterações não salvas (para perguntar antes de trocar de tela ou de oficina). */
  onSujoChange?: (sujo: boolean) => void;
}

// Cada seção: título e uma linha de apoio à esquerda, campos à direita (empilhados no celular).
function Secao({
  titulo,
  apoio,
  carregando,
  campos = 4,
  children,
}: {
  titulo: string;
  apoio: string;
  carregando: boolean;
  campos?: number;
  children: ReactNode;
}) {
  const idTitulo = useId();
  return (
    <Panel as="section" aria-labelledby={idTitulo} espaco="lg" className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
      <div className="mb-5 lg:mb-0">
        <h2 id={idTitulo} className="text-base font-semibold text-ink text-balance">
          {titulo}
        </h2>
        <p className="mt-1 text-sm text-ink-muted text-pretty">{apoio}</p>
      </div>
      {carregando ? (
        <div role="status" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <span className="sr-only">Carregando</span>
          {Array.from({ length: campos }, (_, i) => (
            <div key={i} aria-hidden="true" className="h-11 rounded-lg bg-muted animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
      )}
    </Panel>
  );
}

export function Oficina({ empresaId, onSujoChange }: OficinaProps) {
  const [carregando, setCarregando] = useState(true);
  // De qual oficina são os dados no formulário: trocar de oficina (master) volta ao esqueleto/erro, nunca mostra os de outra
  const [empresaDosDados, setEmpresaDosDados] = useState<string | null>(null);
  // Trocou de oficina: esquece já no render (sem esperar o efeito) que havia dados. Em A→B→A com B sem
  // carregar, o formulário ainda guarda o que foi descartado em A e não pode voltar a aparecer nem ser salvo.
  const [empresaVista, setEmpresaVista] = useState(empresaId);
  if (empresaVista !== empresaId) {
    setEmpresaVista(empresaId);
    setEmpresaDosDados(null);
  }
  const jaCarregou = empresaDosDados === empresaId;
  // Só a carga mais recente pode preencher o formulário (uma resposta atrasada de outra oficina é ignorada)
  const cargaAtual = useRef(0);
  const [salvando, setSalvando] = useState(false);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Erro de carga guardado com a oficina a que se refere (o de uma oficina não aparece na outra)
  const [falhaCarga, setFalhaCarga] = useState<{ empresaId: string; mensagem: string } | null>(null);
  const erroCarga = falhaCarga?.empresaId === empresaId ? falhaCarga.mensagem : null;

  // Form Dados da Oficina
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [telefone, setTelefone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  const [chavePix, setChavePix] = useState('');

  // Identidade Visual
  const [corPrimaria, setCorPrimaria] = useState(COR_PRIMARIA_PADRAO);
  const [corSecundaria, setCorSecundaria] = useState(COR_SECUNDARIA_PADRAO);

  // Coordenadas GPS e Raio do Pátio (automáticos)
  const [latGps, setLatGps] = useState<number | null>(null);
  const [lonGps, setLonGps] = useState<number | null>(null);
  const [raioGps, setRaioGps] = useState<number>(100);
  const [resolvendoLocalizacao, setResolvendoLocalizacao] = useState(false);

  // Parâmetros da Folha & Comissões
  const [diaPagamento, setDiaPagamento] = useState<number>(5);
  const [diaAdiantamento, setDiaAdiantamento] = useState<number>(20);
  const [comissaoServico, setComissaoServico] = useState<number>(15);
  const [comissaoPeca, setComissaoPeca] = useState<number>(5);
  const [pagaHoraExtra, setPagaHoraExtra] = useState<boolean>(true);
  const [valorHoraExtra, setValorHoraExtra] = useState<number>(25);

  // Alterações não salvas: compara o formulário com o que veio do servidor (ou foi salvo por último).
  // As coordenadas ficam de fora porque o app as resolve sozinho ao carregar.
  const [baseline, setBaseline] = useState<string | null>(null);
  const [pedirBaseline, setPedirBaseline] = useState(false);
  const atual = JSON.stringify([
    nomeFantasia,
    razaoSocial,
    cnpj,
    inscricaoEstadual,
    telefone,
    whatsapp,
    email,
    cep,
    endereco,
    chavePix,
    corPrimaria,
    corSecundaria,
    raioGps,
    diaPagamento,
    diaAdiantamento,
    comissaoServico,
    comissaoPeca,
    pagaHoraExtra,
    valorHoraExtra,
  ]);
  const sujo = jaCarregou && baseline !== null && atual !== baseline;

  useEffect(() => {
    if (!pedirBaseline) return;
    setBaseline(atual);
    setPedirBaseline(false);
  }, [pedirBaseline, atual]);

  // "Descartar alterações?" pendente: ação que só roda se a pessoa confirmar
  const [saidaPendente, setSaidaPendente] = useState<(() => void) | null>(null);
  const liberado = useRef(false);

  // Trocou de oficina: o que estava no formulário era da anterior
  useEffect(() => {
    setBaseline(null);
    setPedirBaseline(false);
    setErro(null);
    setSucessoMsg(null);
  }, [empresaId]);

  // Sem alterações (salvou, descartou ou trocou de oficina): não há mais o que confirmar
  useEffect(() => {
    if (!sujo) setSaidaPendente(null);
  }, [sujo]);

  useEffect(() => {
    onSujoChange?.(sujo);
  }, [sujo, onSujoChange]);
  useEffect(() => () => onSujoChange?.(false), [onSujoChange]);

  // Resolução automática das coordenadas sem intervenção manual do usuário
  const resolverCoordenadasAutomaticas = useCallback(async (termo: string) => {
    if (!termo || !termo.trim()) return;
    const carga = cargaAtual.current;
    try {
      setResolvendoLocalizacao(true);
      const res = await api.geocodificarEndereco(termo);
      if (carga !== cargaAtual.current) return;
      if (res && res.latitude && res.longitude) {
        setLatGps(res.latitude);
        setLonGps(res.longitude);
      }
    } catch {} finally {
      setResolvendoLocalizacao(false);
    }
  }, []);

  const carregarDados = useCallback(async () => {
    const carga = ++cargaAtual.current;
    try {
      setCarregando(true);
      setFalhaCarga(null);
      const [cfg, paramsFolha] = await Promise.all([
        api.obterConfiguracoesOficina(empresaId),
        api.obterParametrosFolha(empresaId),
      ]);
      if (carga !== cargaAtual.current) return;

      setNomeFantasia(cfg.nome_fantasia || '');
      setRazaoSocial(cfg.razao_social || '');
      setCnpj(cfg.cnpj || '');
      setInscricaoEstadual(cfg.inscricao_estadual || '');
      setTelefone(cfg.telefone || '');
      setWhatsapp(cfg.whatsapp || '');
      setEmail(cfg.email || '');
      setEndereco(cfg.endereco || '');
      setChavePix(cfg.chave_pix || '');
      setCorPrimaria(cfg.cor_primaria || COR_PRIMARIA_PADRAO);
      setCorSecundaria(cfg.cor_secundaria || COR_SECUNDARIA_PADRAO);
      setLatGps(cfg.latitude_gps ?? null);
      setLonGps(cfg.longitude_gps ?? null);
      setRaioGps(cfg.raio_gps_metros || 100);

      // Extrai CEP do endereço caso exista no cadastro
      const cepMatch = (cfg.endereco || '').match(/\b\d{5}-?\d{3}\b/);
      setCep(cepMatch ? cepMatch[0] : '');

      // Se ainda não tiver coordenadas gravadas, busca automaticamente
      if (!cfg.latitude_gps || !cfg.longitude_gps) {
        if (cepMatch) {
          resolverCoordenadasAutomaticas(cepMatch[0]);
        } else if (cfg.endereco) {
          resolverCoordenadasAutomaticas(cfg.endereco);
        }
      }

      setDiaPagamento(paramsFolha.dia_pagamento);
      setDiaAdiantamento(paramsFolha.dia_adiantamento);
      setComissaoServico(paramsFolha.comissao_global_servico_pct);
      setComissaoPeca(paramsFolha.comissao_global_peca_pct);
      setPagaHoraExtra(paramsFolha.paga_hora_extra_padrao);
      setValorHoraExtra(paramsFolha.valor_hora_extra_padrao);
      setEmpresaDosDados(empresaId);
      setPedirBaseline(true);
    } catch (e) {
      if (carga !== cargaAtual.current) return;
      const err = e as Error;
      setFalhaCarga({ empresaId, mensagem: err.message || 'Erro ao carregar dados da oficina.' });
    } finally {
      if (carga === cargaAtual.current) setCarregando(false);
    }
  }, [empresaId, resolverCoordenadasAutomaticas]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Com alterações não salvas, "voltar" e fechar a aba não descartam em silêncio. O app troca de tela no
  // evento popstate, então deixamos uma entrada extra no histórico: o primeiro "voltar" cai nela, na mesma
  // tela, e é aí que perguntamos.
  const empurrados = useRef(0);
  useEffect(() => {
    if (!sujo) return;
    liberado.current = false;
    const url = window.location.href;
    window.history.pushState(window.history.state, '', url);
    empurrados.current = 1;
    const aoVoltar = () => {
      if (liberado.current || window.location.href !== url) return;
      window.history.pushState(window.history.state, '', url);
      setSaidaPendente(() => () => {
        liberado.current = true;
        empurrados.current = 0;
        window.history.go(-2);
      });
    };
    const aoFechar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('popstate', aoVoltar);
    window.addEventListener('beforeunload', aoFechar);
    return () => {
      window.removeEventListener('popstate', aoVoltar);
      window.removeEventListener('beforeunload', aoFechar);
    };
  }, [sujo]);

  // Salvou ou descartou na própria tela: tira a entrada extra para o "voltar" seguinte sair de verdade
  useEffect(() => {
    if (sujo || empurrados.current === 0) return;
    empurrados.current = 0;
    window.history.go(-1);
  }, [sujo]);

  const pedirConfirmacao = (acao: () => void) => {
    if (sujo) setSaidaPendente(() => acao);
    else acao();
  };

  const dispararFeedback = (msg: string) => {
    setSucessoMsg(msg);
    setTimeout(() => setSucessoMsg(null), 4000);
  };

  // Ao digitar o CEP, busca automaticamente e popula rua/bairro/cidade e coordenadas
  const handleCepChange = async (valor: string) => {
    let v = valor.replace(/\D/g, '').slice(0, 8);
    if (v.length > 5) {
      v = `${v.slice(0, 5)}-${v.slice(5)}`;
    }
    setCep(v);

    const digitos = v.replace(/\D/g, '');
    if (digitos.length === 8) {
      const carga = cargaAtual.current;
      try {
        setResolvendoLocalizacao(true);
        const res = await api.geocodificarEndereco(digitos);
        if (carga !== cargaAtual.current) return;
        if (res.latitude && res.longitude) {
          setLatGps(res.latitude);
          setLonGps(res.longitude);
        }
        if (res.logradouro && !endereco.trim()) {
          const comp = res.bairro ? ` — ${res.bairro}` : '';
          const cid = res.cidade && res.estado ? ` — ${res.cidade}/${res.estado}` : '';
          setEndereco(`${res.logradouro}, [Número]${comp}${cid}`);
        }
      } catch {} finally {
        setResolvendoLocalizacao(false);
      }
    }
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jaCarregou) return;
    const carga = cargaAtual.current;
    try {
      setSalvando(true);
      setErro(null);

      // Salva dados da oficina
      const enderecoCompleto =
        cep.trim() && !endereco.includes(cep)
          ? `${endereco.trim()} — CEP ${cep.trim()}`
          : endereco.trim();

      await api.salvarConfiguracoesOficina(empresaId, {
        empresa_id: empresaId,
        nome_fantasia: nomeFantasia.trim(),
        razao_social: razaoSocial.trim(),
        cnpj: cnpj.trim(),
        inscricao_estadual: inscricaoEstadual.trim(),
        telefone: telefone.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        endereco: enderecoCompleto,
        chave_pix: chavePix.trim(),
        cor_primaria: corPrimaria,
        cor_secundaria: corSecundaria,
        latitude_gps: latGps,
        longitude_gps: lonGps,
        raio_gps_metros: raioGps,
      });

      // Salva parâmetros de folha e comissões
      await api.salvarParametrosFolha(empresaId, {
        dia_pagamento: diaPagamento,
        dia_adiantamento: diaAdiantamento,
        comissao_global_servico_pct: comissaoServico,
        comissao_global_peca_pct: comissaoPeca,
        paga_hora_extra_padrao: pagaHoraExtra,
        valor_hora_extra_padrao: valorHoraExtra,
      });

      if (carga !== cargaAtual.current) return;
      setPedirBaseline(true);
      dispararFeedback('Dados da oficina atualizados com sucesso!');
    } catch (e) {
      if (carga !== cargaAtual.current) return;
      const err = e as Error;
      setErro(err.message || 'Erro ao salvar alterações.');
    } finally {
      setSalvando(false);
    }
  };

  const temGps = latGps != null && lonGps != null;
  // Ainda sem os dados desta oficina (primeira carga ou troca de oficina): esqueleto, nunca campos de outra
  const semDados = !jaCarregou;
  const mostrarEsqueleto = carregando || semDados;

  const botaoAtualizar = (
    <Button variante="fantasma" icone={RefreshCw} onClick={() => pedirConfirmacao(carregarDados)} disabled={mostrarEsqueleto}>
      Atualizar
    </Button>
  );

  // Falha na primeira carga: sem formulário vazio, que poderia ser salvo por cima dos dados reais
  if (!carregando && semDados && erroCarga) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader titulo="Dados da oficina" />
        <Panel espaco="lg" className="space-y-4">
          <p role="alert" className="flex items-start gap-2 text-sm font-medium text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{erroCarga}</span>
          </p>
          <p className="text-sm text-ink-muted">Nada foi alterado. Confira a conexão e tente de novo.</p>
          <Button icone={RefreshCw} onClick={carregarDados}>
            Tentar novamente
          </Button>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader titulo="Dados da oficina" acoes={botaoAtualizar} />

      {erroCarga && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl bg-danger/15 px-4 py-3 text-sm font-medium text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{erroCarga}</span>
        </p>
      )}

      <form onSubmit={handleSalvar} className="space-y-4">
        <Secao titulo="Identificação" apoio="Nome, documentos e contatos da oficina." carregando={mostrarEsqueleto} campos={7}>
          <div className="sm:col-span-2">
            <Field rotulo="Nome fantasia *">
              <input type="text" required value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} />
            </Field>
          </div>
          <Field rotulo="Razão social">
            <input type="text" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} />
          </Field>
          <Field rotulo="CNPJ">
            <input type="text" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
          </Field>
          <Field rotulo="Inscrição estadual">
            <input type="text" value={inscricaoEstadual} onChange={(e) => setInscricaoEstadual(e.target.value)} />
          </Field>
          <Field rotulo="E-mail">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field rotulo="Telefone fixo">
            <input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </Field>
          <Field rotulo="WhatsApp (com DDD)">
            <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="Ex: 11999998888" />
          </Field>
        </Secao>

        <Secao titulo="Endereço" apoio="Com o CEP, o endereço e o pátio no mapa se preenchem sozinhos." carregando={mostrarEsqueleto} campos={2}>
          <div className="sm:col-span-2 sm:grid sm:grid-cols-3 sm:gap-4">
            <Field rotulo="CEP">
              <input type="text" value={cep} onChange={(e) => handleCepChange(e.target.value)} placeholder="00000-000" maxLength={9} />
            </Field>
            <div className="mt-4 sm:col-span-2 sm:mt-0">
              <Field rotulo="Endereço completo">
                <input
                  type="text"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  onBlur={() => resolverCoordenadasAutomaticas(endereco)}
                  placeholder="Rua, número, bairro, cidade - UF"
                />
              </Field>
            </div>
          </div>
        </Secao>

        <Secao titulo="Pagamento (PIX)" apoio="Como o cliente paga a ordem de serviço." carregando={mostrarEsqueleto} campos={1}>
          <div className="sm:col-span-2">
            <Field rotulo="Chave PIX" dica="Aparece nas ordens de serviço impressas. Pode ser CNPJ, e-mail, celular ou chave aleatória.">
              <input type="text" value={chavePix} onChange={(e) => setChavePix(e.target.value)} placeholder="CNPJ, e-mail, celular ou chave aleatória" />
            </Field>
          </div>
        </Secao>

        <Secao titulo="Ponto (GPS)" apoio="A equipe só registra o ponto dentro do raio do pátio." carregando={mostrarEsqueleto} campos={1}>
          <div className="sm:col-span-2 space-y-4">
            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
              <Field rotulo="Raio de tolerância (metros)">
                <input
                  type="number"
                  min={20}
                  max={1000}
                  value={raioGps}
                  onChange={(e) => setRaioGps(parseInt(e.target.value, 10) || 100)}
                  className="h-10 min-h-11 md:min-h-10 w-full rounded-lg border border-line-strong bg-sunken px-3 text-sm tabular-nums text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                />
              </Field>
              {temGps && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${latGps},${lonGps}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-ink sm:justify-end"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  <span>Ver no Google Maps</span>
                </a>
              )}
            </div>

            <div aria-live="polite" className="text-sm">
              {resolvendoLocalizacao ? (
                <span className="flex items-center gap-2 text-ink-muted">
                  <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Localizando o pátio pelo CEP ou endereço…
                </span>
              ) : temGps ? (
                <span className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Pátio localizado. A equipe só registra ponto a até {raioGps} m daqui.
                </span>
              ) : (
                <span className="text-warning">
                  Preencha o CEP ou o endereço da oficina para localizar o pátio no mapa.
                </span>
              )}
            </div>

            {/* MAPA AUTOMÁTICO DO PÁTIO */}
            {temGps && (
              <div className="relative h-52 w-full overflow-hidden rounded-xl bg-sunken sm:h-64">
                <iframe
                  title="Pátio da oficina"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight={0}
                  marginWidth={0}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${lonGps - 0.003}%2C${latGps - 0.002}%2C${lonGps + 0.003}%2C${latGps + 0.002}&layer=mapnik&marker=${latGps}%2C${lonGps}`}
                  className="h-full w-full"
                />
              </div>
            )}
          </div>
        </Secao>

        <Secao titulo="Folha e comissões" apoio="Regras padrão, usadas quando o colaborador não tem uma taxa própria." carregando={mostrarEsqueleto} campos={6}>
          <Field rotulo="Dia de pagamento da folha" dica="Ex.: dia 5 do mês seguinte">
            <input
              type="number"
              min={1}
              max={31}
              value={diaPagamento}
              onChange={(e) => setDiaPagamento(parseInt(e.target.value, 10) || 5)}
              className="h-10 min-h-11 md:min-h-10 w-full rounded-lg border border-line-strong bg-sunken px-3 text-sm tabular-nums text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </Field>
          <Field rotulo="Dia do vale / adiantamento" dica="Ex.: dia 20 do mês">
            <input
              type="number"
              min={1}
              max={31}
              value={diaAdiantamento}
              onChange={(e) => setDiaAdiantamento(parseInt(e.target.value, 10) || 20)}
              className="h-10 min-h-11 md:min-h-10 w-full rounded-lg border border-line-strong bg-sunken px-3 text-sm tabular-nums text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </Field>
          <Field rotulo="Comissão de mão de obra (%)" dica="Usada quando o mecânico não tem taxa individual">
            <input
              type="number"
              step="any"
              min={0}
              max={100}
              value={comissaoServico}
              onChange={(e) => setComissaoServico(parseFloat(e.target.value) || 0)}
              className="h-10 min-h-11 md:min-h-10 w-full rounded-lg border border-line-strong bg-sunken px-3 text-sm tabular-nums text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </Field>
          <Field rotulo="Comissão de peças (%)">
            <input
              type="number"
              step="any"
              min={0}
              max={100}
              value={comissaoPeca}
              onChange={(e) => setComissaoPeca(parseFloat(e.target.value) || 0)}
              className="h-10 min-h-11 md:min-h-10 w-full rounded-lg border border-line-strong bg-sunken px-3 text-sm tabular-nums text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </Field>
          <Field rotulo="Valor da hora extra (R$/h)">
            <input
              type="number"
              step="any"
              min={0}
              value={valorHoraExtra}
              onChange={(e) => setValorHoraExtra(parseFloat(e.target.value) || 0)}
              className="h-10 min-h-11 md:min-h-10 w-full rounded-lg border border-line-strong bg-sunken px-3 text-sm tabular-nums text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </Field>
          <label className="flex min-h-11 cursor-pointer select-none items-center gap-3 text-sm font-medium text-ink sm:self-end">
            <input
              type="checkbox"
              checked={pagaHoraExtra}
              onChange={(e) => setPagaHoraExtra(e.target.checked)}
              className="h-5 w-5 cursor-pointer rounded accent-brand"
            />
            Pagar hora extra por padrão
          </label>
        </Secao>

        {/* BARRA DE SALVAR: no celular fica logo acima da navegação inferior do app */}
        {!mostrarEsqueleto && (
          <div className="sticky bottom-[var(--barra-inferior-h,calc(60px+max(0.25rem,env(safe-area-inset-bottom))))] z-30 rounded-2xl bg-surface p-3 ring-1 ring-line-strong lg:bottom-4">
            {saidaPendente ? (
              <div role="alert" ref={(el) => el?.scrollIntoView({ block: 'nearest' })} className="space-y-3">
                <p className="text-sm font-medium text-ink">Descartar alterações? O que você digitou será perdido.</p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variante="secundario" onClick={() => setSaidaPendente(null)}>
                    Continuar editando
                  </Button>
                  <Button
                    variante="perigo"
                    onClick={() => {
                      const sair = saidaPendente;
                      setSaidaPendente(null);
                      sair();
                    }}
                  >
                    Descartar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {erro && (
                  <p role="alert" className="flex items-start gap-2 text-sm font-medium text-danger">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{erro}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <div aria-live="polite" className="min-w-0 basis-full text-sm sm:flex-1 sm:basis-0">
                    {sucessoMsg ? (
                      <p role="status" className="flex items-center gap-2 font-medium text-success">
                        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{sucessoMsg}</span>
                      </p>
                    ) : sujo ? (
                      <p className="text-ink-muted">Alterações não salvas</p>
                    ) : null}
                  </div>
                  {sujo && (
                    <Button variante="fantasma" onClick={() => setSaidaPendente(() => carregarDados)} className="flex-1 sm:flex-none">
                      Descartar alterações
                    </Button>
                  )}
                  <Button type="submit" carregando={salvando} className="flex-1 sm:flex-none">
                    {salvando ? 'Salvando…' : 'Salvar alterações'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
