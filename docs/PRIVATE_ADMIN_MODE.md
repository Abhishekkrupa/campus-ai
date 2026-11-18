# Temporary Private Admin Mode

`ADMIN_ONLY_MODE` restricts the Campus AI backend to the existing verified
super administrator while the deployment is private. It is a temporary,
reversible switch — no database changes, no new users and no credentials are
created.

## What changes when enabled

With `ADMIN_ONLY_MODE=true` on the backend:

| Area | Behaviour |
| --- | --- |
| `GET /api/health` | Public, unchanged (Render health check). |
| `GET /api/config` | Public, returns `{ "privateMode": true }` so the UI can show private copy. This flag is **not** used for authorization. |
| `POST /api/auth/login` | Still public, but a token is issued only after credentials are valid **and** the database row is a verified, active `SUPER_ADMIN`. |
| Any registration route | Returns `403` with code `PRIVATE_MODE_REGISTRATION_DISABLED`. No user is created. |
| Every other `/api/*` request | Passes through a centralized guard that resolves the bearer token against PostgreSQL and requires a verified, active `SUPER_ADMIN`. Older sessions are rejected with `403` and code `PRIVATE_MODE_ADMIN_REQUIRED`. |
| Frontend `/register` | Shows **Private Admin Access** instead of the signup form. Signup links and demo credential buttons are removed. |

Authorization is enforced in `src/middleware/privateMode.js` before any router,
and re-checked in `src/controllers/prismaAuthController.js` for login and
registration. Identity is always loaded from the `User` row with
`role === 'SUPER_ADMIN'`, `status === 'active'`, `isVerified === true` and
`verificationStatus === 'approved'`. Role values from tokens, request bodies,
headers or frontend environment variables are never trusted.

The only verified administrator already in Supabase continues to work. No
other user is modified, suspended or deleted.

## Render configuration

`render.yaml` now declares:

```yaml
- key: ADMIN_ONLY_MODE
  value: "true"
```

If the Render service was created before this change, add the variable manually
in the Render dashboard (**Environment → Environment Variables**):

- Key: `ADMIN_ONLY_MODE`
- Value: `true`

Then redeploy the backend. To exit private mode, set the value to `false` and
redeploy; no data cleanup is required.

No other environment variable needs to change. Do **not** add any admin
email/password variables — mode does not create or expose credentials.

## Validation

```bash
cd backend
npm ci
npm run prisma:generate
npm run prisma:validate
npm test
```

The test suite uses a mocked Prisma client (no production data is touched) and
covers: public health/config, blocked registration, verified admin login,
non-admin and unverified-admin login denial, existing non-admin sessions on
protected and admin endpoints, forged role claims, and successful admin access.

Frontend build:

```bash
cd frontend
npm ci
npm run build
```

## Quick deployed smoke check

Once the backend has redeployed:

```bash
curl https://<render-service>.onrender.com/api/health
curl https://<render-service>.onrender.com/api/config
# expected: {"status":"ok",...} and {"privateMode":true}

curl -i -X POST https://<render-service>.onrender.com/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","username":"test","email":"test@example.com","password":"x"}'
# expected: HTTP 403, code PRIVATE_MODE_REGISTRATION_DISABLED

curl -i https://<render-service>.onrender.com/api/posts
# expected: HTTP 401 (no token)
```

A full authenticated check requires signing in with the existing verified
super admin's own credentials through the normal login page; no credentials are
stored in this repository.
