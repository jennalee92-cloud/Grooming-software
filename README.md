# Grooming Desk

Grooming Desk is the first industry module for a planned multi-industry business operations platform. The product requirements and Phase 0 findings are in [PHASE-0-AUDIT.md](PHASE-0-AUDIT.md).

## Current milestone

The initial Next.js application scaffold is in `web/`. It currently contains a responsive workspace overview and a Supabase setup guide. The database, authentication, business records, and row-level security are **not connected or implemented yet**. The overview intentionally shows no sample customer data.

Do not enter real customer, pet, employee, or business information in this preview.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```powershell
cd web
npm install
npm run dev
```

Open the local URL printed by Next.js, normally `http://localhost:3000`.

Quality checks:

```powershell
npm run lint
npm run build
```

## Supabase setup status

No Supabase project has been connected. When one is available:

1. Copy `web/.env.example` to `web/.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` using the project URL and public client key.
3. Keep service-role keys, passwords, and other secrets out of browser code, chat, and Git.

Adding these values alone will not enable data persistence. Supabase client integration, schema migrations, authentication, tenant isolation policies, and security tests must be implemented and verified before real data is used.

## Repository

The local Git remote is intended to be `https://github.com/jennalee92-cloud/Grooming-software.git`. The repository is not pushed automatically; review changes before committing or pushing.