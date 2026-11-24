import 'dotenv/config'
import { Bot, InlineKeyboard } from 'grammy'

const token = process.env.BOT_TOKEN
const webAppUrl = process.env.WEB_APP_URL

if (!token || !webAppUrl) {
  console.error('Укажите BOT_TOKEN и WEB_APP_URL в файле bot/.env (см. .env.example)')
  process.exit(1)
}

const bot = new Bot(token)

const keyboard = new InlineKeyboard().webApp('Открыть планировщик 💰', webAppUrl)

const greeting =
  '💰 *Планировщик бюджета*\n\n' +
  'Добавляйте доходы и расходы, ведите несколько карт, следите за целью накоплений и остатком средств.\n\n' +
  'Нажмите кнопку ниже, чтобы открыть приложение.'

bot.command(['start', 'app'], async (ctx) => {
  await ctx.reply(greeting, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  })
})

bot.command('help', async (ctx) => {
  await ctx.reply('Команды: /start — открыть приложение, /help — эта справка.', {
    reply_markup: keyboard,
  })
})

bot.on('message:text', async (ctx) => {
  if (ctx.chat?.type !== 'private') return
  await ctx.reply('Откройте планировщик по кнопке ниже:', { reply_markup: keyboard })
})

bot.catch((error) => {
  console.error('Ошибка бота:', error)
})

void bot.start()
console.log('Бот запущен. Токен и URL загружены из bot/.env')
