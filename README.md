# HireIQ frontend

React 18 and Vite frontend for the HireIQ identity, recruitment, and interview
workflows. It talks to the single FastAPI service in `../backend`.

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
