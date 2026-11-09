import React, { useState } from 'react';
import { api } from '../api/client';
import { Star, CheckCircle2, Wrench, Send, Heart } from 'lucide-react';

interface AvaliacaoPublicaOSProps {
  osId: string;
  empresaId?: string;
}

export function AvaliacaoPublicaOS({ osId, empresaId }: AvaliacaoPublicaOSProps) {
  const [nota, setNota] = useState<number>(5);
  const [hoverNota, setHoverNota] = useState<number>(0);
  const [comentario, setComentario] = useState('');
  const [nomeCliente, setNomeCliente] = useState('');
  const [veiculo, setVeiculo] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErroEnvio(null);

    try {
      await api.salvarAvaliacaoOS({
        empresa_id: empresaId || 'empresa-atual',
        os_id: osId,
        cliente_nome: nomeCliente.trim() || 'Cliente Satisfeito',
        veiculo_modelo: veiculo.trim() || 'Veículo do Cliente',
        veiculo_placa: 'AUT-0000',
        nota,
        comentario: comentario.trim() || null,
        data: new Date().toISOString(),
      });
      setEnviado(true);
    } catch {
      setErroEnvio('Não foi possível enviar sua avaliação agora. Tente novamente em instantes.');
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center p-4">
        <div className="bg-[#111827] border-2 border-emerald-500 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-950 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-white">Avaliação Enviada!</h2>
          <p className="text-slate-300 text-sm">
            Muito obrigado pelo seu feedback! Sua opinião é fundamental para aprimorarmos continuamente nosso atendimento e a qualidade do serviço dos nossos mecânicos.
          </p>
          <div className="pt-4 border-t border-[#1E293B]">
            <span className="text-xs text-slate-400 flex items-center justify-center gap-1">
              <span>Feito com carinho pela equipe Autotec Pro</span>
              <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center p-4">
      <div className="bg-[#111827] border-2 border-[#1E3A8A] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#1E3A8A] border-2 border-[#F97316] text-[#F97316] flex items-center justify-center mx-auto">
            <Wrench className="w-7 h-7 stroke-[2.5]" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white">Como foi o serviço no seu carro?</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Sua avaliação ajuda a reconhecer os melhores mecânicos da nossa oficina.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* SELETOR DE 1 A 5 ESTRELAS */}
          <div className="bg-[#0B0F17] border border-[#334155] rounded-2xl p-4 text-center space-y-2">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Sua nota para o serviço e atendimento
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverNota(star)}
                  onMouseLeave={() => setHoverNota(0)}
                  onClick={() => setNota(star)}
                  className="p-1 cursor-pointer transform hover:scale-115 transition-transform"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= (hoverNota || nota)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-600'
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="text-sm font-bold text-amber-300">
              {nota === 5
                ? 'Excelente! Superou expectativas ★★★★★'
                : nota === 4
                ? 'Muito bom! Satisfeito ★★★★☆'
                : nota === 3
                ? 'Regular ★★★☆☆'
                : nota === 2
                ? 'Abaixo do esperado ★★☆☆☆'
                : 'Insatisfeito ★☆☆☆☆'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1">Seu Nome</label>
            <input
              type="text"
              required
              value={nomeCliente}
              onChange={(e) => setNomeCliente(e.target.value)}
              placeholder="Ex: João da Silva"
              className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1">Modelo do seu Veículo</label>
            <input
              type="text"
              value={veiculo}
              onChange={(e) => setVeiculo(e.target.value)}
              placeholder="Ex: Chevrolet Onix 1.4"
              className="w-full min-h-[42px] px-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1">
              Deixe um comentário ou elogio para o mecânico (opcional)
            </label>
            <textarea
              rows={3}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Conte como foi o atendimento, a agilidade ou o diagnóstico do carro…"
              className="w-full p-3 bg-[#0B0F17] border border-[#334155] rounded-xl text-white text-xs sm:text-sm resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full min-h-[48px] rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-[#0B0F17] font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-orange-950/40 disabled:opacity-50"
          >
            <Send className="w-4 h-4 stroke-[2.5]" />
            <span>{enviando ? 'Enviando…' : 'Enviar Avaliação'}</span>
          </button>
          {erroEnvio && (
            <p role="alert" className="text-center text-xs sm:text-sm text-red-400 font-bold">
              {erroEnvio}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

