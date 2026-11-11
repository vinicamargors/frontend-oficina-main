import { useEffect, useState, useCallback, useRef, useId, type DragEvent } from 'react';
import { api } from '../api/client';
import { ItemCritico, StatusOS, UltimaOS } from '../types';
import { AlertOctagon, AlertTriangle, ChevronDown, CircleCheck, FileText, MessageCircle, Move, RefreshCw } from 'lucide-react';
import { Button, PageHeader, Panel, PlateChip, Skeleton, StatusBadge, STATUS_OS, formatarPlaca } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { MenuAcoes, type ItemMenu } from './clientes/MenuAcoes';
import {
  ETAPAS_QUADRO,
  TIPO_ARRASTO,
  anuncioMovida,
  destinosDe,
  moverNoQuadro,
  podeMudarEtapa,
  podeSoltar,
  type EtapaQuadro,
} from './radar/mover';
import { ConfirmarMovimento, type PedidoMovimento } from './radar/ConfirmarMovimento';
import { diasDesde, nivelAtraso, textoDias, textoParada } from './radar/diasNaEtapa';
import { ABERTAS, maisAntigas, type Antigas } from './radar/antigas';
import { MarcaAtraso } from '../components/MarcaAtraso';
import { SeletorPeriodo } from './radar/SeletorPeriodo';
import { diaAnterior, intervaloDoPeriodo, lerPresetSalvo, salvarPreset, type Periodo } from './radar/periodo';

interface DashboardProps {
  empresaId: string;
  onNavigateTab: (tab: string, statusFilter?: StatusOS, osId?: string) => void;
}

const formatBRL = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);

// Etapas que viram coluna do quadro. "Pago / entregue" sai do pátio e fica só como contagem.
const ETAPAS = ETAPAS_QUADRO;
// Some depois da primeira mudança de etapa que dá certo no Radar.
const CHAVE_DICA_ARRASTAR = 'mecanify_radar_dica_arrastar';
// Quantas ordens antigas (fora do período) o aviso lista.
const LIMITE_ANTIGAS = 5;
// Quantos cards cada etapa desenha; o total exato vem da contagem da API.
const LIMITE_POR_ETAPA = 20;

type Etapa = EtapaQuadro;

function lerDicaVista(): boolean {
  try {
    return localStorage.getItem(CHAVE_DICA_ARRASTAR) === '1';
  } catch {
    return false;
  }
}

function lembrarDicaVista(): void {
  try {
    localStorage.setItem(CHAVE_DICA_ARRASTAR, '1');
  } catch {
    /* localStorage indisponível: a dica só volta a aparecer */
  }
}

interface Quadro {
  etapas: Record<StatusOS, Etapa>;
  pagas: number;
  /** Ordens abertas com `data_abertura` anterior ao início do período (as mais antigas primeiro). */
  antigas: Antigas;
  itensCriticos: ItemCritico[];
  criticosCount: number;
}

/** O que o quadro precisa para mover cards de etapa (arrastar no desktop, menu "…" em todas as larguras). */
interface ControleMover {
  /** O cargo pode trocar a etapa (mesma regra da tela da Ordem). Sem isso: sem arrasto, sem menu. */
  pode: boolean;
  /** Uma gravação em andamento: nada mais arrasta e os itens "Mover para" ficam inativos. */
  gravando: boolean;
  /** Id do elemento com a dica para leitor de tela (`aria-describedby` do card). */
  idDica: string;
  /** Ordem sendo arrastada agora e a coluna sob o ponteiro. */
  arrastandoId: string | null;
  sobre: StatusOS | null;
  podeSoltarEm: (st: StatusOS) => boolean;
  aoIniciarArrasto: (os: UltimaOS, de: StatusOS, e: DragEvent<HTMLElement>) => void;
  aoFimArrasto: () => void;
  aoSobre: (st: StatusOS | null) => void;
  aoSoltar: (st: StatusOS) => void;
  aoPedir: (os: UltimaOS, de: StatusOS, para: StatusOS) => void;
}

/** Menu "…" do card: "Abrir ordem" e "Mover para" cada outra coluna. Fica num `data-os-acoes` para o foco achar o card movido. */
function AcoesCard({ os, st, onAbrir, mover }: { os: UltimaOS; st: StatusOS; onAbrir: () => void; mover: ControleMover }) {
  const placa = formatarPlaca(os.veiculos?.placa || 'SEM-PLACA');
  const itens: ItemMenu[] = [
    { rotulo: 'Abrir ordem', icone: FileText, aoClicar: onAbrir },
    ...destinosDe(st).map((para) => ({
      rotulo: `Mover para ${STATUS_OS[para].rotulo}`,
      icone: STATUS_OS[para].icone,
      aoClicar: () => mover.aoPedir(os, st, para),
      desabilitado: mover.gravando,
    })),
  ];
  return (
    <div data-os-acoes={os.id} draggable={false}>
      <MenuAcoes rotulo={`Ações da ordem ${placa}`} itens={itens} />
    </div>
  );
}

function LinkWhatsApp({ fone, clienteNome, className }: { fone: string; clienteNome: string; className: string }) {
  return (
    <a
      href={`https://wa.me/55${fone}`}
      target="_blank"
      rel="noreferrer"
      draggable={false}
      aria-label={`Conversar no WhatsApp com ${clienteNome}`}
      title="WhatsApp"
      className={`flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${className}`}
    >
      <MessageCircle size={20} strokeWidth={1.5} aria-hidden="true" />
    </a>
  );
}

function CardOS({ os, onAbrir, mover }: { os: UltimaOS; onAbrir: () => void; mover: ControleMover }) {
  const st = (os.status as StatusOS) || 'ORCAMENTO';
  const placa = os.veiculos?.placa || 'SEM-PLACA';
  const modelo = os.veiculos?.modelo || 'Veículo';
  const clienteNome = os.clientes?.nome || 'Cliente';
  const foneLimpo = (os.clientes?.telefone || '').replace(/\D/g, '');
  const dias = diasDesde(os.data_abertura);
  const nivel = nivelAtraso(st, dias);
  const arrastando = mover.arrastandoId === os.id;

  return (
    // O `li` é o que arrasta; dentro dele o card continua um botão que abre a OS e os ícones são irmãos
    <li
      data-os-id={os.id}
      data-arrastando={arrastando || undefined}
      draggable={mover.pode ? !mover.gravando : undefined}
      onDragStart={mover.pode ? (e) => mover.aoIniciarArrasto(os, st, e) : undefined}
      onDragEnd={mover.pode ? mover.aoFimArrasto : undefined}
      className={`relative transition-opacity motion-reduce:transition-none ${arrastando ? 'opacity-50' : ''}`}
    >
      <Panel espaco="nenhum">
        <button
          type="button"
          onClick={onAbrir}
          aria-describedby={mover.pode ? mover.idDica : undefined}
          className={`block w-full rounded-2xl p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            mover.pode && !mover.gravando ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
          }`}
        >
          <span className={`flex flex-wrap items-center justify-between gap-2 ${mover.pode ? 'pr-10' : ''}`}>
            <PlateChip placa={placa} />
            {nivel !== 'ok' && <MarcaAtraso nivel={nivel} />}
          </span>
          <span className="mt-3 block truncate text-sm font-medium text-ink">{modelo}</span>
          <span className="block truncate text-sm text-ink-muted">{clienteNome}</span>
          <span className="mt-3 block pr-11">
            <span className="block text-base font-semibold tabular-nums text-ink">{formatBRL(os.total_geral)}</span>
            <span className="block text-xs text-ink-muted">{textoDias(dias)}</span>
          </span>
        </button>
        {mover.pode && (
          <div className="absolute right-1 top-1">
            <AcoesCard os={os} st={st} onAbrir={onAbrir} mover={mover} />
          </div>
        )}
        {foneLimpo && <LinkWhatsApp fone={foneLimpo} clienteNome={clienteNome} className="absolute bottom-1 right-1" />}
      </Panel>
    </li>
  );
}

function LinhaOS({ os, onAbrir, mover }: { os: UltimaOS; onAbrir: () => void; mover: ControleMover }) {
  const st = (os.status as StatusOS) || 'ORCAMENTO';
  const placa = os.veiculos?.placa || 'SEM-PLACA';
  const modelo = os.veiculos?.modelo || 'Veículo';
  const clienteNome = os.clientes?.nome || 'Cliente';
  const foneLimpo = (os.clientes?.telefone || '').replace(/\D/g, '');
  const dias = diasDesde(os.data_abertura);
  const nivel = nivelAtraso(st, dias);
  const controles = (foneLimpo ? 1 : 0) + (mover.pode ? 1 : 0);

  return (
    // Celular e tablet: sem arrasto (não funciona no toque); mudar de etapa é pelo "…"
    <li data-os-id={os.id} className="group/linha relative">
      <button
        type="button"
        onClick={onAbrir}
        aria-describedby={mover.pode ? mover.idDica : undefined}
        className={`flex min-h-16 w-full cursor-pointer items-center gap-3 py-2.5 pl-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand group-first/linha:rounded-t-2xl group-last/linha:rounded-b-2xl ${
          controles === 2 ? 'pr-[6.25rem]' : controles === 1 ? 'pr-14' : 'pr-4'
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <PlateChip placa={placa} />
            <span className="truncate text-sm font-medium text-ink">{modelo}</span>
          </span>
          <span className="mt-1 flex gap-1 text-xs text-ink-muted">
            <span className="truncate">{clienteNome}</span>
            <span className="shrink-0">· {textoDias(dias)}</span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-semibold tabular-nums text-ink">{formatBRL(os.total_geral)}</span>
          {nivel !== 'ok' && <MarcaAtraso nivel={nivel} />}
        </span>
      </button>
      {controles > 0 && (
        // Sem `transform` aqui: ele criaria um contexto de empilhamento e a linha de baixo cobriria o menu aberto
        <div className="absolute inset-y-0 right-1 flex items-center">
          {foneLimpo && <LinkWhatsApp fone={foneLimpo} clienteNome={clienteNome} className="" />}
          {mover.pode && <AcoesCard os={os} st={st} onAbrir={onAbrir} mover={mover} />}
        </div>
      )}
    </li>
  );
}

function EtapaQuadro({
  st,
  etapa,
  onNavigateTab,
  mover,
  compacto = false,
}: {
  st: StatusOS;
  etapa: Etapa;
  onNavigateTab: DashboardProps['onNavigateTab'];
  mover: ControleMover;
  compacto?: boolean;
}) {
  const rotulo = STATUS_OS[st].rotulo;
  const cards = etapa.items;
  const total = Math.max(etapa.total, cards.length);
  const abrir = (id: string) => onNavigateTab('os', undefined, id);
  // Só o quadro do desktop recebe cards soltos; a coluna de origem nunca acende
  const solta = !compacto && mover.pode;
  const alvo = solta && mover.arrastandoId && mover.podeSoltarEm(st) ? (mover.sobre === st ? 'sobre' : 'valido') : undefined;

  const aceitar = (e: DragEvent<HTMLElement>) => {
    if (!solta || !e.dataTransfer.types.includes(TIPO_ARRASTO) || !mover.podeSoltarEm(st)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (mover.sobre !== st) mover.aoSobre(st);
  };

  return (
    <section
      aria-label={rotulo}
      data-etapa={compacto ? undefined : st}
      data-alvo={alvo}
      onDragEnter={solta ? aceitar : undefined}
      onDragOver={solta ? aceitar : undefined}
      onDragLeave={
        solta
          ? (e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null) && mover.sobre === st) mover.aoSobre(null);
            }
          : undefined
      }
      onDrop={
        solta
          ? (e) => {
              if (!e.dataTransfer.types.includes(TIPO_ARRASTO) || !mover.podeSoltarEm(st)) return;
              e.preventDefault();
              mover.aoSoltar(st);
            }
          : undefined
      }
      className={
        compacto
          ? 'min-w-0'
          : `min-w-0 rounded-2xl p-2 transition-colors motion-reduce:transition-none ${
              alvo === 'sobre' ? 'bg-brand/20' : alvo === 'valido' ? 'bg-brand/10' : ''
            }`
      }
    >
      <div className={`flex items-center justify-between gap-2 px-1 ${total === 0 && compacto ? '' : 'mb-3'}`}>
        <StatusBadge status={st} />
        <span data-testid="contagem-etapa" className="text-sm font-medium tabular-nums text-ink-muted">
          {total === 0 && compacto ? 'Nenhum veículo' : total}
        </span>
      </div>
      {total === 0 ? (
        !compacto &&
        (mover.pode ? (
          // Coluna vazia ainda é um lugar visível para soltar
          <div
            data-testid="area-soltar"
            className="flex min-h-28 items-center justify-center rounded-2xl bg-muted/60 px-3 text-sm text-ink-muted"
          >
            Nenhum veículo
          </div>
        ) : (
          <p className="px-1 text-sm text-ink-muted">Nenhum veículo</p>
        ))
      ) : (
        <>
          {cards.length > 0 &&
            (compacto ? (
              <Panel espaco="nenhum">
                <ul className="divide-y divide-line">
                  {cards.map((os) => (
                    <LinhaOS key={os.id} os={os} onAbrir={() => abrir(os.id)} mover={mover} />
                  ))}
                </ul>
              </Panel>
            ) : (
              <ul className="space-y-3">
                {cards.map((os) => (
                  <CardOS key={os.id} os={os} onAbrir={() => abrir(os.id)} mover={mover} />
                ))}
              </ul>
            ))}
          {total > cards.length && (
            <div className="mt-2">
              {cards.length > 0 && (
                <p className="px-3 text-xs text-ink-muted">
                  {cards.length === 1 ? 'Mostrando a mais recente' : `Mostrando as ${cards.length} mais recentes`}
                </p>
              )}
              <Button variante="fantasma" tamanho="sm" onClick={() => onNavigateTab('os', st)}>
                {cards.length === 0
                  ? `${total} ${total === 1 ? 'veículo' : 'veículos'}, ver todas`
                  : `Ver todas (${total})`}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function LinhaAntiga({ os, onAbrir }: { os: UltimaOS; onAbrir: () => void }) {
  const st = (os.status as StatusOS) || 'ORCAMENTO';
  const placa = os.veiculos?.placa || 'SEM-PLACA';
  const modelo = os.veiculos?.modelo || 'Veículo';
  const clienteNome = os.clientes?.nome || 'Cliente';
  const dias = diasDesde(os.data_abertura);
  const nivel = nivelAtraso(st, dias);

  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        className="flex min-h-16 w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <PlateChip placa={placa} />
            <span className="truncate text-sm font-medium text-ink">{modelo}</span>
          </span>
          <span className="mt-1 flex gap-1 text-xs text-ink-muted">
            <span className="truncate">{clienteNome}</span>
            <span className="shrink-0">· {STATUS_OS[st].rotulo}</span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs tabular-nums text-ink-muted">{textoParada(dias)}</span>
          {nivel !== 'ok' && <MarcaAtraso nivel={nivel} />}
        </span>
      </button>
    </li>
  );
}

/** Rede de segurança: as ordens abertas que o período escondeu. Aberta por padrão; o título recolhe. */
function AvisoAntigas({
  antigas,
  aoAbrir,
  aoVerTodas,
}: {
  antigas: Antigas;
  aoAbrir: (id: string) => void;
  aoVerTodas: () => void;
}) {
  const [aberto, setAberto] = useState(true);
  const idLista = useId();
  return (
    <section aria-label="Ordens abertas mais antigas" className="mt-6">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={idLista}
        onClick={() => setAberto((v) => !v)}
        className="-ml-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-sm text-ink-muted transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <ChevronDown
          size={16}
          className={`shrink-0 transition-transform motion-reduce:transition-none ${aberto ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
        {antigas.total === 1
          ? '1 ordem aberta mais antiga fica fora do período'
          : `${antigas.total} ordens abertas mais antigas ficam fora do período`}
      </button>
      {aberto && (
        <div id={idLista} className="mt-2">
          <Panel espaco="nenhum" className="overflow-hidden">
            <ul className="divide-y divide-line">
              {antigas.items.map((os) => (
                <LinhaAntiga key={os.id} os={os} onAbrir={() => aoAbrir(os.id)} />
              ))}
            </ul>
          </Panel>
          {antigas.total > antigas.items.length && (
            <Button variante="fantasma" tamanho="sm" className="mt-1" onClick={aoVerTodas}>
              Ver todas ({antigas.total})
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function Numero({
  rotulo,
  valor,
  destaque = false,
  onClick,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 cursor-pointer rounded-2xl px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span className="block text-sm text-ink-muted">{rotulo}</span>
      <span
        className={`block text-3xl font-semibold tabular-nums ${destaque ? 'text-danger' : 'text-ink'}`}
      >
        {valor}
      </span>
    </button>
  );
}

export function DashboardOperacional({ empresaId, onNavigateTab }: DashboardProps) {
  const [periodo, setPeriodo] = useState<Periodo>(() => ({ tipo: lerPresetSalvo() }));
  const [quadro, setQuadro] = useState<Quadro | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seqRadar = useRef(0);

  // Mover card de etapa (arrastar no desktop, menu "…" em todas as larguras); sempre com confirmação
  const { user } = useAuth();
  const podeMover = podeMudarEtapa(user?.cargo);
  const idDica = useId();
  const [arrasto, setArrasto] = useState<{ osId: string; de: StatusOS } | null>(null);
  // O estado da tela atrasa um quadro em relação aos eventos de arrasto; a ref responde na hora
  const arrastoRef = useRef<{ osId: string; placa: string; de: StatusOS } | null>(null);
  const [sobre, setSobre] = useState<StatusOS | null>(null);
  const [pedido, setPedido] = useState<PedidoMovimento | null>(null);
  const [gravando, setGravando] = useState(false);
  const gravandoRef = useRef(false);
  const [erroMover, setErroMover] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const [dicaVista, setDicaVista] = useState(lerDicaVista);
  const focarAcoesDe = useRef<string | null>(null);

  const carregarRadar = useCallback(async () => {
    if (!empresaId) return;
    const minha = ++seqRadar.current;
    setLoading(true);
    setError(null);
    setErroMover(null);
    try {
      const { inicio, fim } = intervaloDoPeriodo(periodo);
      const doPeriodo = { empresaId, dataInicio: inicio, dataFim: fim, ordenacao: 'data_desc' as const };
      // As mais antigas entre as abertas anteriores ao período: falha aqui só esconde o aviso, não derruba o quadro.
      const antesDoPeriodo = { empresaId, dataFim: diaAnterior(inicio), ordenacao: 'data_asc' as const, limit: LIMITE_ANTIGAS };
      const [dash, pagas, ...resto] = await Promise.all([
        api.getDashboardOperacional(empresaId),
        api.listarOS({ ...doPeriodo, status: 'PAGO', limit: 1 }),
        ...ETAPAS.map((status) => api.listarOS({ ...doPeriodo, status, limit: LIMITE_POR_ETAPA })),
        ...ABERTAS.map((status) => api.listarOS({ ...antesDoPeriodo, status }).catch(() => null)),
      ]);
      if (minha !== seqRadar.current) return;
      const respostasEtapas = resto.slice(0, ETAPAS.length);
      const respostasAntigas = resto.slice(ETAPAS.length);
      const etapas = { PAGO: { items: [], total: 0 } } as unknown as Record<StatusOS, Etapa>;
      ETAPAS.forEach((st, i) => {
        etapas[st] = { items: respostasEtapas[i]?.items ?? [], total: respostasEtapas[i]?.total ?? 0 };
      });
      setQuadro({
        etapas,
        pagas: pagas.total ?? 0,
        antigas: maisAntigas(respostasAntigas, LIMITE_ANTIGAS),
        itensCriticos: dash.itens_criticos || [],
        criticosCount: dash.estoque_critico_count || 0,
      });
    } catch (err: unknown) {
      if (minha !== seqRadar.current) return;
      // O detalhe técnico fica só no console; a tela mostra uma frase que o dono entende.
      console.error('Radar do pátio: falha ao carregar', err);
      setError('Não foi possível carregar o Radar. Tente novamente.');
    } finally {
      if (minha === seqRadar.current) setLoading(false);
    }
  }, [empresaId, periodo]);

  useEffect(() => {
    carregarRadar();
  }, [carregarRadar]);

  const fimArrasto = () => {
    arrastoRef.current = null;
    setArrasto(null);
    setSobre(null);
  };

  const pedirMovimento = (os: UltimaOS, de: StatusOS, para: StatusOS, viaMenu: boolean) => {
    if (!podeMover || gravandoRef.current || !podeSoltar(de, para)) return;
    setErroMover(null);
    setPedido({ osId: os.id, placa: os.veiculos?.placa || 'SEM-PLACA', de, para, viaMenu });
  };

  const controleMover: ControleMover = {
    pode: podeMover,
    gravando,
    idDica,
    arrastandoId: arrasto?.osId ?? null,
    sobre,
    podeSoltarEm: (st) => !!arrastoRef.current && podeSoltar(arrastoRef.current.de, st),
    aoIniciarArrasto: (os, de, e) => {
      if (gravandoRef.current) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData(TIPO_ARRASTO, os.id);
      e.dataTransfer.effectAllowed = 'move';
      arrastoRef.current = { osId: os.id, placa: os.veiculos?.placa || 'SEM-PLACA', de };
      setArrasto({ osId: os.id, de });
    },
    aoFimArrasto: fimArrasto,
    aoSobre: setSobre,
    aoSoltar: (para) => {
      const a = arrastoRef.current;
      fimArrasto();
      if (!a || !quadro) return;
      const os = quadro.etapas[a.de]?.items.find((o) => o.id === a.osId);
      if (os) pedirMovimento(os, a.de, para, false);
    },
    aoPedir: (os, de, para) => pedirMovimento(os, de, para, true),
  };

  // Só depois de Confirmar: move na hora (otimista), grava, e recarrega o quadro; se falhar, desfaz e avisa
  const confirmarMovimento = async () => {
    const p = pedido;
    if (!p || !quadro || gravandoRef.current) return;
    gravandoRef.current = true;
    setGravando(true);
    setErroMover(null);
    setAnuncio('');
    const anterior = quadro.etapas;
    const seq = seqRadar.current;
    setQuadro((q) => (q ? { ...q, etapas: moverNoQuadro(q.etapas, p.osId, p.de, p.para) } : q));
    try {
      await api.atualizarOS(empresaId, p.osId, { status: p.para });
      setAnuncio(anuncioMovida(p.placa, p.para));
      lembrarDicaVista();
      setDicaVista(true);
      if (p.viaMenu) focarAcoesDe.current = p.osId;
      setPedido(null);
      carregarRadar();
    } catch (err: unknown) {
      // O detalhe técnico fica só no console; a tela diz o que aconteceu com a ordem
      console.error('Radar do pátio: falha ao mudar a etapa', err);
      // Só desfaz se nenhum carregamento novo trocou o quadro nesse meio-tempo (aí ele já é a verdade)
      if (seq === seqRadar.current) setQuadro((q) => (q ? { ...q, etapas: anterior } : q));
      setErroMover(
        `Não foi possível mover ${formatarPlaca(p.placa)} para ${STATUS_OS[p.para].rotulo}. A ordem continua em ${STATUS_OS[p.de].rotulo}. Tente novamente.`
      );
      setPedido(null);
    } finally {
      gravandoRef.current = false;
      setGravando(false);
    }
  };

  // Mudança feita pelo menu: o foco segue o card até a etapa nova (o card antigo saiu da tela com o foco)
  useEffect(() => {
    const id = focarAcoesDe.current;
    if (!id || pedido) return;
    const alvo = Array.from(document.querySelectorAll<HTMLElement>(`[data-os-acoes="${id}"] button[aria-haspopup]`)).find(
      (el) => el.offsetParent !== null
    );
    if (!alvo) return;
    if (document.activeElement !== alvo) alvo.focus();
    if (!loading) focarAcoesDe.current = null;
  }, [quadro, pedido, loading]);

  const escolherPeriodo = (p: Periodo) => {
    // Escolher de novo o que já está valendo não refaz as leituras
    if (p.tipo === periodo.tipo && (p.tipo !== 'custom' || (periodo.tipo === 'custom' && p.de === periodo.de && p.ate === periodo.ate))) return;
    if (p.tipo !== 'custom') salvarPreset(p.tipo);
    setPeriodo(p);
  };

  const patioVazio = !!quadro && ETAPAS.every((st) => quadro.etapas[st].total === 0);
  const novaOS = () => onNavigateTab('os', undefined, 'NOVA_OS');

  const cabecalho = (
    <PageHeader
      titulo="Radar do pátio"
      acoesClasse="w-full flex-nowrap md:w-auto"
      acoes={
        <>
          <SeletorPeriodo periodo={periodo} aoEscolher={escolherPeriodo} className="mr-auto" />
          <Button
            variante="fantasma"
            aria-label="Atualizar"
            title="Atualizar"
            className="w-11 shrink-0 px-0 md:w-auto md:px-4"
            onClick={carregarRadar}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />
            <span className="hidden md:inline">Atualizar</span>
          </Button>
          {quadro && !error && (
            <Button className="shrink-0" aria-label="Nova ordem de serviço" onClick={novaOS}>
              <span className="sm:hidden">Nova OS</span>
              <span className="hidden sm:inline">Nova ordem de serviço</span>
            </Button>
          )}
        </>
      }
    />
  );

  if (error) {
    return (
      <div>
        {cabecalho}
        <Panel espaco="lg" className="space-y-5">
          <div className="flex items-start gap-4">
            <AlertOctagon className="mt-1 h-6 w-6 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-ink text-balance">
                Falha ao comunicar com o servidor da oficina
              </h2>
              <p className="mt-1 text-sm text-ink-muted text-pretty">{error}</p>
            </div>
          </div>
          <Button onClick={carregarRadar} icone={RefreshCw}>
            Tentar novamente
          </Button>
        </Panel>
      </div>
    );
  }

  if (!quadro) {
    return (
      <div aria-busy="true" aria-label="Carregando Radar do pátio">
        {cabecalho}
        <div data-testid="radar-conteudo" aria-busy="true" className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <Panel key={n} className="h-56">
              <Skeleton linhas={3} />
            </Panel>
          ))}
        </div>
      </div>
    );
  }

  const veiculosNoPatio =
    quadro.etapas.AGUARDANDO_PECA.total + quadro.etapas.EXECUCAO.total + quadro.etapas.FINALIZADO.total;
  const orcamentos = quadro.etapas.ORCAMENTO.total;
  const { antigas, pagas, itensCriticos, criticosCount } = quadro;

  return (
    <div>
      {cabecalho}

      {/* Fora da área que fica aria-busy no recarregamento, para o leitor de tela não segurar o aviso */}
      <p role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </p>
      {podeMover && (
        <span id={idDica} className="sr-only">
          Use o menu … para mover para outra etapa
        </span>
      )}
      {erroMover && (
        <p role="alert" className="mb-4 flex items-center gap-2 rounded-xl bg-danger/15 px-4 py-3 text-sm font-medium text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{erroMover}</span>
        </p>
      )}

      {/* Durante a troca de período o quadro anterior fica na tela, esmaecido, em vez de piscar vazio */}
      <div
        data-testid="radar-conteudo"
        aria-busy={loading}
        className={`transition-opacity ${loading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <div role="group" aria-label="Resumo do pátio" className="mb-8 grid grid-cols-3 gap-1 md:flex md:gap-8">
          <Numero rotulo="Veículos no pátio" valor={veiculosNoPatio} onClick={() => onNavigateTab('os')} />
          <Numero rotulo="Orçamentos abertos" valor={orcamentos} onClick={() => onNavigateTab('os', 'ORCAMENTO')} />
          <Numero
            rotulo="Estoque crítico"
            valor={criticosCount}
            destaque={criticosCount > 0}
            onClick={() => onNavigateTab('estoque')}
          />
        </div>

        {patioVazio ? (
          <Panel espaco="lg" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-ink text-balance">Nenhuma ordem no período</h2>
              <p className="mt-1 text-sm text-ink-muted text-pretty">
                {periodo.tipo === '30'
                  ? 'Abra uma ordem de serviço e ela aparece aqui, na etapa em que estiver.'
                  : 'Escolha um período maior para ver mais.'}
              </p>
            </div>
            {periodo.tipo !== '30' && (
              <Button variante="secundario" onClick={() => escolherPeriodo({ tipo: '30' })}>
                Ver 30 dias
              </Button>
            )}
          </Panel>
        ) : (
          <>
            {podeMover && !dicaVista && (
              <p className="mb-2 hidden items-center gap-1.5 text-xs text-ink-muted lg:flex">
                <Move size={14} aria-hidden="true" />
                Arraste um card para outra etapa para mudar o status
              </p>
            )}
            {/* Desktop: quadro em 4 colunas com cards. Cada coluna tem p-2 (área de soltar), daí o -mx-2 e sem gap */}
            <div data-testid="quadro-patio" className="-mx-2 hidden lg:grid lg:grid-cols-4">
              {ETAPAS.map((st) => (
                <EtapaQuadro key={st} st={st} etapa={quadro.etapas[st]} onNavigateTab={onNavigateTab} mover={controleMover} />
              ))}
            </div>
            {/* Celular e tablet: todas as etapas empilhadas, linhas compactas, sem rolagem lateral */}
            <div data-testid="patio-lista" className="space-y-6 lg:hidden">
              {ETAPAS.map((st) => (
                <EtapaQuadro key={st} st={st} etapa={quadro.etapas[st]} onNavigateTab={onNavigateTab} mover={controleMover} compacto />
              ))}
            </div>
          </>
        )}

        {antigas.total > 0 && (
          <AvisoAntigas antigas={antigas} aoAbrir={(id) => onNavigateTab('os', undefined, id)} aoVerTodas={() => onNavigateTab('os', antigas.status)} />
        )}

        {pagas > 0 && (
          <p className="mt-2">
            <Button variante="fantasma" tamanho="sm" onClick={() => onNavigateTab('os', 'PAGO')}>
              {pagas}{' '}
              {pagas === 1 ? 'ordem aberta no período já paga e entregue' : 'ordens abertas no período já pagas e entregues'}
            </Button>
          </p>
        )}

        <section aria-label="Reposição de peças" className="mt-8">
          {itensCriticos.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <CircleCheck size={16} className="text-success" aria-hidden="true" />
              Estoque em dia
            </p>
          ) : (
            <Panel espaco="lg">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-ink text-balance">Reposição de peças</h2>
                <Button variante="fantasma" tamanho="sm" onClick={() => onNavigateTab('estoque')}>
                  Abrir estoque
                </Button>
              </div>
              <ul>
                {itensCriticos.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">{item.nome}</div>
                      <div className="text-xs text-ink-muted">
                        {item.categoria} (mín. {item.minimo_alerta})
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-danger">
                      {item.quantidade} un.
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </section>
      </div>

      <ConfirmarMovimento pedido={pedido} gravando={gravando} aoConfirmar={confirmarMovimento} aoCancelar={() => setPedido(null)} />
    </div>
  );
}
