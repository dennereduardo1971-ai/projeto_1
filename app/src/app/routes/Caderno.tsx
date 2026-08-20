import { EstadoVazio, TopBar } from '@/ui'

export function Caderno() {
  return (
    <>
      <TopBar titulo="Caderno de erros" />
      <div className="flex flex-col gap-4 py-4">
        <EstadoVazio
          motivo="uso"
          titulo="Sem erros registrados."
          corpo="Ele se preenche sozinho quando você errar uma questão — você não precisa marcar nada. Cada erro entra classificado por tipo: conteúdo desconhecido, leitura apressada, pegadinha semântica ou lei que mudou."
        />
      </div>
    </>
  )
}
