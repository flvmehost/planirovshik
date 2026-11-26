import 'dotenv/config'
import { Bot, InlineKeyboard, webhookCallback } from 'grammy'
import { storeImport } from './imports.js'
import { startServer } from './server.js'

const token = process.env.BOT_TOKEN
const webAppUrl = process.env.WEB_APP_URL

if (!token || !webAppUrl) {
  console.error('Укажите BOT_TOKEN и WEB_APP_URL в файле bot/.env (см. .env.example)')
  process.exit(1)
}

const BOT_TOKEN: string = token
const WEB_APP_URL: string = webAppUrl
const MAX_PDF_BYTES = 20 * 1024 * 1024

const bot = new Bot(BOT_TOKEN)

const keyboard = new InlineKeyboard().webApp('Открыть планировщик 💰', WEB_APP_URL)

function importKeyboard(importToken: string): InlineKeyboard {
  const url = new URL(WEB_APP_URL)
  url.searchParams.set('import', importToken)
  return new InlineKeyboard().webApp('Проверить операции 📥', url.toString())
}

const greeting =
  '💰 *Планировщик бюджета*\n\n' +
  'Добавляйте доходы и расходы, ведите несколько карт, следите за целью накоплений и остатком средств.\n\n' +
  'Можно просто прислать сюда *PDF-выписку* из банка — я найду операции, а вы проверите карты и категории перед добавлением.\n\n' +
  'Нажмите кнопку ниже, чтобы открыть приложение.'

bot.command(['start', 'app'], async (ctx) => {
  await ctx.reply(greeting, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  })
})

bot.command('help', async (ctx) => {
  await ctx.reply(
    'Команды:\n' +
      '/start — открыть приложение\n' +
      '/help — эта справка\n\n' +
      'Пришлите PDF-выписку из банка, чтобы добавить траты списком.',
    { reply_markup: keyboard },
  )
})

bot.on('message:document', async (ctx) => {
  if (ctx.chat?.type !== 'private') return
  const document = ctx.message.document
  const isPdf =
    document.mime_type === 'application/pdf' || document.file_name?.toLowerCase().endsWith('.pdf')

  if (!isPdf) {
    await ctx.reply(
      'Пока я принимаю только PDF-выписки из банка. Скачайте выписку в приложении банка и пришлите файл сюда.',
    )
    return
  }

  if (document.file_size && document.file_size > MAX_PDF_BYTES) {
    await ctx.reply('Файл слишком большой. Пришлите выписку до 20 МБ.')
    return
  }

  try {
    const file = await ctx.getFile()
    if (!file.file_path) {
      await ctx.reply('Не удалось получить файл из Telegram. Попробуйте ещё раз.')
      return
    }

    const response = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`)
    if (!response.ok) {
      await ctx.reply('Не удалось скачать файл. Попробуйте ещё раз.')
      return
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const importToken = storeImport(
      ctx.from.id,
      document.file_name ?? 'statement.pdf',
      'application/pdf',
      buffer,
    )

    await ctx.reply(
      '📄 Выписка получена.\n\n' +
        'Откройте список: проверьте карты и категории, отключите переводы между своими счетами и добавьте нужные операции.',
      { reply_markup: importKeyboard(importToken) },
    )
  } catch (error) {
    console.error('Ошибка импорта выписки:', error)
    await ctx.reply('Не удалось обработать выписку. Попробуйте ещё раз или загрузите файл прямо в приложении.')
  }
})

bot.on('message:photo', async (ctx) => {
  if (ctx.chat?.type !== 'private') return
  await ctx.reply(
    'Скриншоты пока не поддерживаются — для них нужно распознавание текста.\n\n' +
      'Скачайте PDF-выписку в приложении банка и пришлите файл сюда: так операции распознаются точно.',
    { reply_markup: keyboard },
  )
})

bot.on('message:text', async (ctx) => {
  if (ctx.chat?.type !== 'private') return
  await ctx.reply('Откройте планировщик по кнопке ниже или пришлите PDF-выписку:', {
    reply_markup: keyboard,
  })
})

bot.catch((error) => {
  console.error('Ошибка бота:', error)
})

async function launch(): Promise<void> {
  const webhookBase = (process.env.WEBHOOK_URL ?? process.env.RENDER_EXTERNAL_URL)?.replace(/\/+$/, '')
  const webhookSecret = process.env.WEBHOOK_SECRET

  if (webhookBase) {
    const onUpdate = webhookCallback(bot, 'http')
    startServer(BOT_TOKEN, { onUpdate, secret: webhookSecret })
    const url = `${webhookBase}/telegram`
    try {
      await bot.api.setWebhook(url, webhookSecret ? { secret_token: webhookSecret } : undefined)
      console.log(`Webhook установлен: ${url}`)
    } catch (error) {
      console.error('Не удалось установить webhook:', error)
    }
    return
  }

  // Локально переключаемся с webhook на polling.
  try {
    await bot.api.deleteWebhook()
  } catch (error) {
    console.error('Не удалось удалить webhook:', error)
  }
  startServer(BOT_TOKEN)
  void bot.start()
  console.log('Бот запущен в режиме polling.')
}

void launch()
