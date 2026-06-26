# Electro Task Manager API

Small mock REST API for the Flutter interview task. It is dependency-free and runs with Node.js 18+.

## Run

```bash
npm start
```

The API runs at:

```text
http://localhost:3000
```

For Android emulator, use this base URL in Flutter:

```text
http://10.0.2.2:3000
```

For iOS simulator:

```text
http://localhost:3000
```

## Demo Account

```text
email: demo@electro.dev
password: Password123
```

## Endpoints

```text
GET  /health

POST /api/auth/register
POST /api/auth/login
GET  /api/me

GET  /api/projects
GET  /api/projects?status=pending
POST /api/projects
GET  /api/projects/:id
GET  /api/projects/:id/tasks
POST /api/projects/:id/tasks

PATCH /api/tasks/:id
PATCH /api/tasks/:id/done
```

Protected endpoints require:

```text
Authorization: Bearer <token>
```

## Request Examples

Login:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@electro.dev","password":"Password123"}'
```

Create task:

```bash
curl -X POST http://localhost:3000/api/projects/project_1/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"title":"Connect Flutter screen","priority":"high"}'
```

Create project:

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"title":"New Project","description":"Project description","status":"pending"}'
```

## Response Shape

Most list/detail endpoints return:

```json
{
  "data": {}
}
```

Auth endpoints return:

```json
{
  "token": "...",
  "user": {
    "id": "user_1",
    "name": "Hatem Elbadwy",
    "email": "demo@electro.dev"
  }
}
```

Validation errors return:

```json
{
  "message": "Validation failed",
  "errors": {
    "title": "title is required"
  }
}
```
