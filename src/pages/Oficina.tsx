import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import {
  Building2,
  Save,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  DollarSign,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface OficinaProps {
  empresaId: string;
}

export function Oficina({ empresaId }: OficinaProps) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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
  const [corPrimaria, setCorPrimaria] = useState('#1e3a8a');
  const [corSecundaria, setCorSecundaria] = useState('#f97316');

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

  // Resolução automática das coordenadas sem intervenção manual do usuário
  const resolverCoordenadasAutomaticas = useCallback(async (termo: string) => {
    if (!termo || !termo.trim()) return;
    try {
      setResolvendoLocalizacao(true);
      const res = await api.geocodificarEndereco(termo);
      if (res && res.latitude && res.longitude) {
        setLatGps(res.latitude);
        setLonGps(res.longitude);
      }
    } catch {} finally {
      setResolvendoLocalizacao(false);
    }
  }, []);

  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);
      const [cfg, paramsFolha] = await Promise.all([
        api.obterConfiguracoesOficina(empresaId),
        api.obterParametrosFolha(empresaId),
      ]);

      setNomeFantasia(cfg.nome_fantasia || '');
      setRazaoSocial(cfg.razao_social || '');
      setCnpj(cfg.cnpj || '');
      setInscricaoEstadual(cfg.inscricao_estadual || '');
      setTelefone(cfg.telefone || '');
      setWhatsapp(cfg.whatsapp || '');
      setEmail(cfg.email || '');
      setEndereco(cfg.endereco || '');
      setChavePix(cfg.chave_pix || '');
      setCorPrimaria(cfg.cor_primaria || '#1e3a8a');
      setCorSecundaria(cfg.cor_secundaria || '#f97316');
      setLatGps(cfg.latitude_gps ?? null);
      setLonGps(cfg.longitude_gps ?? null);
      setRaioGps(cfg.raio_gps_metros || 100);

      // Extrai CEP do endereço caso exista no cadastro
      const cepMatch = (cfg.endereco || '').match(/\b\d{5}-?\d{3}\b/);
      if (cepMatch) {
        setCep(cepMatch[0]);
      }

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
    } catch (e) {
      const err = e as Error;
      setErro(err.message || 'Erro ao carregar dados da oficina.');
    } finally {
      setCarregando(false);
    }
  }, [empresaId, resolverCoordenadasAutomaticas]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

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
      try {
        setResolvendoLocalizacao(true);
        const res = await api.geocodificarEndereco(digitos);
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

      dispararFeedback('Dados da oficina atualizados com sucesso!');
    } catch (e) {
      const err = e as Error;
      setErro(err.message || 'Erro ao salvar alterações.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      <header className="bg-[#111827] border-2 border-[#1E293B] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1E3A8A] border-2 border-[#F97316] text-[#F97316] flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Dados da Oficina &amp; Parâmetros
            </h1>
            <p className="text-xs text-slate-400">
              Cadastros fiscais, chave PIX, localização GPS para ponto eletrônico e regras globais de folha.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={carregarDados}
          disabled={carregando}
          title="Recarregar dados"
          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#0B0F17] hover:bg-[#1E293B] border border-[#334155] text-slate-300 flex items-center gap-2 cursor-pointer disabled:opacity-50 text-xs font-bold"
        >
          <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin text-[#F97316]' : ''}`} />
          <span>Atualizar</span>
        </button>
      </header>

      {/* FEEDBACK DE SUCESSO / ERRO */}
      <div aria-live="polite">
        {sucessoMsg && (
          <div className="p-3 rounded-xl bg-emerald-950 border border-emerald-500 text-emerald-100 flex items-center gap-2 text-xs sm:text-sm font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{sucessoMsg}</span>
          </div>
        )}
        {erro && (
          <div className="p-3 rounded-xl bg-red-950 border border-red-500 text-red-100 flex items-center gap-2 text-xs sm:text-sm font-bold">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{erro}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSalvar} className="space-y-4">
        {/* SEÇÃO 1: DADOS CADASTRAIS & FISCAIS */}
        <section className="bg-[#111827] border-2 border-[#1E293B] rounded-2xl p-4 sm:p-5 space-y-4">
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 border-b border-[#1E293B] pb-2">
            <Building2 className="w-4 h-4 text-[#F97316]" />
            <span>Identificação da Empresa &amp; Contato</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <div>
              <label className="block font-bold text-slate-200 mb-1">Nome Fantasia da Oficina *</label>
              <input
                type="text"
                required
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
                className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-200 mb-1">Razão Social</label>
              <input
                type="text"
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-200 mb-1">CNPJ</label>
              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-200 mb-1">Inscrição Estadual (IE)</label>
              <input
                type="text"
                value={inscricaoEstadual}
                onChange={(e) => setInscricaoEstadual(e.target.value)}
                className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-200 mb-1">WhatsApp da Oficina (com DDD)</label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Ex: 11999998888"
                className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-200 mb-1">Telefone Fixo</label>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-200 mb-1">E-mail Comercial</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-200 mb-1">Chave PIX Oficial (sai nas OS)</label>
              <input
                type="text"
                value={chavePix}
                onChange={(e) => setChavePix(e.target.value)}
                placeholder="CNPJ, E-mail, Celular ou Chave Aleatória"
                className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:col-span-2">
              <div className="sm:col-span-1">
                <label className="block font-bold text-slate-200 mb-1">CEP da Oficina</label>
                <input
                  type="text"
                  value={cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                  className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-200 mb-1">Endereço Completo</label>
                <input
                  type="text"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  onBlur={() => resolverCoordenadasAutomaticas(endereco)}
                  placeholder="Rua, Número, Bairro, Cidade - UF"
                  className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white"
                />
              </div>
            </div>
          </div>
        </section>

        {/* SEÇÃO 2: ÁREA DO PÁTIO DA OFICINA & TRAVA DO PONTO ELETRÔNICO */}
        <section className="bg-[#111827] border-2 border-[#1E293B] rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E293B] pb-2">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>Área do Pátio &amp; Trava do Ponto Eletrônico</span>
              </h2>
              <p className="text-xs text-slate-400">
                Ponto geográfico e raio delimitador para garantir que a equipe só registre ponto dentro do pátio.
              </p>
            </div>

            {latGps != null && lonGps != null && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${latGps},${lonGps}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Ver no Google Maps ↗</span>
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-1">
              <label className="block font-bold text-slate-200 mb-1 text-xs sm:text-sm">
                Raio de Cobertura do Pátio
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={20}
                  max={1000}
                  value={raioGps}
                  onChange={(e) => setRaioGps(parseInt(e.target.value, 10) || 100)}
                  className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono font-bold text-sm"
                />
                <span className="text-xs text-slate-400 font-semibold shrink-0">metros</span>
              </div>
            </div>

            <div className="sm:col-span-2 text-xs text-slate-400 pb-2">
              {resolvendoLocalizacao ? (
                <span className="text-blue-400 flex items-center gap-1.5 animate-pulse font-medium">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Identificando pátio no mapa pelo CEP/endereço...
                </span>
              ) : latGps != null && lonGps != null ? (
                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Pátio localizado e delimitado com raio de {raioGps}m de tolerância.
                </span>
              ) : (
                <span className="text-amber-400">
                  Preencha o CEP ou endereço da oficina para gerar automaticamente o mapa do pátio.
                </span>
              )}
            </div>
          </div>

          {/* MAPA AUTOMÁTICO DO PÁTIO */}
          {latGps != null && lonGps != null && (
            <div className="w-full h-52 sm:h-64 rounded-xl overflow-hidden border border-[#334155] relative bg-[#0B0F17]">
              <iframe
                title="Pátio da Oficina"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                marginHeight={0}
                marginWidth={0}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${lonGps - 0.003}%2C${latGps - 0.002}%2C${lonGps + 0.003}%2C${latGps + 0.002}&layer=mapnik&marker=${latGps}%2C${lonGps}`}
                className="w-full h-full"
              />
            </div>
          )}
        </section>

        {/* SEÇÃO 3: PARÂMETROS DA FOLHA DE PAGAMENTO & REGRAS DE COMISSÃO */}
        <section className="bg-[#111827] border-2 border-[#1E293B] rounded-2xl p-4 sm:p-5 space-y-3.5">
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 border-b border-[#1E293B] pb-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Parâmetros Padrão da Folha &amp; Comissões da Oficina</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
            <div>
              <label className="block font-bold text-slate-200 mb-1">Dia de Pagamento da Folha</label>
              <input
                type="number"
                min={1}
                max={31}
                value={diaPagamento}
                onChange={(e) => setDiaPagamento(parseInt(e.target.value, 10) || 5)}
                className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono text-center font-bold"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">Ex: Dia 5 do mês seguinte</span>
            </div>

            <div>
              <label className="block font-bold text-slate-200 mb-1">Dia do Vale / Adiantamento</label>
              <input
                type="number"
                min={1}
                max={31}
                value={diaAdiantamento}
                onChange={(e) => setDiaAdiantamento(parseInt(e.target.value, 10) || 20)}
                className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono text-center font-bold"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">Ex: Dia 20 do mês</span>
            </div>

            <div>
              <label className="block font-bold text-slate-200 mb-1">Comissão Global Mão de Obra (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={comissaoServico}
                onChange={(e) => setComissaoServico(parseFloat(e.target.value) || 0)}
                className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono text-center font-bold text-emerald-400"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">Usado quando o mecânico não tem taxa individual</span>
            </div>

            <div>
              <label className="block font-bold text-slate-200 mb-1">Comissão Global Peças (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={comissaoPeca}
                onChange={(e) => setComissaoPeca(parseFloat(e.target.value) || 0)}
                className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono text-center font-bold text-emerald-400"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-200 mb-1">Valor Padrão Hora Extra (R$/h)</label>
              <input
                type="number"
                min={0}
                value={valorHoraExtra}
                onChange={(e) => setValorHoraExtra(parseFloat(e.target.value) || 0)}
                className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white font-mono text-center"
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="chk-paga-he"
                checked={pagaHoraExtra}
                onChange={(e) => setPagaHoraExtra(e.target.checked)}
                className="w-4 h-4 rounded text-[#F97316] cursor-pointer"
              />
              <label htmlFor="chk-paga-he" className="font-bold text-slate-200 cursor-pointer select-none">
                Pagar hora extra por padrão
              </label>
            </div>
          </div>
        </section>

        {/* BOTÃO SALVAR ALTERAÇÕES */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={salvando}
            className="min-h-[50px] px-8 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-[#0B0F17] font-black text-base flex items-center gap-2 cursor-pointer shadow-lg shadow-orange-950/40 disabled:opacity-50"
          >
            <Save className="w-5 h-5 stroke-[2.5]" />
            <span>{salvando ? 'Salvando Alterações…' : 'Salvar Dados da Oficina'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
