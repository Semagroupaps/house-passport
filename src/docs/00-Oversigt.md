# House Passport — Dokumentationspakke

Komplet design- og planlægningsgrundlag for et enterprise-grade, multi-tenant SaaS-produkt: *boligens digitale servicebog*. Leveret i den fastlagte rækkefølge (Trin 1–17), klar til at udvikling (Trin 18) kan begynde.

## Dokumenter

| # | Trin | Dokument | Indhold |
|---|---|---|---|
| 1 | 1–3 | `House-Passport_Trin-1-3_Analyse.md` | Produkt-, markeds- og konkurrentanalyse |
| 2 | 4–5 | `House-Passport_Trin-4-5_Arkitektur-Domaenemodel.md` | Systemarkitektur + domænemodel |
| 3 | 6–8 | `House-Passport_Trin-6-8_Database-API-MultiTenant.md` | Database-design, API-design, multi-tenant strategi |
| 4 | 9 | `House-Passport_Trin-9_Sikkerhed-GDPR.md` | Sikkerheds- & GDPR-arkitektur |
| 5 | 10–13 | `House-Passport_Trin-10-13_Design.md` | Wireframes, UI-designsystem, komponentbibliotek, brugerrejser |
| 6 | 14–17 | `House-Passport_Trin-14-17_Roadmap-MVP-Sprint-Implementering.md` | Roadmap, MVP, sprintplan, implementeringsplan |

## De fem beslutninger, der bærer hele designet

1. **Boligen er den varige rod — ikke brugeren.** Ejerskab er en tidsrelation oven på boligen. Dette muliggør ejerskifte-overdragelsen, som er vækstmotoren.
2. **Moaten er datatilførsel, ikke UI.** Håndværker-pipeline + registerbaseret ejerskifte er det eneste, en konkurrent ikke nemt kopierer. Rykket frem i roadmap.
3. **Monetisering er B2B2C, ikke ren B2C-abonnement.** Boligejere giver volumen og data; mæglere, banker, forsikringer og håndværkere er de reelle betalere.
4. **Hybrid multi-tenancy via to RLS-mønstre.** Org-data isoleres på `org_id`; boligdata er et delt commons tilgået via samtykkebaserede grants. Aldrig blandet sammen.
5. **Ejerverificering (MitID) er tillidsfundamentet.** At logge ind ≠ at bevise ejerskab. Verificerede data er det, B2B betaler for.

## Strategisk bundlinje

Konceptet er valideret i Norge (Boligmappa: 900.000+ brugere, 2 mio.+ boliger). Arkitekturen er dimensioneret til 1 mio.+ boliger og 10 mio.+ dokumenter. De afgørende risici er ikke tekniske, men forretningsmæssige: **betalingsvillighed, datatilførsel og distribution** — og roadmappet angriber dem først (fase 0-validering før stor udvikling).

## Åbne beslutninger før første commit

1. Auth-leverandør (Clerk vs. Auth0-klassen).
2. BBR/Datafordeleren-dataaftale (pris/latens/rate-limits).
3. Første distributionspartner (mægler/bank/forsikring).
