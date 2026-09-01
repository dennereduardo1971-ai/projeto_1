import { useEffect, useRef, useState, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/dados/db'
import type { Disciplina } from '@/dados/tipos'
import { ROTULO_NIVEL, type NivelDominio } from '@/features/dominio/mastery'
import { MAX_NOME, RITMOS, nomeValido, obterPerfil, salvarPerfil } from '@/features/perfil/perfil'
import type { Ritmo } from '@/features/perfil/tipos'
import { cn } from '@/lib/cn'
import { Button, Card, Field, Input, InlineAlert, Select, TopBar } from '@/ui'

/**
 * Onboarding sem login. Três passos, um de cada vez: nome, ritmo, domínio
 * inicial por disciplina. Fora do `AppShell` (sem barra de navegação) porque
 * aqui não há "fila do dia" ainda — é o que constrói a fila.
 *
 * Com perfil já salvo, esta mesma tela vira edição: pré-preenche tudo e o
 * botão final passa de "Começar" para "Salvar". `AppShell` decide quando
 * redirecionar para cá; esta tela não sabe por que foi aberta, só se já
 * existe perfil ou não.
 */

const NIVEIS: NivelDominio[] = ['inicial', 'desenvolvimento', 'intermediario', 'bom', 'dominado']

type Passo = 1 | 2 | 3

export function Bemvindo() {
  const navegar = useNavigate()
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [passo, setPasso] = useState<Passo>(1)

  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([])
  const [nome, setNome] = useState('')
  const [ritmo, setRitmo] = useState<Ritmo>('moderado')
  const [dataProva, setDataProva] = useState<string | null>(null)
  const [nivelInicial, setNivelInicial] = useState<Record<string, NivelDominio>>({})

  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)

  const tituloRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    void (async () => {
      const [ds, perfil] = await Promise.all([
        db.disciplina.orderBy('ordem').toArray(),
        obterPerfil(),
      ])
      setDisciplinas(ds)
      if (perfil) {
        setEditando(true)
        setNome(perfil.nome)
        setRitmo(perfil.ritmo)
        setDataProva(perfil.data_prova)
        setNivelInicial(perfil.nivel_inicial)
      } else {
        const padrao: Record<string, NivelDominio> = {}
        for (const d of ds) padrao[d.slug] = 'inicial'
        setNivelInicial(padrao)
      }
      setCarregando(false)
    })()
  }, [])

  // Move o foco para o título do passo — na primeira revelação (quando
  // `carregando` vira `false`) e em toda troca de passo depois disso.
  useEffect(() => {
    if (carregando) return
    tituloRef.current?.focus()
  }, [passo, carregando])

  if (carregando) return null

  const nomeOk = nomeValido(nome)
  const motivoDesabilitado = passo === 1 && !nomeOk ? 'Digite um nome para continuar.' : null

  const aoSubmeter = (e: React.FormEvent) => {
    e.preventDefault()
    if (passo < 3) {
      if (!motivoDesabilitado) setPasso((p) => (p + 1) as Passo)
      return
    }
    void salvar()
  }

  const salvar = async () => {
    setSalvando(true)
    setErroSalvar(null)
    try {
      await salvarPerfil({ nome, ritmo, data_prova: dataProva, nivel_inicial: nivelInicial })
      navegar('/', { replace: true })
    } catch {
      setErroSalvar('Não deu para salvar agora. Tente de novo.')
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-dvh bg-bg">
      <TopBar titulo={editando ? 'Editar perfil' : 'Configurar o Rito'} />
      <main className="mx-auto max-w-3xl px-4 py-4">
        <form className="flex flex-col gap-5" onSubmit={aoSubmeter}>
          <div className="flex flex-col gap-2">
            <p className="text-caption text-subtle">Passo {passo} de 3</p>
            <div className="flex gap-1" aria-hidden="true">
              {([1, 2, 3] as const).map((n) => (
                <div
                  key={n}
                  className={cn('h-1 flex-1 rounded-full', n <= passo ? 'bg-primary' : 'bg-sunken')}
                />
              ))}
            </div>
          </div>

          {passo === 1 && <PassoNome tituloRef={tituloRef} nome={nome} onChange={setNome} />}
          {passo === 2 && (
            <PassoRitmo
              tituloRef={tituloRef}
              ritmo={ritmo}
              onChangeRitmo={setRitmo}
              dataProva={dataProva}
              onChangeData={setDataProva}
            />
          )}
          {passo === 3 && (
            <PassoDominio
              tituloRef={tituloRef}
              disciplinas={disciplinas}
              nivelInicial={nivelInicial}
              onChange={setNivelInicial}
            />
          )}

          {erroSalvar && <InlineAlert tom="err">{erroSalvar}</InlineAlert>}

          <div className="flex items-start justify-between gap-3 pt-2">
            {passo > 1 ? (
              <Button type="button" variante="outline" onClick={() => setPasso((p) => (p - 1) as Passo)} disabled={salvando}>
                Voltar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col items-end gap-1">
              <Button
                type="submit"
                disabled={passo === 3 ? salvando : !!motivoDesabilitado}
                aria-describedby={motivoDesabilitado ? 'motivo-avancar' : undefined}
              >
                {passo < 3 ? 'Avançar' : salvando ? 'Salvando…' : editando ? 'Salvar' : 'Começar'}
              </Button>
              {motivoDesabilitado && (
                <p id="motivo-avancar" className="text-caption text-subtle">{motivoDesabilitado}</p>
              )}
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}

function PassoNome({
  tituloRef,
  nome,
  onChange,
}: {
  tituloRef: RefObject<HTMLHeadingElement | null>
  nome: string
  onChange: (nome: string) => void
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 ref={tituloRef} tabIndex={-1} className="text-h2 font-semibold text-text">
          Como você quer ser chamado?
        </h2>
        <p className="text-sm text-muted">
          Personaliza as telas do app. Fica só neste aparelho — não é enviado a lugar nenhum.
        </p>
      </div>
      <Field rotulo="Nome">
        {(p) => (
          <Input
            {...p}
            type="text"
            autoFocus
            autoComplete="given-name"
            placeholder="Seu nome"
            maxLength={MAX_NOME}
            value={nome}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </Field>
    </section>
  )
}

function PassoRitmo({
  tituloRef,
  ritmo,
  onChangeRitmo,
  dataProva,
  onChangeData,
}: {
  tituloRef: RefObject<HTMLHeadingElement | null>
  ritmo: Ritmo
  onChangeRitmo: (ritmo: Ritmo) => void
  dataProva: string | null
  onChangeData: (data: string | null) => void
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 ref={tituloRef} tabIndex={-1} className="text-h2 font-semibold text-text">
          Qual ritmo de estudo?
        </h2>
        <p className="text-sm text-muted">
          Define quanto o app espera de você por dia. Dá para ajustar depois.
        </p>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Ritmo de estudo</legend>
        {(Object.keys(RITMOS) as Ritmo[]).map((chave) => {
          const preset = RITMOS[chave]
          const selecionado = ritmo === chave
          return (
            <label
              key={chave}
              className={cn(
                'flex items-start gap-3 rounded-md border p-4 cursor-pointer',
                'transition-colors duration-[var(--dur-fast)]',
                selecionado ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:bg-surface-2',
              )}
            >
              <input
                type="radio"
                name="ritmo"
                value={chave}
                checked={selecionado}
                onChange={() => onChangeRitmo(chave)}
                className="mt-1 h-[18px] w-[18px] shrink-0"
                style={{ accentColor: 'var(--primary)' }}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-body font-medium text-text">{preset.rotulo}</span>
                <span className="text-sm text-muted">{preset.descricao}</span>
              </span>
            </label>
          )
        })}
      </fieldset>
      <Field rotulo="Data da prova (opcional)" descricao="Ajuda a priorizar o que ainda falta ver.">
        {(p) => (
          <Input
            {...p}
            type="date"
            value={dataProva ?? ''}
            onChange={(e) => onChangeData(e.target.value || null)}
          />
        )}
      </Field>
    </section>
  )
}

function PassoDominio({
  tituloRef,
  disciplinas,
  nivelInicial,
  onChange,
}: {
  tituloRef: RefObject<HTMLHeadingElement | null>
  disciplinas: Disciplina[]
  nivelInicial: Record<string, NivelDominio>
  onChange: (nivelInicial: Record<string, NivelDominio>) => void
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 ref={tituloRef} tabIndex={-1} className="text-h2 font-semibold text-text">
          Domínio inicial por matéria
        </h2>
        <p className="text-sm text-muted">
          Uma estimativa de partida — o app corrige sozinho conforme você responde questões. Pode
          deixar tudo em "Inicial" e seguir.
        </p>
      </div>
      {disciplinas.length === 0 ? (
        <InlineAlert tom="info">Nenhuma disciplina carregada ainda.</InlineAlert>
      ) : (
        <Card>
          <ul>
            {disciplinas.map((d) => (
              <li key={d.id} className="border-b border-border last:border-b-0 p-4">
                <Field rotulo={d.nome}>
                  {(p) => (
                    <Select
                      {...p}
                      value={nivelInicial[d.slug] ?? 'inicial'}
                      onChange={(e) =>
                        onChange({ ...nivelInicial, [d.slug]: e.target.value as NivelDominio })
                      }
                    >
                      {NIVEIS.map((n) => (
                        <option key={n} value={n}>{ROTULO_NIVEL[n]}</option>
                      ))}
                    </Select>
                  )}
                </Field>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  )
}
