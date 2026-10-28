# lowpoly-outfit-svc

NestJS API for the separate Next.js `lowpoly-outfit` frontend. It stores model
metadata in Neon Postgres and GLB/thumbnail files in Cloudinary.

## Local setup

Requirements: Node.js 20.9 or newer.

```powershell
npm install
Copy-Item .env.example .env
```

Fill in `.env`:

- `DATABASE_URL`: the pooled connection string from your Neon project.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
  `CLOUDINARY_API_SECRET`: credentials from the Cloudinary console.
- `API_ADMIN_TOKEN`: a long random token used for model uploads and deletion.
  Generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- `CORS_ORIGINS`: comma-separated frontend origins. Local development uses
  `http://localhost:3000`.

Run the checked-in database migration and start the service:

```powershell
npm run db:migrate
npm run start:dev
```

The API listens at `http://127.0.0.1:3001/api/v1`; interactive Swagger docs are
at `http://127.0.0.1:3001/docs`. The OpenAPI contract is in
`postman/specs/lowpoly-outfit.openapi.yaml`; its generated local collection is
in `postman/collections/lowpoly-outfit-svc`. Set `baseUrl` to
`http://localhost:3001/api/v1` and keep the admin token in the collection's
secret `bearerToken` variable.

## Model catalog API

- `GET /api/v1/health`: process liveness.
- `GET /api/v1/models?category=shirt`: public model catalog; category is
  optional. The response contains a `data` array with Cloudinary model URLs.
- `GET /api/v1/models/{id}`: fetch one catalog entry.
- `POST /api/v1/models`: admin-only `multipart/form-data` upload. Send a GLB in
  `model`, a display `name`, and a `category` (`avatar`, `hat`, `shirt`, `pant`,
  `shoes`, or `necklace`). An optional JPEG, PNG, or WebP preview goes in `thumbnail`.
  Include `Authorization: Bearer <API_ADMIN_TOKEN>`.
- `DELETE /api/v1/models/{id}`: admin-only record and Cloudinary asset cleanup.

The API accepts GLB files up to 50 MB and previews up to 5 MB. Catalog reads are
public for the frontend; writes return `503` until `API_ADMIN_TOKEN` is set.
Keep all provider credentials in `.env` or the hosting provider's secret store.

## Import the existing local models

After configuring Neon, Cloudinary, and `API_ADMIN_TOKEN`, start the API and
run this from the service directory. It uploads every GLB under
`lowpoly-outfit/public/models` (including avatars) and matching previews,
skipping catalog entries that are already present:

```powershell
npm run models:import-local
```

## Database changes

Edit `src/database/schema.ts`, then generate and apply a migration:

```powershell
npm run db:generate
npm run db:migrate
```
