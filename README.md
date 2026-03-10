# NestJS Tables API

Навчальний проєкт на [NestJS](https://nestjs.com/) — REST API для управління столами з підключенням до MySQL через TypeORM та документацією Swagger.

---

## Що було зроблено

### 1. Налаштування проєкту

- Створено базовий NestJS проєкт за допомогою `nest new`.
- Видалено стандартні шаблонні файли:
  - `src/app.controller.ts`
  - `src/app.controller.spec.ts`
  - `src/app.service.ts`
- У `nest-cli.json` додано параметр `generateOptions: { spec: false }` — щоб при генерації нових файлів через CLI автоматично **не створювались** тестові spec-файли.

### 2. Встановлення залежностей

Встановлено наступні пакети:

| Пакет | Призначення |
|---|---|
| `@nestjs/typeorm` | Інтеграція TypeORM з NestJS |
| `typeorm` | ORM для роботи з базою даних |
| `mysql2` | Драйвер для підключення до MySQL |
| `@nestjs/swagger` | Генерація Swagger/OpenAPI документації |
| `swagger-ui-express` | UI для Swagger в Express |
| `@nestjs/mapped-types` | Утиліти для DTO (наприклад, `PartialType`) |
| `class-validator` | Декоратори для валідації вхідних даних |
| `class-transformer` | Декоратори для трансформації об'єктів |

### 3. Docker — запуск MySQL

Створено файл `docker-compose.yml` для запуску MySQL 8 в контейнері:

```yaml
services:
  db:
    image: mysql:8
    environment:
      - MYSQL_DATABASE=my-nestjs-test
      - MYSQL_USER=user
      - MYSQL_PASSWORD=user
      - MYSQL_ROOT_PASSWORD=superpass
    ports:
      - "3307:3306"
```

- База даних: `my-nestjs-test`
- Користувач: `user` / пароль: `user`
- Зовнішній порт: `3307` (щоб не конфліктувати з локальним MySQL на `3306`)

### 4. Підключення до бази даних — `TypeormModule`

Створено `src/typeorm.module.ts` — окремий NestJS модуль з налаштуванням TypeORM:

- Тип БД: `mysql`
- Хост: `localhost`, порт: `3307`
- Параметр `synchronize: true` — TypeORM автоматично синхронізує схему БД з ентіті (зручно для розробки)
- Ентіті шукаються за шляхом: `**/*.entity{.ts,.js}`

### 5. Модуль Tables

Згенеровано та реалізовано повноцінний CRUD модуль `src/tables/`:

#### Ентіті — `table.entity.ts`
TypeORM ентіті з полями:

| Поле | Тип | Опис |
|---|---|---|
| `id` | `number` | Первинний ключ (auto-increment) |
| `type` | `string` | Тип столу (наприклад, "wood") |
| `width` | `number` | Ширина |
| `height` | `number` | Висота |
| `inStock` | `boolean` | Наявність в наявності (за замовчуванням `true`) |

#### DTO файли

- **`create-table.dto.ts`** — DTO для створення столу. Містить валідацію через `class-validator`:
  - `type`: рядок, від 2 до 255 символів
  - `width`, `height`: числа від 10 до 1 000 000
  - `inStock`: необов'язкове поле
- **`update-table.dto.ts`** — DTO для оновлення. Розширює `CreateTableDto` через `PartialType` — всі поля стають необов'язковими.
- **`response-table.dto.ts`** — DTO для відповіді API зі Swagger-декораторами `@ApiProperty`.

#### Сервіс — `tables.service.ts`
Реалізовано методи через TypeORM Repository:
- `create(dto)` — створення нового запису
- `findAll()` — отримання всіх записів
- `findById(id)` — пошук за ID (якщо не знайдено — кидає `NotFoundException`)
- `update(id, dto)` — оновлення запису
- `delete(id)` — видалення запису

#### Контролер — `tables.controller.ts`
REST-контролер з маршрутами:

| Метод | URL | Дія |
|---|---|---|
| `POST` | `/tables` | Створити новий стіл |
| `GET` | `/tables` | Отримати всі столи |
| `GET` | `/tables/:id` | Отримати стіл за ID |
| `PATCH` | `/tables/:id` | Оновити стіл |
| `DELETE` | `/tables/:id` | Видалити стіл |

### 6. Налаштування `main.ts`

- Підключено **глобальний `ValidationPipe`** з опцією `transform: true` — автоматично валідує вхідні дані та перетворює типи.
- Налаштовано **Swagger**:
  - Назва: `Table API`
  - Опис: `API for tables sell`
  - Версія: `1.0.0`
  - Тег: `Tables`
  - Доступний за адресою: `http://localhost:3001/docs`
- Порт змінено з `3000` на **`3001`**.

### 7. `AppModule`

Видалено стандартні `AppController` та `AppService`. Підключено:
- `TablesModule`
- `TypeormModule`

---

## Структура проєкту

```
src/
├── app.module.ts              # Головний модуль
├── main.ts                    # Точка входу (bootstrap, Swagger, ValidationPipe)
├── typeorm.module.ts          # Налаштування підключення до MySQL
└── tables/
    ├── tables.module.ts       # Модуль Tables
    ├── tables.controller.ts   # REST-контролер
    ├── tables.service.ts      # Бізнес-логіка + робота з БД
    ├── entities/
    │   └── table.entity.ts    # TypeORM ентіті
    └── dto/
        ├── create-table.dto.ts
        ├── update-table.dto.ts
        └── response-table.dto.ts
```

---

## Команди в терміналі

### Встановлення залежностей

```bash
npm install
```
Встановлює всі залежності з `package.json`.

```bash
npm install @nestjs/typeorm typeorm mysql2 @nestjs/swagger swagger-ui-express @nestjs/mapped-types class-validator class-transformer
```
Встановлює нові пакети для роботи з базою даних, Swagger та валідацією.

### Генерація модуля через NestJS CLI

```bash
nest generate module tables
# або скорочено
nest g module tables
```
Генерує файл `src/tables/tables.module.ts`.

```bash
nest generate controller tables
# або скорочено
nest g controller tables
```
Генерує файл `src/tables/tables.controller.ts`.

```bash
nest generate service tables
# або скорочено
nest g service tables
```
Генерує файл `src/tables/tables.service.ts`.

> Завдяки налаштуванню `"spec": false` в `nest-cli.json` — тестові файли (`*.spec.ts`) **не генеруються** автоматично.

### Docker — запуск бази даних

```bash
docker compose up -d
```
Запускає MySQL контейнер у фоновому режимі (`-d` = detached). Після цього база даних доступна на `localhost:3307`.

```bash
docker compose down
```
Зупиняє та видаляє контейнери.

```bash
docker ps
```
Перевірити, які контейнери зараз запущені.

### Запуск застосунку

```bash
npm run start:dev
```
Запускає NestJS у режимі розробки з watch (автоперезавантаження при змінах файлів).

```bash
npm run start
```
Запускає NestJS у звичайному режимі.

```bash
npm run build
```
Компілює TypeScript у JavaScript (в папку `dist/`).

---

## Запуск проєкту

1. Запустити MySQL через Docker:
   ```bash
   docker compose up -d
   ```

2. Встановити залежності:
   ```bash
   npm install
   ```

3. Запустити сервер:
   ```bash
   npm run start:dev
   ```

4. Відкрити Swagger UI:
   ```
   http://localhost:3001/docs
   ```

---

## Технології

- [NestJS](https://nestjs.com/) — Node.js фреймворк
- [TypeORM](https://typeorm.io/) — ORM для TypeScript
- [MySQL](https://www.mysql.com/) — реляційна база даних
- [Docker](https://www.docker.com/) — контейнеризація
- [Swagger](https://swagger.io/) — документація API
- [class-validator](https://github.com/typestack/class-validator) — валідація
- [class-transformer](https://github.com/typestack/class-transformer) — трансформація
