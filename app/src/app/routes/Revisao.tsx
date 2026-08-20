import { EstadoVazio, TopBar } from '@/ui'

export function Revisao() {
  return (
    <>
      <TopBar titulo="Revisão" />
      <div className="flex flex-col gap-4 py-4">
        <EstadoVazio
          motivo="uso"
          titulo="Nada vencido hoje."
          corpo="A fila de revisão usa FSRS e entra na Fase 3. Cada erro em questão vira um card automaticamente, e a fila do dia mostra só o que está devido — sem fator de facilidade, sem matemática à vista."
        />
      </div>
    </>
  )
}
