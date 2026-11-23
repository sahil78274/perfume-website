# SCENTORA

Full-stack perfume storefront with a React/Vite customer experience, COD checkout, and a protected admin dashboard. The backend is Node.js/Express with MongoDB; production serves the built single-page app from the same origin.

## Requirements

- Node.js 18.17 or newer
- npm
- MongoDB (local or MongoDB Atlas)

## Quick start

```sh
cp .env.example .env
# Set MONGODB_URI and a random JWT_SECRET (at least 32 characters) in .env
npm run setup
npm run seed
npm run create-admin
npm run dev
```

`npm run dev` runs the API at `http://localhost:5000` and Vite at `http://localhost:5173`; Vite proxies `/api` to the API. Open the Vite URL for development. Create the first admin using the `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` values in `.env`; `npm run create-admin` reads those values and writes the account to MongoDB.

## Production

```sh
npm install
npm --prefix client install
npm run build
npm start
```

The Express server listens on `PORT` (default `5000`) and serves `client/dist`, including the React SPA fallback. Deploy the server and its dependencies together with the generated `client/dist` folder. Set `NODE_ENV=production`, `MONGODB_URI`, and a strong `JWT_SECRET`. Configure Cloudinary for admin product-photo uploads and SMTP settings for transactional email; both integrations are optional, but their features are skipped/disabled if they are not configured. Same-origin hosting does not require `CORS_ORIGIN` or `CLIENT_URL`.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run API and Vite together |
| `npm run dev:server` | Run only the API |
| `npm run dev:client` | Run only Vite |
| `npm run build` | Build the React application into `client/dist` |
| `npm start` | Start the API / production server |
| `npm run seed` | Idempotently seed catalogue and default store settings |
| `npm run create-admin` | Create the initial admin account |
| `npm test` | Run the server-side and catalogue tests |

## Environment

See [`.env.example`](.env.example) for the full list. The minimum required values to boot the API are `MONGODB_URI` and a `JWT_SECRET` of at least 32 characters. Do not commit `.env` or production secrets.

## Project layout

- `client/` — React storefront and admin UI (Vite)
- `client/public/images/` — product photos and favicon served at `/images/...`
- `server/` — Express API, MongoDB models, controllers, routes, and setup scripts
- `server/scripts/seed.js` — launch catalogue and default settings

The API health endpoint is `GET /api/health`. Admin pages are under `/admin`; the customer storefront is served from `/`.
