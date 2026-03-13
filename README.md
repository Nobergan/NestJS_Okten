# NestJS — JWT авторизація з refresh/logout та зберіганням токенів у БД

## Що було зроблено в цій гілці

- **Додано повноцінну підтримку пари access/refresh токенів**
- **Додано сутність `Token` та звʼязок `User` ⇄ `Token` у БД**
- **Реалізовано маршрути `POST /auth/refresh` та `POST /auth/logout`**
- **JWT-стратегія тепер перевіряє токен по `jti` у таблиці `Token` і враховує блокування**
- **Час життя токенів керується через змінні оточення, а не через конфіг `JwtModule`**

---

## Встановлені залежності

```bash
npm install @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
npm install -D @types/passport-jwt @types/bcrypt
```

- **`@nestjs/config`**: робота зі змінними оточення, `.env`
- **`@nestjs/jwt`**: створення та верифікація JWT
- **`@nestjs/passport` / `passport` / `passport-jwt`**: інтеграція Passport + JWT стратегія
- **`bcrypt`**: хешування паролів
- **`@types/*`**: typings для TypeScript

---

## Структура модуля авторизації (оновлена)

```text
src/
├── app.module.ts
├── auth/
│   ├── auth.controller.ts                 ← маршрути: register, login, profile, refresh, logout
│   ├── auth.module.ts                     ← JwtModule без expiresIn, репозиторії User + Token
│   ├── auth.service.ts                    ← робота з access/refresh токенами, logout
│   ├── jwt.strategy.ts                    ← перевірка токена по jti в БД
│   ├── dto/
│   │   ├── register.dto.ts
│   │   ├── login.dto.ts
│   │   └── refresh-token.dto.ts           ← DTO для refresh/logout
│   ├── entities/
│   │   ├── user.entity.ts                 ← User + звʼязок one-to-many з Token
│   │   └── token.entity.ts                ← сутність токенів
│   └── interfaces/
│       └── tokens.interface.ts            ← інтерфейс для пари токенів
└── tables/
    └── interfaces/
        ├── jwt-payload.interface.ts       ← payload з додатковим полем jti
        └── user-request.interface.ts
```

---

## Зміни по файлах

### `src/auth/auth.controller.ts`

- Додано імпорт `RefreshTokenDto`.
- Додано маршрути:
  - `POST /auth/refresh` — приймає `refreshToken`, повертає оновлену пару токенів.
  - `POST /auth/logout` — блокує переданий `refreshToken` у БД (користувач виходить з системи).

### `src/auth/auth.module.ts`

- `JwtModule.registerAsync` тепер налаштовується тільки з `secret`:
  - час життя токенів більше НЕ задається тут, а передається при `jwtService.sign(...)` у сервісі.
- `TypeOrmModule.forFeature([User, Token])` — підключено репозиторій `Token` разом з `User`.

### `src/auth/auth.service.ts`

- Додано інʼєкцію:
  - репозиторію `Token`;
  - `ConfigService`.
- Додано приватні поля:
  - `accessTokenExpiresIn` — читається з `ACCESS_TOKEN_EXPIRATION_TIME`;
  - `refreshTokenExpiresIn` — читається з `REFRESH_TOKEN_EXPIRATION_TIME`.
- **Метод `login` тепер повертає `ITokens`**:
  - генерується випадковий `jti`;
  - підписуються `accessToken` і `refreshToken` з різними `expiresIn`;
  - обидва токени зберігаються в таблиці `Token` через приватний метод `saveTokens(...)` разом з датами закінчення, `jti` і користувачем.
- **Новий метод `refresh`**:
  - читає `refreshToken` з `RefreshTokenDto`;
  - валідує JWT через `jwtService.verify<IJWTPayload>(refreshToken)`;
  - шукає в БД запис `Token` з цим refresh-токеном, `isBlocked = false` та повʼязаним користувачем;
  - перевіряє, чи `refreshTokenExpiresAt` ще не минув;
  - блокує старий запис (`isBlocked = true`);
  - генерує нову пару access/refresh з новим `jti`, зберігає їх у БД та повертає.
- **Новий метод `logOut`**:
  - шукає запис `Token` по значенню `refreshToken`;
  - якщо знайшов — ставить `isBlocked = true` і зберігає, таким чином розлогінюючи сесію.

### `src/auth/dto/refresh-token.dto.ts`

- Новий DTO для refresh/logout:

```typescript
export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}
```

### `src/auth/entities/token.entity.ts`

- Нова сутність `Token` з полями:
  - `accessToken: string`;
  - `refreshToken: string`;
  - `accessTokenExpiresAt: Date`;
  - `refreshTokenExpiresAt: Date`;
  - `isBlocked: boolean` (default `false`);
  - `jti: string`;
  - `user: User` — звʼязок `ManyToOne` на користувача.

### `src/auth/entities/user.entity.ts`

- До існуючої логіки (хешування пароля через `@BeforeInsert` і `validatePassword`) додано:

```typescript
@OneToMany(() => Token, (token) => token.user)
tokens: Token[];
```

Це дозволяє зберігати і переглядати всі токени, видані користувачу.

### `src/auth/interfaces/tokens.interface.ts`

- Новий інтерфейс результату логіну/refresh:

```typescript
export interface ITokens {
  accessToken: string;
  refreshToken: string;
}
```

### `src/auth/jwt.strategy.ts`

- Додано інʼєкцію репозиторію `Token`.
- У методі `validate`:
  - по `payload.jti` шукається запис у таблиці `Token` з `isBlocked = false`;
  - якщо запис не знайдено — кидається `UnauthorizedException('Token is blocked or invalid')`;
  - при успіху повертається payload (користувач вважається авторизованим).

Таким чином, якщо токен заблокований (logout/refresh), запити з ним більше не пройдуть перевірку в стратегії.

### `src/tables/interfaces/jwt-payload.interface.ts`

- Оновлений payload JWT тепер має вигляд:

```typescript
export interface IJWTPayload {
  userId: number;
  username: string;
  jti: string;
}
```

---

## Змінні оточення (`.env`)

Актуальний мінімальний набір для авторизації:

```env
JWT_SECRET=<ваш_секретний_ключ>
ACCESS_TOKEN_EXPIRATION_TIME=900          # 15 хвилин, приклад
REFRESH_TOKEN_EXPIRATION_TIME=2592000     # 30 днів, приклад
```

- **`JWT_SECRET`** — секрет для підпису JWT.
- **`ACCESS_TOKEN_EXPIRATION_TIME`** — час життя access-токена в секундах.
- **`REFRESH_TOKEN_EXPIRATION_TIME`** — час життя refresh-токена в секундах.

---

## Команди, які використовуються в проєкті

### База даних (MySQL через Docker)

```bash
docker-compose up -d
```

- Підіймає контейнер MySQL 8 у фоні з параметрами:
  - БД: `my-nestjs-test`;
  - користувач: `user` / пароль `user`;
  - root-пароль: `superpass`;
  - порт: `3307:3306`.

### Встановлення залежностей

```bash
npm install
```

- Встановлює всі npm-залежності проєкту.

### Запуск застосунку в режимі розробки

```bash
npm run start:dev
```

- Запускає NestJS-додаток у dev-режимі з автоматичним перезапуском при зміні коду.

### HTTP-запити (через `curl`)

#### Реєстрація користувача

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "john", "password": "secret"}'
```

#### Вхід (отримання пари токенів)

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "john", "password": "secret"}'
```

Очікувана відповідь:

```json
{ "accessToken": "<ACCESS_JWT>", "refreshToken": "<REFRESH_JWT>" }
```

#### Оновлення токенів (`/auth/refresh`)

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<REFRESH_JWT>"}'
```

Повертає нову пару `accessToken` / `refreshToken`, а старий refresh позначається заблокованим у БД.

#### Logout (`/auth/logout`)

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<REFRESH_JWT>"}'
```

Позначає переданий refresh-токен як заблокований. Після цього він не може бути використаний для оновлення сесії.

#### Захищений маршрут `/auth/profile`

```bash
curl http://localhost:3000/auth/profile \
  -H "Authorization: Bearer <ACCESS_JWT>"
```

При валідному access-токені повертає payload користувача.

---

## Коротко про поточну реалізацію

- **Access-токен** живе відносно недовго і використовується для кожного запиту.
- **Refresh-токен** живе довше, зберігається в таблиці `Token`, має унікальний `jti` і може бути заблокований.
- **Logout/refresh** працюють не просто на рівні "забути токен на клієнті", а фізично блокують запис у БД, тому старі токени стають недійсними.
