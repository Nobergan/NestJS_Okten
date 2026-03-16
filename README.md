## NestJS — конфіг `.env`, TypeORM та міграції

Ця гілка налаштована під **роботу з конфігом через сервіс `EnvService`** та **керування базою даних через міграції TypeORM** замість `synchronize: true`.

---

## Що було зроблено в цій гілці

- **Винесено роботу з `.env` в окремий сервіс `EnvService`**
  - Один централізований сервіс для читання JWT та DB-конфігів.
  - Значення беруться з `ConfigService` (`@nestjs/config`) з дефолтами на випадок відсутності змінних.

- **Створено `SharedModule`**
  - Інкапсулює `EnvService`.
  - Експортує `EnvService`, щоб ним можна було користуватися в інших модулях (наприклад, у TypeORM-конфігурації).

- **Переведено `TypeOrmModule` на асинхронну конфігурацію через `EnvService`**
  - Раніше `TypeOrmModule.forRoot` мав хардкод: хост, порт, логін/пароль, назву БД, `synchronize: true`.
  - Тепер використовується `TypeOrmModule.forRootAsync`:
    - Підтягує `EnvService` з `SharedModule`.
    - Бере всі параметри підключення до БД з `.env`.
    - Вимкнено `synchronize`, замість цього використовується механіка міграцій.

- **Підключено `SharedModule` в `AppModule`**
  - Щоб `EnvService` був доступний глобально (для TypeORM та інших частин застосунку).

- **Додано окремий `ormconfig.ts` з `DataSource` для CLI TypeORM**
  - Створює `DataSource` на базі `EnvService`.
  - Використовується CLI-утилітами TypeORM для генерації/запуску/відкату міграцій.

- **Створено першу міграцію `1773687082714-first.ts`**
  - Створює таблиці:
    - `table` — прикладова таблиця з полями `type`, `width`, `height`, `inStock`.
    - `user` — користувачі з унікальним `username`.
    - `token` — токени авторизації (access/refresh + звʼязок з `user`).
  - Налаштовує foreign key `token.userId → user.id`.
  - Передбачено коректний `down` (видалення foreign key, індексу та таблиць).

- **Оновлено `package.json` під роботу з міграціями**
  - Додано скрипт для запуску TypeORM CLI.
  - Додано скрипти для генерації, запуску та відкату міграцій.
  - Додано dev-залежність `cross-var` для кросплатформенної підтримки змінних середовища в npm-скриптах.

---

## Деталі по основних файлах

### `src/shared/services/env.service.ts`

- **Призначення**: єдиний сервіс для читання всіх важливих змінних оточення.
- Зберігає в собі:
  - **JWT-конфіг**:
    - `jwtSecret`
    - `accessTokenExpirationTime`
    - `refreshTokenExpirationTime`
  - **DB-конфіг**:
    - `dbType`
    - `dbHost`
    - `dbPort`
    - `dbUsername`
    - `dbPassword`
    - `dbDatabase`
- Значення читаються через `ConfigService` з дефолтами, щоб локально все працювало "з коробки", навіть без `.env`.

### `src/shared/shared.module.ts`

- **Призначення**: модуль-обгортка для спільних сервісів.
- Містить:
  - `imports: [ConfigModule]`
  - `providers: [EnvService]`
  - `exports: [EnvService]`
- Дозволяє іншим модулям просто імпортувати `SharedModule` і отримувати `EnvService` через DI.

### `src/typeorm.module.ts`

- Раніше:
  - Використовувався `TypeOrmModule.forRoot` з хардкодом:
    - `host: 'localhost'`, `port: 3307`, `username: 'user'`, `password: 'user'`, `database: 'my-nestjs-test'`.
    - `synchronize: true`.
- Тепер:
  - Використовується `TypeOrmModule.forRootAsync`.
  - Імпортується `SharedModule`.
  - У `useFactory` передається `EnvService`, з якого беруться всі параметри:
    - `type`, `host`, `port`, `username`, `password`, `database`.
  - Додано:
    - `migrations: [__dirname + '/migrations/*{.ts,.js}']`
    - `entities: [__dirname + '/**/*.entity{.ts,.js}']`
    - `synchronize: false`

### `ormconfig.ts`

- Окремий конфіг для TypeORM CLI у вигляді `DataSource`.
- Використовує:
  - `ConfigService` з `@nestjs/config`.
  - `EnvService` для отримання параметрів підключення до БД.
- Налаштовує:
  - тип БД (очікувано `mysql`);
  - хост, порт, логін/пароль, назву БД;
  - шляхи до міграцій: `src/migrations/*{.ts,.js}`;
  - шляхи до сутностей: `**/*.entity{.ts,.js}`;
  - `synchronize: false`.
- Використовується всіма CLI-командами TypeORM через прапорець `--dataSource ./ormconfig.ts`.

### `src/migrations/1773687082714-first.ts`

- **Up (`up`):**
  - Створює таблицю `table` з полями:
    - `id` (PK, автоінкремент),
    - `type` (varchar),
    - `width` (int),
    - `height` (int),
    - `inStock` (boolean/tinyint, за замовчуванням `1`).
  - Створює таблицю `token` з полями для зберігання JWT-токенів:
    - `accessToken`, `refreshToken`,
    - часи експірації для обох токенів,
    - прапорець `isBlocked`,
    - `jti`,
    - `userId` (nullable FK на `user`).
  - Створює таблицю `user`:
    - `id` (PK),
    - `username` (унікальний),
    - `password`.
  - Додає foreign key `token.userId → user.id`.

- **Down (`down`):**
  - При відкаті:
    - видаляє foreign key;
    - знімає унікальний індекс з `user.username`;
    - видаляє таблиці `user`, `token`, `table`.

---

## Змінні оточення (`.env`)

Мінімальний набір змінних для коректної роботи:

```env
JWT_SECRET=<ваш_секретний_ключ>
ACCESS_TOKEN_EXPIRATION_TIME=900          # час життя access-токена в секундах
REFRESH_TOKEN_EXPIRATION_TIME=2592000     # час життя refresh-токена в секундах

DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3307
DB_USERNAME=user
DB_PASSWORD=user
DB_DATABASE=my-nestjs-test
```

- **`JWT_SECRET`**: секрет для підпису JWT.
- **`ACCESS_TOKEN_EXPIRATION_TIME` / `REFRESH_TOKEN_EXPIRATION_TIME`**: тривалість життя access/refresh токенів.
- **`DB_*` змінні**: параметри підключення до MySQL.

---

## Команди, які використовуються в проєкті

### Залежності та запуск

- **Встановлення залежностей**

```bash
npm install
```

- **Запуск застосунку в режимі розробки**

```bash
npm run start:dev
```

### База даних (Docker + MySQL)

- **Запуск MySQL через Docker Compose**

```bash
docker-compose up -d
```

Підіймає контейнер MySQL 8 у фоні з параметрами (як у попередній конфігурації проєкту):
- БД: `my-nestjs-test`
- користувач: `user` / пароль `user`
- root-пароль: `superpass`
- порт: `3307:3306`

### TypeORM CLI та міграції

- **Базова команда TypeORM CLI (через npm-скрипт)**

```bash
npm run typeorm -- <subcommand>
```

Виконує `./node_modules/typeorm/cli.js`, підключаючи `ts-node` і `tsconfig-paths`. Далі можна використовувати стандартні сабкоманди TypeORM.

- **Генерація нової міграції**

```bash
npm run migration:generate --name=<ІМʼЯ_МІГРАЦІЇ>
```

Що відбувається:
- Скрипт `migration:generate` використовує `cross-var` і змінну `npm_config_name`, яку npm передає з `--name=...`.
- Викликається:
  - `npm run typeorm -- migration:generate --dataSource ./ormconfig.ts src/migrations/$npm_config_name`
- У результаті в `src/migrations/` створюється новий файл міграції з імʼям на основі переданого `--name`.

- **Запуск усіх pending-міграцій**

```bash
npm run migration:run
```

Що робить:
- Викликає `npm run typeorm -- migration:run --dataSource ./ormconfig.ts`.
- Виконує всі міграції, які ще не були застосовані до поточної БД.

- **Відкат останньої виконаної міграції**

```bash
npm run migration:revert
```

Що робить:
- Викликає `npm run typeorm -- migration:revert --dataSource ./ormconfig.ts`.
- Відкочує останню застосовану міграцію (викликає метод `down` останнього файлу міграції).

### Інші корисні команди (git, службові)

Ці команди використовувалися у процесі роботи з гілкою для перевірки стану проєкту та змін:

- **Перевірка статусу git**

```bash
git status
```

Показує поточний стан репозиторію: які файли змінені, додані, не відстежуються тощо.

- **Перегляд відмінностей у файлах**

```bash
git diff
```

Виводить різницю між поточними зміненими файлами та останнім закоміченим станом.

---

## Коротко про поточну конфігурацію

- **Конфігурація оточення** централізована в `EnvService` і використовується як у JWT-логіці, так і в підключенні до БД.
- **TypeORM** більше не працює в режимі `synchronize: true`, замість цього застосовуються **міграції**.
- **Міграції** описують структуру таблиць `user`, `token` і `table`, а також всі потрібні ключі та індекси.
- **NPM-скрипти** спрощують генерацію/запуск/відкат міграцій і роблять налаштування кросплатформенним за рахунок `cross-var`.

