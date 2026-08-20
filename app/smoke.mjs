import { chromium } from 'playwright'

const dir = '/tmp/claude-0/-home-user-projeto-1/3c945aff-6f03-4a43-9f1d-4c1ff86b5f21/scratchpad'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' })
const page = await ctx.newPage()
const erros = []
page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
page.on('pageerror', (e) => erros.push('pageerror: ' + e.message))

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
console.log('HOJE h1:', await page.locator('h1').first().textContent())
await page.screenshot({ path: `${dir}/01-hoje.png` })

// Monta um bloco de ciclo e cronometra.
await page.getByRole('navigation').getByRole('link', { name: 'Ciclo' }).click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Adicionar ao ciclo' }).click()
await page.waitForTimeout(600)
await page.screenshot({ path: `${dir}/02-ciclo.png` })

// Lança minutos à mão.
await page.locator('input[type="number"]').fill('45')
await page.getByRole('button', { name: 'Registrar' }).click()
await page.waitForTimeout(800)

// Mapa: abre a primeira disciplina.
await page.getByRole('navigation').getByRole('link', { name: 'Mapa' }).click()
await page.waitForTimeout(800)
const disciplinas = await page.locator('h2 button').count()
console.log('disciplinas no mapa:', disciplinas)
await page.locator('h2 button').first().click()
await page.waitForTimeout(400)
const linhas = await page.locator('ul li').count()
console.log('linhas visíveis no mapa:', linhas)
await page.screenshot({ path: `${dir}/03-mapa.png`, fullPage: false })

// Tema escuro.
await page.getByRole('navigation').getByRole('link', { name: 'Mais' }).click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Escuro' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${dir}/04-mais-escuro.png` })

await page.getByRole('navigation').getByRole('link', { name: 'Mapa' }).click()
await page.waitForTimeout(600)
await page.locator('h2 button').first().click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${dir}/05-mapa-escuro.png` })

console.log('erros de console:', erros.length ? erros : 'nenhum')
await browser.close()
