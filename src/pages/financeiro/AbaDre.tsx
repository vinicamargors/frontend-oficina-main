import type { ReactNode } from 'react';
import { Panel } from '../../components/ui';
import { formatBRL, formatPct, lucroComSinal, rotuloCategoriaFinanceira } from './auxiliares';

type Nivel = 'grupo' | 'item' | 'resultado';

function Linha({
  nivel,
  rotulo,
  apoio,
  valor,
  tom = 'ink',
}: {
  nivel: Nivel;
  rotulo: string;
  apoio?: ReactNode;
  valor: string;
  tom?: 'ink' | 'danger';
}) {
  const cor = tom === 'danger' ? 'text-danger' : 'text-ink';
  return (
    <tr className="border-b border-line last:border-b-0">
      <th
        scope="row"
        className={`py-3 pr-4 text-left align-baseline ${
          nivel === 'item' ? 'pl-5 text-sm font-normal text-ink-muted' : 'text-sm font-semibold text-ink'
        } ${nivel === 'resultado' ? 'text-base' : ''}`}
      >
        {rotulo}
        {apoio && <span className="mt-0.5 block text-xs font-normal tabular-nums text-ink-muted">{apoio}</span>}
      </th>
      <td
        className={`whitespace-nowrap py-3 text-right align-baseline tabular-nums ${cor} ${
          nivel === 'item' ? 'text-sm' : nivel === 'resultado' ? 'text-2xl font-semibold' : 'text-sm font-semibold'
        }`}
      >
        {valor}
      </td>
    </tr>
  );
}

/** DRE vertical: receitas, CMV de peças, lucro bruto, despesas pagas por categoria e lucro líquido. */
export function AbaDre({
  periodo,
  receitaBrutaTotal,
  faturamentoOS,
  receitasAvulsasRecebidas,
  custoPecasOS,
  lucroBrutoOperacional,
  margemBruta,
  despesasPagas,
  despesasPorCategoria,
  lucroLiquidoReal,
  margemLiquida,
}: {
  periodo: string;
  receitaBrutaTotal: number;
  faturamentoOS: number;
  receitasAvulsasRecebidas: number;
  custoPecasOS: number;
  lucroBrutoOperacional: number;
  margemBruta: number;
  despesasPagas: number;
  despesasPorCategoria: Record<string, number>;
  lucroLiquidoReal: number;
  margemLiquida: number;
}) {
  const categorias = Object.entries(despesasPorCategoria);
  return (
    <Panel espaco="nenhum" className="px-5 py-4 lg:px-6">
      <table className="w-full border-collapse">
        <caption className="pb-2 text-left">
          <span className="block text-base font-semibold text-ink">Demonstrativo do resultado (DRE)</span>
          <span className="block text-xs text-ink-muted">{periodo}</span>
        </caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Conta gerencial</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          <Linha nivel="grupo" rotulo="Receita bruta total" apoio="100% da receita" valor={formatBRL(receitaBrutaTotal)} />
          <Linha nivel="item" rotulo="(+) Faturamento de ordens de serviço" apoio="Peças + mão de obra" valor={formatBRL(faturamentoOS)} />
          {receitasAvulsasRecebidas > 0 && (
            <Linha
              nivel="item"
              rotulo="(+) Receitas avulsas recebidas"
              apoio="Aportes, sucata e outras entradas"
              valor={formatBRL(receitasAvulsasRecebidas)}
            />
          )}
          <Linha nivel="grupo" rotulo="(−) Custos variáveis diretos" apoio="CMV: peças das OS" valor={`− ${formatBRL(custoPecasOS)}`} tom="danger" />
          <Linha
            nivel="grupo"
            rotulo="(=) Lucro bruto operacional"
            apoio={`Margem bruta ${formatPct(margemBruta)}`}
            valor={lucroComSinal(lucroBrutoOperacional)}
          />
          <Linha nivel="grupo" rotulo="(−) Despesas operacionais pagas" apoio="Contas pagas no período" valor={`− ${formatBRL(despesasPagas)}`} tom="danger" />
          {categorias.length === 0 ? (
            <tr className="border-b border-line">
              <td colSpan={2} className="py-3 pl-5 text-sm text-ink-muted">
                Nenhuma conta a pagar liquidada no período.
              </td>
            </tr>
          ) : (
            categorias.map(([cat, val]) => (
              <Linha key={cat} nivel="item" rotulo={`(−) ${rotuloCategoriaFinanceira(cat)}`} valor={`− ${formatBRL(val)}`} tom="danger" />
            ))
          )}
          <Linha
            nivel="resultado"
            rotulo="(=) Lucro líquido do período"
            apoio={`Margem líquida ${formatPct(margemLiquida)} · o que sobrou após peças e contas pagas`}
            valor={lucroComSinal(lucroLiquidoReal)}
            tom={lucroLiquidoReal < 0 ? 'danger' : 'ink'}
          />
        </tbody>
      </table>
    </Panel>
  );
}
