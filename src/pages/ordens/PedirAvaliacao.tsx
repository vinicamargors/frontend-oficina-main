import { useState } from 'react';
import { MessageCircle, Star } from 'lucide-react';
import { api } from '../../api/client';
import { Button, classesBotao } from '../../components/ui';

interface Props {
  empresaId: string;
  osId: string;
  status: string;
  nomeCliente: string;
  telefone: string;
  nomeOficina: string;
  className?: string;
}

/**
 * OS finalizada ou paga: pede ao servidor o link assinado desta OS e, com ele pronto, vira o botão do WhatsApp.
 * Dois passos de propósito: abrir a janela do WhatsApp depois de esperar a rede seria barrado pelo navegador.
 */
export function PedirAvaliacao({ empresaId, osId, status, nomeCliente, telefone, nomeOficina, className = '' }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (status !== 'FINALIZADO' && status !== 'PAGO') return null;

  const gerar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { caminho } = await api.gerarLinkAvaliacao(empresaId, osId);
      const texto = [
        `Olá, *${nomeCliente}*! Obrigado por escolher a *${nomeOficina}*.`,
        'Conta pra gente como foi o serviço no seu carro? Leva menos de 1 minuto:',
        `${window.location.origin}${caminho}`,
      ].join('\n');
      const fone = telefone.replace(/\D/g, '');
      setUrl(`${fone ? `https://wa.me/55${fone}` : 'https://wa.me/'}?text=${encodeURIComponent(texto)}`);
    } catch (e) {
      setErro((e as Error).message || 'Não foi possível gerar o link de avaliação.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className={`${classesBotao('secundario')} ${className}`}>
          <MessageCircle size={16} aria-hidden="true" />
          Enviar avaliação
        </a>
      ) : (
        <Button variante="secundario" icone={Star} carregando={carregando} onClick={gerar} className={className}>
          Pedir avaliação
        </Button>
      )}
      {erro && (
        <p role="alert" className="basis-full text-sm font-medium text-danger">
          {erro}
        </p>
      )}
    </>
  );
}
