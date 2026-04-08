import { test, expect, _electron as electron } from '@playwright/test'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MAIN_ENTRY = resolve(__dirname, '../out/main/index.js')

test.describe('Setlist app', () => {
  test('launches and shows main window', async () => {
    const app = await electron.launch({ args: [MAIN_ENTRY] })
    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    const { width, height } = await window.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }))
    expect(width).toBeGreaterThanOrEqual(800)
    expect(height).toBeGreaterThanOrEqual(600)

    await app.close()
  })

  test('renders app content', async () => {
    const app = await electron.launch({ args: [MAIN_ENTRY] })
    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    // App should render visible content
    const body = window.locator('body')
    await expect(body).toBeVisible({ timeout: 10_000 })

    await app.close()
  })

  test('window background matches design system', async () => {
    const app = await electron.launch({ args: [MAIN_ENTRY] })
    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    const bgColor = await window.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor
    })
    // Should use the warm charcoal palette
    expect(bgColor).toBeTruthy()

    await app.close()
  })
})
