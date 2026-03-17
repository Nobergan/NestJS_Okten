## Exception filters and Docker for production

Нижче описано саме те, що зараз лежить у робочому дереві: Docker-оточення для застосунку, запуск міграцій при старті контейнера, глобальний фільтр помилок і зміни в конфігурації БД.

## Що саме було зроблено

### 1. Додано `Dockerfile`

З'явився окремий `Dockerfile` для запуску зібраного NestJS-проєкту в контейнері. Він:

- бере базовий образ `node:20-alpine`;
- створює директорію `/app`;
- копіює `package.json`;
- встановлює тільки production-залежності;
- копіює папку `dist`;
- готує контейнер до запуску застосунку вже зі зібраного коду.

Це означає, що контейнер орієнтований не на розробку, а на запуск вже зібраного застосунку.

### 2. Оновлено `docker-compose.yml`

`docker-compose.yml` тепер піднімає не тільки MySQL, а й сам застосунок:

- додано сервіс `app`, який будується з локального `Dockerfile`;
- підтягується `.env` через `env_file`;
- відкривається порт `3001`;
- запуск `app` залежить від того, щоб `db` пройшов `healthcheck`;
- перед стартом Node.js автоматично виконується міграція:
  - `npm run typeorm -- migration:run --dataSource ./dist/ormconfig.js`
- після цього запускається NestJS із `node dist/src/main.js`;
- для MySQL додано volume `./mysql_db:/var/lib/mysql`, щоб дані зберігались між перезапусками;
- для MySQL додано `healthcheck`, щоб контейнер застосунку не стартував раніше, ніж БД реально готова приймати з'єднання.

### 3. Змінено `package.json`

У `package.json` залежність `tsconfig-paths` перенесена з `devDependencies` у `dependencies`.

Навіщо це потрібно:

- у `Dockerfile` виконується `npm i --production`;
- production-встановлення не ставить `devDependencies`;
- але скрипт `typeorm` використовує `ts-node -r tsconfig-paths/register`;
- отже без перенесення `tsconfig-paths` у звичайні залежності команда міграцій всередині контейнера не запуститься.

Тобто ця зміна потрібна саме для Docker-сценарію.

### 4. Оновлено `src/app.module.ts`

В `AppModule` підключено глобальний фільтр помилок через `APP_FILTER`:

- імпортовано `APP_FILTER`;
- імпортовано `GlobalExceptionFilter`;
- у `providers` зареєстровано глобальний провайдер:
  - `provide: APP_FILTER`
  - `useClass: GlobalExceptionFilter`

Це означає, що тепер усі необроблені помилки в HTTP-запитах проходять через один централізований фільтр.

### 5. Створено `src/shared/filters/global-exception.filter.ts`

Додано новий глобальний exception filter. Він:

- ловить будь-які винятки через `@Catch()`;
- визначає HTTP-статус:
  - якщо це `HttpException`, бере статус із самого exception;
  - інакше повертає `500 Internal Server Error`;
- формує уніфіковану відповідь у форматі:
  - `statusCode`
  - `timestamp`
  - `path`
  - `errors`
- віддає цю відповідь через `httpAdapter.reply(...)`.

Практичний ефект: помилки стають більш передбачуваними і мають єдиний JSON-формат.

### 6. Оновлено `src/shared/services/env.service.ts`

У `EnvService` змінено дефолтні значення для:

- `DB_USERNAME`
- `DB_PASSWORD`

Було:

```ts
configService.get<string>('DB_USERNAME', 'user');
configService.get<string>('DB_PASSWORD', 'user');
```

Стало:

```ts
configService.get<string>('DB_USERNAME', '');
configService.get<string>('DB_PASSWORD', '');
```

Що це означає:

- тепер без явних змінних оточення логін і пароль БД не підставляються автоматично;
- проєкт сильніше покладається на реальний `.env`;
- це корисно для більш явної конфігурації, але якщо `.env` не заданий коректно, підключення до БД не буде.

### 7. Оновлено `ormconfig.ts`

На початку `ormconfig.ts` тепер є активний імпорт:

```ts
import 'dotenv/config';
```

Що це означає:

- при запуску `ormconfig.ts` змінні з `.env` завантажуються одразу;
- це особливо корисно для TypeORM CLI та Docker-сценарію, де `DataSource` піднімається окремо від NestJS-застосунку;
- завдяки цьому `ConfigService` і `EnvService` можуть читати вже підготовлені змінні оточення.

### 8. З'явилась директорія `mysql_db/`

У незакомічених файлах є велика кількість файлів у `mysql_db/`.

Що це таке:

- це не код;
- це локальні файли MySQL;
- вони з'явилися через volume:

```yaml
./mysql_db:/var/lib/mysql
```

Тобто база даних почала зберігати свої дані прямо в папку проєкту.

## Пояснення кожного рядка `Dockerfile`

Поточний вміст:

```dockerfile
FROM node:20-alpine

LABEL maintainer='Some DEV'

RUN mkdir /app
WORKDIR /app

COPY package.json ./
RUN npm i --production

COPY dist/ ./dist
```

Пояснення по рядках:

1. `FROM node:20-alpine`
   Використовує готовий Docker-образ з Node.js 20 на базі Alpine Linux. Це легкий базовий образ для запуску Node-застосунків.

2. `LABEL maintainer='Some DEV'`
   Додає метадані до образу. Це інформаційний рядок про автора або відповідального за образ.

3. `RUN mkdir /app`
   Створює директорію `/app` всередині контейнера. Саме там буде розміщено застосунок.

4. `WORKDIR /app`
   Робить `/app` поточною робочою директорією. Усі наступні команди виконуватимуться вже відносно цієї папки.

5. `COPY package.json ./`
   Копіює `package.json` у робочу директорію контейнера. Це потрібно, щоб встановити залежності всередині образу.

6. `RUN npm i --production`
   Встановлює тільки production-залежності. Це зменшує розмір образу, але означає, що все необхідне для runtime має бути в `dependencies`, а не в `devDependencies`.

7. `COPY dist/ ./dist`
   Копіює вже зібраний TypeScript-проєкт у вигляді `dist`. Це означає, що перед `docker compose up --build` застосунок очікувано має бути зібраний командою `npm run build`.

## Пояснення кожного рядка `docker-compose.yml`

Поточний вміст:

```yaml
services:
  app:
    build:
      context: .
    env_file:
      - .env
    ports:
      - "3001:3001"
    depends_on:
      db:
        condition: service_healthy
    command: >
      sh -c "npm run typeorm -- migration:run --dataSource ./dist/ormconfig.js && node dist/src/main.js"
  db:
    image: mysql:8
    volumes:
      - ./mysql_db:/var/lib/mysql
    environment:
      - MYSQL_DATABASE=my-nestjs-test
      - MYSQL_USER=user
      - MYSQL_PASSWORD=user
      - MYSQL_ROOT_PASSWORD=superpass
    ports:
      - "3307:3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "user", "-psuperpass"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 5s
```

Пояснення по рядках:

1. `services:`
   Початок секції з описом усіх сервісів, які запускає Docker Compose.

2. `  app:`
   Оголошення сервісу застосунку.

3. `    build:`
   Секція параметрів збірки образу для `app`.

4. `      context: .`
   Каже Docker збирати образ із поточної директорії, тобто з кореня проєкту.

5. `    env_file:`
   Початок секції з файлами змінних оточення.

6. `      - .env`
   Підключає `.env` у контейнер `app`.

7. `    ports:`
   Початок секції пробросу портів.

8. `      - "3001:3001"`
   Проброс порту `3001` з контейнера на `3001` хоста.

9. `    depends_on:`
   Описує залежності сервісу `app` від інших сервісів.

10. `      db:`
    Залежність саме від сервісу бази даних.

11. `        condition: service_healthy`
    `app` стартує тільки після того, як `db` позначиться як healthy.

12. `    command: >`
    Початок багаторядкової команди YAML у folded-форматі.

13. `      sh -c "npm run typeorm -- migration:run --dataSource ./dist/ormconfig.js && node dist/src/main.js"`
    Усередині контейнера спочатку запускає міграції, а потім стартує застосунок. Якщо міграція впаде, Node.js не стартує.

14. `  db:`
    Оголошення сервісу бази даних.

15. `    image: mysql:8`
    Використовує офіційний образ MySQL 8.

16. `    volumes:`
    Початок секції томів.

17. `      - ./mysql_db:/var/lib/mysql`
    Монтує локальну папку `mysql_db` у внутрішню директорію даних MySQL, щоб БД зберігалась між перезапусками.

18. `    environment:`
    Початок секції змінних оточення для контейнера MySQL.

19. `      - MYSQL_DATABASE=my-nestjs-test`
    Автоматично створює базу `my-nestjs-test`.

20. `      - MYSQL_USER=user`
    Створює користувача `user`.

21. `      - MYSQL_PASSWORD=user`
    Задає пароль для користувача `user`.

22. `      - MYSQL_ROOT_PASSWORD=superpass`
    Задає пароль root-користувача MySQL.

23. `    ports:`
    Початок секції пробросу портів для MySQL.

24. `      - "3307:3306"`
    Порт `3307` на хості перенаправляється в `3306` контейнера. Підключатися локально треба на `3307`.

25. `    healthcheck:`
    Початок секції перевірки здоров'я контейнера.

26. `      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "user", "-psuperpass"]`
    Команда перевірки: Docker буде запускати `mysqladmin ping`, щоб зрозуміти, чи жива база.

27. `      interval: 5s`
    Перевірка виконується кожні 5 секунд.

28. `      timeout: 3s`
    Якщо перевірка не відповіла за 3 секунди, вважається невдалою.

29. `      retries: 10`
    Після 10 невдалих перевірок сервіс вважається unhealthy.

30. `      start_period: 5s`
    Перші 5 секунд після старту даються контейнеру як час на ініціалізацію.

## Команди, які ти запускав у цій гілці

```bash
docker compose up --build
docker system prune -a --volumes
```

- `docker compose up --build`
  Перебудовує образи перед запуском і піднімає сервіси з `docker-compose.yml`. У цьому проєкті команда збирає контейнер застосунку, запускає MySQL, чекає готовності БД, потім виконує міграції й стартує NestJS.

- `docker system prune -a --volumes`
  Очищає Docker-систему максимально агресивно:
  - видаляє зупинені контейнери;
  - видаляє невикористані мережі;
  - видаляє всі невикористані образи, не тільки dangling;
  - видаляє build cache;
  - видаляє невикористані volumes.

Цю команду зазвичай запускають, коли треба:

- звільнити місце на диску;
- скинути Docker-кеш;
- прибрати старі volume та образи перед "чистим" перезапуском оточення.

## Висновок по поточному стану

У цій незакоміченій версії проєкту ти рухався в бік контейнеризованого запуску:

- додав production `Dockerfile`;
- навчив `docker-compose.yml` запускати і застосунок, і MySQL;
- зробив автозапуск міграцій перед стартом застосунку;
- переніс `tsconfig-paths` у runtime-залежності для роботи TypeORM у контейнері;
- увімкнув `dotenv/config` у `ormconfig.ts`, щоб `DataSource` точно бачив змінні з `.env`;
- додав глобальний фільтр помилок;
- змінив дефолти для DB-креденшелів;
- примонтував локальну папку `mysql_db` для збереження даних MySQL.

