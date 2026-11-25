# Планировщик бюджета — Telegram Mini App

Мобильное приложение для учёта доходов, расходов, нескольких банковских карт и цели накоплений.

## Возможности

- Несколько карт со стартовым остатком; общий баланс и остаток по каждой карте.
- Остаток считается из операций: `стартовый баланс + доходы − расходы − отложения`. Редактирование и удаление операции автоматически пересчитывает обе карты.
- Доходы, расходы и пополнения цели с категориями, датой и заметкой.
- Свои категории для расходов и доходов: название, эмодзи и цвет; создание прямо в форме операции, переименование и удаление с переносом операций в «Прочее».
- Цель накоплений с прогресс-баром; пополнения списываются с выбранной карты.
- Кольцевая диаграмма расходов по категориям с суммами и процентами.
- История с группировкой по датам, редактированием, удалением и кнопкой «Отменить».
- Скрытие карты без потери её операций и денег; архив с восстановлением.
- Форматирование сумм `ru-RU` (`tabular-nums`), тема и кнопки Telegram, haptic feedback, CloudStorage-синхронизация с локальным кэшем.

## Разработка

```bash
npm install
npm run dev
```

Приложение откроется по адресу из вывода Vite. Вне Telegram оно работает на `localStorage` — так удобно проверять интерфейс в обычном браузере.

Проверка/typescript и production-сборка:

```bash
npm run build
npm run preview
```

## Публикация мини-приложения

### 1. Деплой через GitHub Pages (текущая конфигурация)

Репозиторий: `https://github.com/flvmehost/planirovshik.git`, ветка `main`.
Workflow `.github/workflows/deploy.yml` при каждом push собирает проект и публикует `dist/`.

Публичный адрес: **https://flvmehost.github.io/planirovshik/**

Если нужно заново включить Pages: repo → Settings → Pages → Source: **GitHub Actions**.

### 2. Бот @planirovshikbudgetaai

Бот создан через [@BotFather](https://t.me/BotFather). Кнопка меню «Бюджет» и команды уже выставлены через Bot API:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setChatMenuButton" \
  -H 'content-type: application/json' \
  -d '{"menu_button":{"type":"web_app","text":"Бюджет","web_app":{"url":"https://flvmehost.github.io/planirovshik/"}}}'
```

При желании включите **Main Mini App** в BotFather (`/mybots` → бот → Bot Settings → Configure Mini App), чтобы в профиле появилась кнопка «Launch app» и ссылка `https://t.me/planirovshikbudgetaai?startapp` открывала приложение напрямую.

### 3. Запустите бота с кнопкой «Открыть планировщик»

```bash
cd bot
npm install
cp .env.example .env
# Откройте bot/.env и заполните BOT_TOKEN и WEB_APP_URL
npm run build
npm start
```

Бот на grammY отправляет по `/start` сообщение с inline-кнопкой `web_app`, которая открывает мини-приложение. Для постоянной работы запустите `npm start` на VPS под `systemd`/`pm2` или используйте любой Node-хостинг.

### 4. Проверьте в Telegram

- Откройте чат с `@planirovshikbudgetaai` → `/start` → нажмите кнопку; либо кнопку меню «Бюджет»; либо ссылку `https://t.me/planirovshikbudgetaai?startapp`.
- Проверьте светлую и тёмную темы, безопасные отступы, работу на телефоне и в Telegram Desktop.
- Убедитесь, что данные сохраняются между перезапусками мини-приложения: локально в `localStorage`, в Telegram дополнительно в `CloudStorage` (привязан к боту, отдельный серверный токен не нужен).

## Структура

```
src/          мини-приложение (React + Vite + TypeScript)
bot/          бот на grammY, открывающий мини-приложение
dist/         production-сборка (не коммитится)
```
