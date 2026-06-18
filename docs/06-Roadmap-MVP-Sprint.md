# House Passport — Trin 14–17
## Roadmap · MVP-afgrænsning · Sprintplan · Teknisk implementeringsplan

> Leverance 6 af 17 — den sidste planlægningsleverance før Trin 18 (udvikling).
> Forankret i de strategiske beslutninger fra Trin 1–3: moaten (håndværker-pipeline + ejerskifte), monetisering (B2B2C, ikke ren B2C-abonnement) og distribution (partnerskab som MVP-forudsætning).

---

# TRIN 14 — ROADMAP

Tematisk roadmap, ikke en featureliste. Hver fase har ét strategisk formål.

| Fase | Formål | Kerneindhold | Exit-kriterie |
|---|---|---|---|
| **0 · Validering** (uge 0–6) | Afkræft de 4 kritiske antagelser (Trin 1.5) *før* stor udvikling | Betalingsvilligheds-test, håndværker-interviews, BBR-dataaftale undersøgt, mindst én distributionspartner i dialog | Go/no-go på MVP-investering |
| **1 · MVP** (mdr. 2–5) | Bevis kerneværdi + first distribution | Auto-onboarding (BBR), dokumentcenter + AI-klassificering, vedligeholdelsesplan + påmindelser, basal deling, **tynd håndværker-upload (open API)**, **let ejerverificering**, 1 partnerpilot | Aktive boliger via partner + målt retention/betalingssignal |
| **2 · Moat + monetisering** (mdr. 5–9) | Gør det svært at kopiere + start indtægt | Fuld MitID-broker + ejerverificering, ejerskifte-overdragelse, første pro-portal (mægler), premium-/B2B-betaling, webhooks | Betalende org-tenant + verificeret ejerskifte i drift |
| **3 · Portaler + integrationer** (mdr. 9–15) | Bredere B2B + dataindtag | Bank-/forsikrings-/håndværkerportaler, integrationer v2 (Dropbox, iCloud, Datafordeleren, energimærker), kalendersync | Flere B2B-segmenter i drift |
| **4 · Skala + enterprise + intl.** (mdr. 15+) | Enterprise-salg + nyt land | ISO 27001/SOC 2, enterprise-isolation, integrationer v3 (banker/realkredit/forsikring), adapter til land #2 | Enterprise-kontrakt + pilot i nyt marked |

**Afvigelser fra briefet (med vilje):**
- **MitID og håndværker-pipeline rykkes frem** fra "efter MVP/fremtidig" til fase 1–2, fordi de *er* moaten og verificeringsfundamentet (Trin 1.6, Trin 9.2).
- **Distribution behandles som fase 0-forudsætning**, ikke et senere salgsspor.

---

# TRIN 15 — MVP-AFGRÆNSNING

Den sværeste disciplin er at sige nej. MVP skal teste **kerneværdi + betalingssignal + en tynd skive af moaten** — intet andet.

## 15.1 I MVP (in scope)

- **Auto-onboarding:** adresse → BBR/energimærke/vurdering → boligprofil + dokumentationsgrad.
- **Dokumentcenter:** upload, async AI-pipeline (OCR, kategori, metadata, garantiperioder), søgning.
- **Vedligeholdelsesplan:** genereret fra boligtype/alder; opgaver + påmindelser.
- **Basal deling:** `AccessGrant` for samlever/gæst/håndværker (person- og org-grant).
- **Tynd håndværker-upload:** den åbne integrationskontrakt (Trin 7.5) + manuel partner-onboarding. *Begrænset, men moaten starter her.*
- **Let ejerverificering:** selvhævdet + uverificeret-flag (fuld MitID i fase 2).
- **Én distributionspartner-pilot** (mægler eller bank).
- **Sikkerhedsfundament:** RLS + tenant-kontekst + CI-isolationstests (kan ikke eftermonteres — Trin 17).

## 15.2 Eksplicit UDE af MVP (men designet til)

| Udskudt | Hvorfor |
|---|---|
| Fuld MitID-broker | Tungt integrationsarbejde; uverificeret-flag rækker til at teste værdi |
| Alle pro-portaler | Byg én (mægler) i fase 2, ikke fire på én gang |
| Ejerskifte-overdragelse | Kræver MitID-verificering først (fase 2) |
| Integrationer v2/v3, GraphQL, dark mode | Ikke værdibærende for MVP-hypotesen |
| Enterprise-isolation, ISO/SOC2 | Først når enterprise-pipeline er reel (fase 4) |

## 15.3 MVP-hypotesen (det vi måler)

> "Boligejere onboardet via en distributionspartner forbliver aktive (lav churn) og udviser betalingssignal for salgs-/verificeringsfunktioner — og mindst én håndværker(partner) vil tilføre data."

Hvis denne hypotese fejler, er det billigere at vide det efter fase 1 end efter at have bygget alle 17 trin.

---

# TRIN 16 — SPRINTPLAN (MVP)

Antagelser: tværfunktionelt team (2–3 fullstack, 1 design, 1 AI/data, delt DevOps), 2-ugers sprints, ~12 uger til MVP-launch + buffer. Sikkerhedsfundament *før* features.

| Sprint | Tema | Nøgleleverancer |
|---|---|---|
| **0** | Fundament | Monorepo, CI/CD, IaC, miljøer, observability (Sentry/Datadog), auth-skelet, **RLS + tenant-kontekst + isolations-CI-tests** |
| **1** | Bolig-kerne | `Property`-modul, BBR/registry-adapter, adressesøgning, auto-onboarding-flow, onboarding-UI |
| **2** | Dokumenter (sync-del) | Upload, S3 + envelope-kryptering, dokumentcenter-UI, versionering, transferabilitet |
| **3** | AI-pipeline (async) | Kø + workers, OCR, kategori/metadata, pgvector + indeksering, dokumentationsgrad |
| **4** | Vedligehold + deling | Vedligeholdelsesplan-generator, opgaver + påmindelser, `GrantDialog` + consent |
| **5** | Moat-skive + partner | Åben håndværker-API + webhooks, mægler-/partner-pilotflow, let ejerverificering, AI-assistent (v1) |
| **6** | Hærdning + launch | Pentest, perf/skalatest (burst-import), a11y-gennemgang, pilot-onboarding, beta-launch |

Dependency-rygraden: Sprint 0 (sikkerhed) → 1 (bolig) → 2/3 (dokumenter+AI) → 4 (vedligehold/deling) → 5 (moat/partner) → 6 (launch).

---

# TRIN 17 — TEKNISK IMPLEMENTERINGSPLAN

Rækkefølgen, tingene faktisk bygges i — drevet af ét princip:

> **Det, der ikke kan eftermonteres, bygges først.** Multi-tenant-isolation, tenant-kontekst og RLS er umulige at lime på bagefter uden at risikere lækage. Derfor er sikkerhedsfundamentet rod nr. 1 — før nogen feature.

### Lag 1 — Fundament (ufravigeligt først)
Monorepo + modulgrænser (Trin 4) · IaC (AWS, EU-region) · CI/CD (GitHub Actions) med SAST/DAST/SCA/secret-scan · observability · auth-skelet (føderér MitID-broker, byg ikke IdP) · **RLS-policies + transaction-lokal tenant-kontekst (Trin 6.7) + automatiserede cross-tenant negative tests som hård gate.**

### Lag 2 — Domænekerne
`Property` som rod + `ownership_period` (med partial unique index, Trin 6.2) · BBR/Datafordeleren-adapter bag interface (Trin 4.6) · `AccessGrant` + consent.

### Lag 3 — Dokumenter & AI
Upload + S3 envelope-kryptering · async, idempotent pipeline (kø + workers) · OCR/metadata/klassificering · pgvector bag `RetrievalService` · OpenSearch-indeksering · crypto-shredding-sletteflow.

### Lag 4 — Værdi-features
Vedligeholdelsesplan + påmindelser + kalender · dokumentationsgrad/score · AI-assistent (retrieval gennem grant-RLS).

### Lag 5 — Moat & B2B
Åben håndværker-/partner-API + signerede webhooks · mægler-pro-portal · fuld MitID-ejerverificering · ejerskifte-overdragelse · billing (org & ejer).

### Lag 6 — Hærdning & skala
Pentest · burst-/skalatest mod 1 mio. boliger/10 mio. docs · partitionsstrategi verificeret · backup/restore-øvelse · a11y · launch.

### Tværgående hele vejen
Audit-log fra dag ét · feature flags · GDPR-artefakter (ROPA, DPIA) opdateres løbende · omkostningsovervågning på AI-pipeline (Trin 4.8-risiko).

---

## Afslutning — fra plan til byggeri (Trin 18)

Alle 17 planlægnings- og designtrin er nu leveret. Trin 18 (udvikling) starter præcis ét sted: **Lag 1 — sikkerheds- og multi-tenant-fundamentet med CI-isolationstests**, fordi det er det eneste, der er katastrofalt at få forkert og umuligt at eftermontere.

**Tre beslutninger bør træffes inden første commit:**
1. **Auth-leverandør:** Clerk vs. Auth0-klassen (Trin 4.8) — hybrid tenancy + MitID + enterprise trækker mod Auth0-klassen.
2. **BBR/Datafordeleren-dataaftale:** pris, latens, rate-limits — påvirker onboarding-løftet direkte (fase 0-opgave).
3. **Første distributionspartner:** hvilket segment (mægler/bank/forsikring) piloterer vi med? Det former både fase 1-portalen og GTM.

**Den ærlige bundlinje fra hele forløbet:** Produktet er valideret (Boligmappa), og arkitekturen kan bære 1 mio.+ boliger. De afgørende risici er *ikke* tekniske — de er **betalingsvillighed, datatilførsel (håndværkere) og distribution.** Roadmappet er bygget til at angribe netop dem først.
