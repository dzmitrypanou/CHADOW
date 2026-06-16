# Chadow.ru

Портал игровых сервисов для сообщества World of Tanks: анализ АБС-реплеев, онлайн серверов, рекрутинг, турнирные сетки, тактический планшет, аим-тренажёры, мини-игры и лаунчер Minecraft.

**Сайт:** [chadow.ru](https://chadow.ru)  
**Репозиторий:** [github.com/dzmitrypanou/chadow.ru](https://github.com/dzmitrypanou/chadow.ru)  
**Версия:** 0.6.8 Obsidian

## Сервисы

| Сервис | Путь | Описание |
|--------|------|----------|
| **ABS** | `/services/abs` | Анализ реплеев World of Tanks |
| **Online** | `/services/online` | Статус серверов WoT (WG / Lesta) |
| **Recruiting** | `/services/recruiting` | Доска объявлений для поиска команды / клана |
| **Bracket** | `/services/bracket` | Турнирные сетки (single / double elimination, группы) |
| **Tactics** | `/services/tactics` | Совместный тактический планшет с картами и чатом |
| **Aim** | `/services/aim` | Тренажёры прицеливания и таблицы лидеров |
| **Online Games** | `/services/onlinegames` | Браузерные мини-игры (шашки и др.) |
| **Minecraft Launcher** | карточка на главной | Chadow Games Launcher (управление через админку) |

Английская локализация доступна по префиксу `/en/` (например, `/en/services/abs`).

## Стек

- **Backend:** PHP 8+, MySQL/MariaDB (PDO)
- **Frontend:** vanilla JavaScript (ES modules), CSS
- **Realtime:** Node.js WebSocket-сервисы (`ws`) для тактического планшета и шашек
- **Веб-сервер:** Apache (`mod_rewrite`, `mod_headers`, `mod_expires`)
- **Фоновые задачи:** systemd-сервис обновления кэша онлайна

## Требования

- PHP 8+ с расширениями: `pdo_mysql`, `json`, `mbstring`, `curl`, `gd` (для работы с изображениями)
- MySQL 8+ или MariaDB 10.5+
- Apache 2.4+ с `mod_rewrite`
- Node.js 18+ (для WebSocket-хабов)
- Composer не используется — зависимости PHP отсутствуют

## Быстрый старт (локально)

### 1. Клонирование

```bash
git clone https://github.com/dzmitrypanou/chadow.ru.git
cd chadow.ru
```

### 2. База данных

Создайте БД и пользователя, затем настройте `config/config_db.php`:

```php
return [
    'host' => 'localhost',
    'database' => 'chadow',
    'username' => 'chadow',
    'password' => 'your_password',
    'charset' => 'utf8mb4',
    // ...
];
```

Импорт существующего дампа и прогон миграций схемы:

```bash
bash deploy/import-legacy-db.sh /path/to/dump.sql
# или после ручного импорта:
php scripts/warmup_schema.php
```

Скрипт `warmup_schema.php` создаёт и обновляет все таблицы проекта (CMS, рекрутинг, сетки, тактика, aim, справочники и т.д.).

### 3. Веб-сервер

Document root должен указывать на корень репозитория. Apache подхватывает правила из `.htaccess`.

Примеры конфигов для продакшена лежат в `deploy/apache/`:

- `www-chadow-redirect.conf` — редирект www → apex
- `abs-chadow-redirect.conf` — редирект legacy-домена
- `tactics-ws.conf` — прокси WebSocket тактики
- `minecraft-api.conf` — маршруты Minecraft API

### 4. WebSocket-сервисы (опционально)

```bash
cd deploy/tactics-ws && npm install && npm start
cd deploy/checkers-ws && npm install && npm start
```

Установка как systemd-сервисов:

```bash
sudo bash deploy/systemd/install-tactics-ws-service.sh
sudo bash deploy/systemd/install-checkers-ws-service.sh
```

### 5. Кэш онлайна (опционально)

```bash
sudo bash deploy/systemd/install-online-cache-service.sh
```

Или cron: `scripts/refresh_online_cache_cron.sh`.

## Переменные окружения

| Переменная | Назначение |
|------------|------------|
| `WG_APPLICATION_ID` | Application ID Wargaming API |
| `LESTA_APPLICATION_ID` | Application ID Lesta API |
| `CHADOW_RUNTIME_SCHEMA_CHECKS` | Включить проверки схемы при запросах (обычно через warmup) |
| `CHECKERS_WS_SECRET` | Секрет WebSocket шашек (синхронизируется с `site_settings`) |

Настройки также хранятся в таблице `site_settings` и редактируются через админку.

## Структура проекта

```
├── admin/           # Панель администратора
├── api/             # JSON API для фронтенда и интеграций
├── auth/            # Регистрация, вход, профиль, WG OpenID
├── config/          # Конфиг БД, SQL-схемы, ensure_*-миграции
├── css/, js/        # Статика сайта
├── deploy/          # Apache/nginx, systemd, WS-сервисы, скрипты деплоя
├── includes/        # PHP-хелперы (auth, SEO, game API, tactics, …)
├── scripts/         # CLI: warmup схемы, кэш онлайна, утилиты
├── services/        # Страницы сервисов (ABS, bracket, tactics, …)
├── uploads/         # Загружаемые файлы (Minecraft packs, карты тактики)
├── index.php        # Главная
└── page.php         # CMS-страницы по slug
```

## Админ-панель

Доступна по `/admin/`. Разделы:

- справочники танков, карт, наций и типов техники;
- CMS-страницы и меню сайта;
- модерация рекрутинга и турнирных сеток;
- управление комнатами и картами тактического планшета;
- таблицы лидеров aim-тренажёров;
- WGSRT-редактор;
- Chadow Games Launcher (Minecraft);
- пользователи и права.

## Полезные скрипты

```bash
php scripts/warmup_schema.php              # миграции / прогрев схемы БД
php scripts/refresh_online_cache.php       # обновить кэш онлайна WoT
php scripts/tactics_purge_guest_rooms.php  # очистка гостевых комнат тактики
bash deploy/backup-db.sh                     # бэкап БД
bash deploy/replace-db.sh                  # замена БД из дампа
```

## Лицензия

Приватный проект. Использование кода — по согласованию с автором.
