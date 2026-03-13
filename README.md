# NestJS — Авторизація через JWT

## Що було зроблено

### Встановлення залежностей

```bash
npm install @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
npm install -D @types/passport-jwt @types/bcrypt
```

| Пакет | Призначення |
|---|---|
| `@nestjs/config` | Зчитування змінних оточення з файлу `.env` |
| `@nestjs/jwt` | Генерація та верифікація JWT-токенів |
| `@nestjs/passport` | Інтеграція бібліотеки Passport.js з NestJS |
| `passport` | Middleware для автентифікації (peer dependency) |
| `passport-jwt` | Стратегія Passport для перевірки JWT з заголовка `Authorization` |
| `bcrypt` | Хешування та порівняння паролів |
| `@types/passport-jwt` | TypeScript-типи для `passport-jwt` |
| `@types/bcrypt` | TypeScript-типи для `bcrypt` |

---

## Структура модуля авторизації

```
src/
├── app.module.ts                          ← підключено ConfigModule та AuthModule
├── auth/
│   ├── auth.controller.ts                 ← маршрути: register, login, profile
│   ├── auth.module.ts                     ← конфігурація JwtModule, PassportModule
│   ├── auth.service.ts                    ← бізнес-логіка реєстрації та входу
│   ├── jwt.strategy.ts                    ← Passport JWT-стратегія
│   ├── dto/
│   │   ├── register.dto.ts                ← DTO для реєстрації
│   │   └── login.dto.ts                   ← DTO для входу
│   └── entities/
│       └── user.entity.ts                 ← TypeORM-сутність користувача
└── tables/
    └── interfaces/
        ├── jwt-payload.interface.ts       ← інтерфейс payload JWT-токена
        └── user-request.interface.ts      ← розширений Express Request з полем user
```

---

## Детальний опис змін

### `src/app.module.ts`

Підключено `ConfigModule.forRoot()` (глобальне зчитування `.env`) та `AuthModule`:

```typescript
imports: [ConfigModule.forRoot(), TablesModule, TypeormModule, AuthModule]
```

---

### `src/auth/entities/user.entity.ts`

TypeORM-сутність `User` з автоматичним хешуванням пароля перед збереженням:

- `@BeforeInsert()` — хешує пароль через `bcrypt.hash(password, 10)` до запису в БД
- `validatePassword(password)` — порівнює відкритий пароль з хешем через `bcrypt.compare`

---

### `src/auth/dto/register.dto.ts` та `login.dto.ts`

DTO для валідації тіла запитів. Обидва містять поля:
- `username: string`
- `password: string`

Валідація через `@IsString()` (бібліотека `class-validator`).

---

### `src/auth/auth.service.ts`

Сервіс містить два публічні методи:

- **`register(registerDto)`** — створює нового користувача в БД (пароль хешується автоматично через `@BeforeInsert`)
- **`login(loginDto)`** — перевіряє credentials, повертає `{ access_token: string }`
- **`validateUser(username, password)`** (приватний) — знаходить користувача в БД та перевіряє пароль. Кидає `UnauthorizedException` при невалідних даних

---

### `src/auth/jwt.strategy.ts`

Passport-стратегія для верифікації JWT:

- Витягує токен з заголовка `Authorization: Bearer <token>`
- Зчитує `JWT_SECRET` з конфігурації через `ConfigService`
- Метод `validate(payload)` повертає payload, який потрапляє в `req.user`

---

### `src/auth/auth.module.ts`

Конфігурація модуля:

- `PassportModule.register({ defaultStrategy: 'jwt' })` — встановлює JWT як стратегію за замовчуванням
- `JwtModule.registerAsync(...)` — асинхронна конфігурація: зчитує `JWT_SECRET` та `JWT_EXPIRATION_TIME` з `.env` через `ConfigService`
- `TypeOrmModule.forFeature([User])` — підключає репозиторій `User`

---

### `src/auth/auth.controller.ts`

Контролер з базовим шляхом `/auth`:

| Метод | URL | Опис |
|---|---|---|
| `POST` | `/auth/register` | Реєстрація нового користувача |
| `POST` | `/auth/login` | Вхід, повертає `access_token` |
| `GET` | `/auth/profile` | Захищений маршрут — повертає дані з JWT payload |

Маршрут `/auth/profile` захищений через `@UseGuards(AuthGuard('jwt'))`.

---

### `src/tables/interfaces/jwt-payload.interface.ts`

Інтерфейс для JWT payload:

```typescript
export interface IJWTPayload {
  userId: number;
  username: string;
}
```

---

### `src/tables/interfaces/user-request.interface.ts`

Розширений інтерфейс Express `Request` з полем `user` типу `IJWTPayload`:

```typescript
export interface UserRequest extends Request {
  user: IJWTPayload;
}
```

Використовується у захищених маршрутах для типізованого доступу до `req.user`.

---

## Змінні оточення (`.env`)

Файл `.env` у корені проєкту:

```env
JWT_SECRET=<ваш_секретний_ключ>
JWT_EXPIRATION_TIME=3600
```

| Змінна | Призначення |
|---|---|
| `JWT_SECRET` | Секрет для підпису JWT (рядок) |
| `JWT_EXPIRATION_TIME` | Час життя токена в секундах (наприклад `3600` = 1 година) |

---

## Запуск проєкту

### 1. Запустити базу даних MySQL через Docker

```bash
docker-compose up -d
```

Піднімає контейнер MySQL 8 з такими параметрами:
- БД: `my-nestjs-test`
- Користувач: `user` / `user`
- Root-пароль: `superpass`
- Порт: `3307:3306`

### 2. Встановити залежності

```bash
npm install
```

### 3. Запустити додаток у режимі розробки

```bash
npm run start:dev
```

---

## Приклади запитів

### Реєстрація

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "john", "password": "secret"}'
```

### Вхід

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "john", "password": "secret"}'
```

Відповідь:
```json
{ "access_token": "<JWT_TOKEN>" }
```

### Захищений маршрут

```bash
curl http://localhost:3000/auth/profile \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

Відповідь:
```json
{ "userId": 1, "username": "john" }
```
