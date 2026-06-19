# House Passport

Boligens digitale servicebog — en enterprise-grade, multi-tenant SaaS-platform, der
samler boligdokumentation, vedligeholdelse, garantier, servicehistorik og
verificerede ejerdata ét sted, og som lader mæglere, banker, forsikringer og
håndværkere trække pålidelige boligdata med boligejerens samtykke.

Dette repository indeholder **hele projektet**: forretnings- og designanalyse,
systemarkitektur, den fungerende backend-API med sikkerhedsfundament og tests,
en designprototype, samt drift (Docker/CI).

> **Status:** Fundamentet + dele af Sprint 1 er bygget (multi-tenant-sikkerhed,
> dokument-pipeline med crypto-shredding, MitID-verificeringsflow, bolig-onboarding).
> Eksterne integrationer (auth, S3, kø, AI, BBR, MitID-broker) kører pt. som
> udskiftelige mock-adaptere. Se docs/06-Roadmap-MVP-Sprint.md for vejen til MVP.

---

## Repository-struktur

```
house-passport/
├── README.md                  · dette dokument
├── LICENSE                    · proprietær (udskift før offentliggørelse)
├── Dockerfile                 · multi-stage build af API'et
├── docker-compose.yml         · Postgres (pgvector) + API med auto-bootstrap
├── .env.example               · miljøvariabler
├── package.json / tsconfig*   · NestJS-app
├── prisma/
│   ├── schema.prisma          · domænemodel (Bolig som varig rod, ejerskab, grants)
│   └── sql/security.sql       · RLS-policies (to mønstre), pgvector, app-rolle
├── src/
│   ├── tenant/                · transaction-lokal tenant-kontekst (RLS) + middleware
│   ├── auth/                  · AuthProvider-abstraktion (Clerk/Auth0/MitID)
│   ├── identity/              · MitID-broker + ejerverificering
│   ├── registry/              · BBR/Datafordeleren- + ejerregister-adaptere
│   ├── storage/               · envelope-kryptering + crypto-shredding
│   ├── queue/                 · async besked-kø (Redis pub/sub i prod, in-memory lokalt)
│   ├── redis/                 · delt Redis-forbindelse (kø/cache/rate limiting)
│   ├── ai/                    · OCR, klassificering, metadata, embeddings
│   ├── properties/            · bolig-onboarding, listning, ejerskifte
│   ├── documents/             · upload + async ingestion-pipeline
│   ├── health/                · /health (DB + Redis) til health checks
│   ├── demo/                  · demo-session (kun DEMO_MODE) — seeder live data
│   └── common/                · guards mv.
├── public/                    · forside (statisk UI serveret på /)
├── test/                      · RLS-isolation, skrive-policies, kryptering, matchning
├── .github/workflows/ci.yml   · typecheck + tests som blokerende gate
├── docs/                      · komplet analyse- og designgrundlag (Trin 1–17)
└── design/                    · klikbar UI-prototype (React)
```

---

## Hurtig start

### Med Docker (alt på én gang)

```bash
cp .env.example .env
docker compose up --build
```

api-servicen migrerer databasen, påfører RLS som admin og starter derefter
appen, der forbinder som den begrænsede rolle hp_app.

Åbn **http://localhost:3000** i browseren — forsiden viser House Passport-
brugerfladen (dashboard) med en live status-indikator, der kalder `/health`.
API'et lever under `/v1`. Med `DEMO_MODE=true` viser **Start demo**-knappen
en rigtig bolig: backenden opretter en verificeret demo-bruger med dokumenter,
og forsiden tegner dem live (uploads kører gennem den asynkrone pipeline).
Deaktivér `DEMO_MODE` i produktion.

### Lokalt (udvikling)

```bash
cp .env.example .env
docker compose up -d db          # kun databasen
npm install
DATABASE_URL="$ADMIN_DATABASE_URL" npx prisma db push --skip-generate
npm run prisma:generate
DATABASE_URL="$ADMIN_DATABASE_URL" npm run db:security
npm run start:dev                # API på :3000
```

> **Vigtigt:** migrationer + security.sql køres som **admin** (ejer tabellerne).
> Appen og testene forbinder som **hp_app** (NOSUPERUSER) — ellers omgås RLS.

---

## API (mock-token = personId[:orgId])

| Metode | Rute | Handling |
|---|---|---|
| GET  | / | Forside (landing page) |
| GET  | /app/ | Appen (henter live data fra API'et) |
| POST | /v1/dev/session | Demo-session (kun DEMO_MODE) — opretter bruger + seedet bolig |
| GET  | /health | Status for DB + Redis (til Coolify health check) |
| GET  | /v1/properties | List boliger (RLS-filtreret) |
| POST | /v1/properties | Onboard bolig fra { "address": "..." } |
| POST | /v1/properties/:id/verification/initiate | Start MitID-flow → { redirectUrl } |
| GET  | /v1/auth/mitid/callback | MitID-broker callback → sætter verificeret |
| POST | /v1/properties/:id/transfer | Tilbyd ejerskifte til en købers e-mail |
| GET  | /v1/properties/:id/transfers | Sælgers afventende tilbud |
| GET  | /v1/transfers/incoming | Tilbud rettet til mig (køber) |
| POST | /v1/transfers/:id/accept | Køber accepterer → atomisk overdragelse |
| POST | /v1/transfers/:id/cancel | Sælger annullerer tilbud |
| GET/POST | /v1/properties/:id/shares | Vis/giv adgang (deling via AccessGrant) |
| DELETE | /v1/properties/:id/shares/:grantId | Fjern adgang |
| POST | /v1/properties/:id/documents | Upload (+ Idempotency-Key) → 202 |
| GET  | /v1/properties/:id/documents/:docId/status | Behandlingsstatus |
| GET  | /v1/properties/:id/overview | Oversigt: score, dokumenter, opgaver, garantier, tidslinje |
| GET/POST | /v1/properties/:id/tasks | Vedligeholdelsesopgaver (liste/opret) |
| POST | /v1/properties/:id/tasks/:taskId/complete | Fuldfør opgave (gentager hvis interval) |
| GET/POST | /v1/properties/:id/warranties | Garantier (liste/opret) |
| DELETE | /v1/properties/:id/documents/:docId | GDPR-sletning via crypto-shredding |

```bash
curl -XPOST -H "Authorization: Bearer <pid>" -H "Content-Type: application/json" \
     -d '{"address":"Æblevej 12, 8000 Aarhus"}' http://localhost:3000/v1/properties
```

---

## Bærende arkitekturprincipper

- **Boligen er den varige rod — ikke brugeren.** Ejerskab er en tidsrelation; dokumenter/historik hænger på boligen. Det muliggør ejerskifte-overdragelsen (vækstmotoren).
- **Hybrid multi-tenancy via to RLS-mønstre.** Org-data isoleres på org_id; boligdata er et delt commons tilgået via samtykkebaserede grants. Aldrig blandet.
- **RLS er sidste forsvarslinje.** Services forespørger uden ejer-/adgangs-where; PostgreSQL-policies filtrerer. En applikationsfejl kan ikke lække en anden boligs data — og det bevises i CI.
- **At logge ind ≠ at bevise ejerskab.** MitID-verificering matcher identiteten mod det autoritative ejerregister; det verificerede flag er dét, B2B betaler for.
- **Alt eksternt bag adaptere.** Auth, MitID-broker, registre, storage, kø og AI kan skiftes uden kerneændringer (internationalisering + leverandørvalg).
- **Async, idempotent dokument-pipeline** dimensioneret til 10 mio.+ dokumenter, med envelope-kryptering og crypto-shredding.

---

## Deploy på Coolify

Repoet er Coolify-klart med PostgreSQL (pgvector) og Redis.

**Anbefalet: Docker Compose-ressource**

1. Opret en ny ressource i Coolify → **Docker Compose**, og peg på dette repo (branch `main`).
2. Coolify læser `docker-compose.yml` og starter `db` (pgvector), `redis` og `api`.
3. Sæt env-variabler i Coolify (override af compose-defaults):
   - `POSTGRES_DB`, `POSTGRES_ADMIN_USER`, `POSTGRES_ADMIN_PASSWORD` (stærke værdier)
4. Sæt **health check path** til `/health` på `api`-servicen.
5. Map dit domæne til `api` (port 3000).

`api`-servicen kører selv bootstrap ved opstart: `prisma db push` + `security.sql`
(RLS) som admin, hvorefter appen starter som den begrænsede `hp_app`-rolle.

> **pgvector er påkrævet.** Brug den medfølgende `db`-service (pgvector-image).
> Hvis du i stedet bruger en separat managed Postgres, skal `vector`-extensionen
> være tilgængelig.

**Alternativ: Dockerfile + separate ressourcer.** Deploy `api` via `Dockerfile`,
opret separate Postgres- og Redis-ressourcer i Coolify, og sæt `DATABASE_URL`,
`ADMIN_DATABASE_URL` og `REDIS_URL` som env. Kør bootstrap (`db:push` + `db:security`)
som et release-step.


### Coolify: nødvendige miljøvariabler

Uanset om du deployer via Dockerfile eller Docker Compose, skal disse sættes i Coolify:

| Variabel | Eksempel / krav |
|---|---|
| `DATABASE_URL` | `postgresql://hp_app:hp_app_pw@<db-host>:5432/house_passport?schema=public` (appen — RLS) |
| `ADMIN_DATABASE_URL` | admin/**superuser**-forbindelse — bruges til bootstrap (skema + RLS + rolle + extension) |
| `REDIS_URL` | Durabel Redis Streams-kø (ellers in-memory) —  `redis://<redis-host>:6379` |
| `DEMO_MODE` | `false` i produktion (`true` seeder en demo-bolig) |
| `JWT_SECRET` | Stærk, stabil hemmelighed til at signere login-tokens |
| `S3_*` | S3-kompatibelt fil-lager (ellers in-memory) |
| `KMS_MASTER_KEY` | Durabel envelope-KMS (kræves i prod for vedvarende dekryptering) |
| `OPENAI_API_KEY` | AI-dokumentbehandling (ellers mock) |
| `ADMIN_EMAILS` | Allowlist der bootstrapper admin-brugere (adgang til /admin/) |
| `PORT` | `3000` |

Containeren bootstrapper sig selv ved opstart (entrypoint): den kører `prisma db push`
+ `security.sql` som admin (med retry til databasen er klar) og starter derefter appen
som `hp_app`. Health check path: `/health`.

> **To krav til databasen:** (1) `ADMIN_DATABASE_URL`-brugeren skal kunne `CREATE ROLE`
> og `CREATE EXTENSION` (typisk superuser), da `security.sql` opretter `hp_app`-rollen og
> `vector`-extensionen. (2) **pgvector skal være tilgængelig.** Den medfølgende
> `docker-compose.yml` opfylder begge (pgvector-image + superuser). Bruger du en separat
> managed Postgres i Coolify, så sørg for pgvector og tilstrækkelige rettigheder — ellers
> er **Docker Compose-ressourcen den nemmeste vej** (alt selvindeholdt).


---

## Test

```bash
npm run typecheck       # 0 fejl
npm run test:unit       # kryptering + ejer-matchning (ingen DB)
npm run test:isolation  # RLS cross-tenant + skrive-policies (kræver Postgres)
```

CI (.github/workflows/ci.yml) kører alle tre som **blokerende gate** — en
svækkelse af tenant-isolationen gør pull requesten rød.

---

## Dokumentation (det fulde grundlag, Trin 1–17)

| Fil | Indhold |
|---|---|
| docs/00-Oversigt.md | Samlet indeks + de bærende beslutninger |
| docs/01-Analyse.md | Produkt-, markeds- og konkurrentanalyse |
| docs/02-Arkitektur-Domaenemodel.md | Systemarkitektur + domænemodel |
| docs/03-Database-API-MultiTenant.md | Database-design, API-design, multi-tenant |
| docs/04-Sikkerhed-GDPR.md | Sikkerheds- & GDPR-arkitektur |
| docs/05-Design.md | Wireframes, UI-designsystem, komponenter, brugerrejser |
| docs/06-Roadmap-MVP-Sprint.md | Roadmap, MVP-afgrænsning, sprintplan, implementeringsplan |

---

## Næste skridt mod produktion

1. ✓ Login (JWT) + ✓ MitID-ejerverificering (OIDC, authorization code + PKCE — simuleret uden broker, rigtig med Criipto/Signaturgruppen). Næste: JWKS-signaturverifikation af id_token, CPR-baseret ejer-match mod tinglysning.
2. ✓ Fil-lagring (S3-kompatibel + durabel envelope-KMS) og ✓ AI-dokumentbehandling (OpenAI: OCR/klassificering/metadata/embeddings). ✓ PDF-tekstudtræk og ✓ semantisk søgning/“spørg dine dokumenter” (RAG). ✓ Ejerskifte ved salg (moaten): tilbud→accept, boligen overdrages med hele servicebogen, sælgers delinger lukkes, køber MitID-verificerer på ny. Resterende: audit-log, afventende invitationer, fuld AWS KMS, PDF-OCR for scannede sider, metrics/tracing.
3. Audit-modul (append-only, hash-kæde) på tværs af alle skrivninger.
4. Produktions-frontend (Next.js) wired mod API'et — prototypen i design/ som reference.
5. ISO 27001/SOC 2-forberedelse forud for enterprise-salg.

---

## Licens

Proprietær — se LICENSE.
