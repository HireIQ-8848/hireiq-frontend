# HireIQ frontend

React 18 and Vite frontend for the HireIQ identity, recruitment, and interview
workflows. It talks to the separately deployed HireIQ FastAPI service.

## Run this component

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Set the public Supabase URL and publishable key before signing in. Keep
`VITE_API_URL` and `VITE_INTERVIEW_API_URL` empty for local development: Vite
proxies `/api` and `/health` to `DEV_API_TARGET` (port 8000 by default).

Build and preview the production bundle with:

```bash
npm run build
npm run preview
```

Only variables prefixed with `VITE_` reach browser code. Never put the
Supabase service-role key or JaaS private key in this directory.

## Deploy to Vercel

Import `HireIQ-8848/hireiq-frontend` into Vercel. Keep the project Root
Directory at `./` and select the Vite framework preset; `vercel.json` runs
`npm run build`, publishes `dist`, and provides the SPA fallback route.

Add these variables to Vercel's Production and Preview environments:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
VITE_API_URL=https://your-public-hireiq-api.example.com
VITE_INTERVIEW_API_URL=https://your-public-hireiq-api.example.com/api/v1
VITE_JAAS_APP_ID=your-jaas-app-id
```

After the first deployment, add the production Vercel URL to Supabase
Authentication → URL Configuration and to the backend CORS allowlist. Frontend
environment variables are embedded at build time, so redeploy after changing
an API URL. Never expose the Supabase service-role key, database credentials,
or `XAI_API_KEY` through a `VITE_` variable.
