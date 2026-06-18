# House Passport — Trin 1–3
## Produktanalyse · Markedsanalyse · Konkurrentanalyse

> Leverance 1 af 17 i den fastlagte rækkefølge. Skrevet som beslutningsgrundlag for CTO/grundlægger.
> Formålet er ikke at bekræfte briefet, men at trykteste det, før vi bruger ressourcer på arkitektur og design.

---

## 0. Eksekutivt resumé (læs dette først)

House Passport-konceptet er validt og veldokumenteret — men det er **bevist i Norge, ikke opfundet her.** Den norske tjeneste *Boligmappa* er stort set det samme produkt: "boligens servicehæfte", 900.000+ indloggede brugere og boligmapper på 2+ mio. ejendomme. Det fjerner produktrisikoen ("vil folk have det?") og flytter hele spillet over på tre langt sværere spørgsmål:

1. **Hvor kommer dataene fra?** Den værdifulde del af en boligs historik (servicehistorik, garantier, hvem-gjorde-hvad) findes ikke i noget register. Den skal *skabes*. Boligmappa vandt, fordi **håndværkere uploader automatisk** og mappen er koblet til **ejendomsregistret, så den følger boligen ved salg.** Det er moaten — ikke appen.

2. **Hvem betaler — og hvornår?** Boligmappa er **gratis** (finansieret af brancheorganisationer). Briefets antagelse om høj abonnementsindtægt fra *private boligejere* er den største forretningsrisiko. En boligejer mærker akut værdi ca. hvert 7.–9. år (ved salg). Det giver svag betalingsvillighed og høj churn i en ren B2C-abonnementsmodel.

3. **Hvordan distribueres det?** Et produkt, der bruges sjældent, har dyr og langsom organisk vækst. Vinderkanalen er næsten med sikkerhed **partnerskaber ved transaktionsøjeblikke** (mægler ved salg, bank ved låneoptag, forsikring ved skade, håndværker ved udført arbejde) — ikke D2C-markedsføring.

**Konsekvens for resten af projektet:** Briefet er stærkt på *produkt og design*, men undervægter *datatilførsel, betalingsvillighed og distribution* — de tre ting der faktisk afgør, om virksomheden bliver 100 mio. kr. værd. Mine anbefalinger nedenfor justerer roadmap-prioriteringen, ikke visionen.

---

## 1. Produktanalyse

### 1.1 Problemet (Jobs To Be Done)

En boligejer ansætter House Passport til at løse fire jobs — i stigende værdi, men faldende hyppighed:

| Job | Hyppighed | Smerteniveau | Betalingsvillighed |
|---|---|---|---|
| "Hvor lagde jeg den kvittering/garanti/farvekode?" | Løbende, lav | Lav–mellem | Lav |
| "Hvornår skal jeg vedligeholde hvad?" | Sæsonbestemt | Mellem | Lav–mellem |
| "Jeg har en forsikrings-/reklamationssag og skal bevise noget" | Sjælden | **Høj** | **Høj (i øjeblikket)** |
| "Jeg skal sælge og dokumentere boligen" | Hvert 7.–9. år | **Meget høj** | **Meget høj (i øjeblikket)** |

**Kerneindsigt:** Den daglige værdi er for lav til at drive betaling. Den høje betalingsvillighed sidder i sjældne, akutte øjeblikke. Et produkt, der kun er en "pæn dokumentmappe", monetiserer aldrig godt. Et produkt, der **ejer transaktions- og forsikringsøjeblikket**, gør.

### 1.2 Værdiproposition (skarpere end briefet)

Briefet formulerer det som "boligens digitale servicebog". Det er korrekt, men det er en *feature-beskrivelse*, ikke en købsårsag. Den skarpere version:

> **"Sælg din bolig hurtigere og dyrere — og undgå reklamationssager — fordi alt er dokumenteret, verificeret og klar."**

Det binder produktet til de to øjeblikke med reel betalingsvillighed og gør "den daglige mappe" til et middel, ikke et mål.

### 1.3 Den hårde sandhed om "5 minutter til færdig boligprofil"

Briefets onboarding lover maksimal automatisering på <5 min. Det er kun delvist muligt:

- **Kan auto-hentes (offentligt):** BBR-stamdata, adresse, energimærke, ejendomsvurdering, ~50 datapunkter via ejendomsdatainfrastrukturen. → God "wow"-effekt.
- **Kan IKKE auto-hentes (findes ikke digitalt):** servicehistorik, garantier, hvilken håndværker der lagde taget i 2014, kvitteringer i en skuffe. → Det er præcis den data, der giver salgs- og forsikringsværdien.

**Risiko:** Hvis vi sælger "5 minutter til en komplet boligprofil", leverer vi en profil, der ser komplet ud, men er tom på det vigtigste. Det skaber skuffelse og churn.

**Anbefaling:** Skift løftet fra *"komplet på 5 minutter"* til *"i gang på 5 minutter — komplet over tid, automatisk når du bruger håndværkere."* Design "tomhed" som en motiverende fremdriftsindikator (en *Vedligeholdelsesscore* / *Dokumentationsgrad*), ikke som et tomt dashboard.

### 1.4 Brugersegmenter — reelt rangordnet

Briefets primær/sekundær-opdeling er rigtig, men jeg vil omdøbe den til **betalere vs. brugere**, fordi det ofte ikke er samme part:

- **Bruger (lav betaling):** boligejeren. Vigtig for data og netværkseffekt, men svag som indtægtskilde.
- **Betaler (høj betaling):** mægler (vil have salgsklar dokumentation), bank/realkredit (vil have verificeret pant- og energidata), forsikring (vil reducere svig og skadesomkostninger), håndværker (vil have lead-flow og dokumentationspligt opfyldt).

Dette er afgørende for monetisering og påvirker hele arkitektur- og rolledesignet (Trin 4–8). Det understøtter i øvrigt briefets stærke krav om ægte multi-tenancy.

### 1.5 Kritiske antagelser der SKAL valideres før stor udvikling

1. Vil danske boligejere overhovedet *betale* for dette, når den norske ækvivalent er gratis? (Sandsynligvis: nej for basis, ja for "salgsklar"-funktioner.)
2. Kan vi få håndværkere til at uploade? Uden det er produktet en manuel scrapbog. (Sværeste antagelse.)
3. Kan vi få lovlig, skalerbar adgang til BBR/ejendomsdata til auto-onboarding?
4. Vil mindst én distributionspartner (mæglerkæde, bank, forsikring) ind tidligt? Uden distribution dør produktet uanset kvalitet.

### 1.6 Produktrisici & anbefalinger

| Risiko | Vurdering | Anbefaling |
|---|---|---|
| Ren B2C-abonnement har svag betalingsvillighed | **Høj** | Byg B2B2C-monetisering ind fra arkitekturfasen; behandl forbruger-abonnement som vækst-/data-motor, ikke hovedindtægt |
| Cold-start: værdifuld data findes ikke | **Høj** | Prioritér håndværker-datapipeline (i briefet er den "fremtidig" — den bør være kerne) |
| "Sjælden brug" → høj churn | **Høj** | Skab tilbagevendende kroge: vedligeholdelsespåmindelser, kalender, sæson-nudges, årligt bolig-"helbredstjek" |
| Tillidsbrist (følsomme dokumenter) | Mellem | Tidlig MitID-ejerverificering + synlig sikkerhed som salgsargument, ikke kun compliance |

---

## 2. Markedsanalyse (Danmark)

### 2.1 Markedsstørrelse

- Danmark har **ca. 3,03 mio. boliger** i alt (kilde: Danmarks Statistik / din-bolighandel, 2024–2025), heraf ca. 2,83 mio. beboede.
- Den samlede danske boligværdi løber op i tusinder af mia. kr. — boligen er husstandens største aktiv. (Nationalregnskabet opgjorde boligbeholdningen til ~2.466 mia. kr. allerede i 2013; reelt langt højere i dag.)
- Den primære målgruppe (parcel-/villa-/række-/sommerhusejere, ejerboligsegmentet) udgør et **SAM på groft 1,3–1,6 mio. husstande**. (Bør præciseres via et direkte udtræk fra Danmarks Statistik, tabel BOL101, i Trin 2-validering — tallet her er et velbegrundet estimat, ikke en præcis opgørelse.)

**TAM/SAM/SOM-skitse (skal valideres med rigtige tal):**

- **TAM (forbruger, DK):** 1,5 mio. ejerhusstande × realistisk ARPU. Ved gratis-basis er forbruger-TAM ikke abonnement, men data- og transaktionsværdi.
- **SAM (de reelle betalere):** ejendomsmæglere (~hundredvis af kontorer / ~tusinder af mæglere), realkredit-/bankrådgivere, forsikringsselskaber, håndværksvirksomheder. Færre kunder, men 10–100× ARPU.
- **SOM (realistisk 3 år):** 1 distributionspartnerskab + en nichegruppe selvkørende boligejere.

**Strategisk pointe:** Den store *bruger*-volumen er B2C. Den store *omsætning* er B2B. Forretningsmodellen skal bygges på, at brugervolumen gør B2B-dataene værdifulde — en klassisk to-sidet platform.

### 2.2 Medvind (drivkræfter)

- **Regulatorisk dokumentationskrav ved hushandel.** Norge er det stærkeste bevis: ændringer i avhendingsloven (2022) gjorde sælgers dokumentationspligt skarpere og gav Boligmappa kraftig medvind. Danmark har allerede tilstandsrapport, elinstallationsrapport, ejendomsdatarapport og huseftersynsordning — en eksisterende dokumentationskultur at koble sig på.
- **Moden offentlig datainfrastruktur.** BBR, DAR, Datafordeleren og ejendomsdatarapporten (~50 datapunkter, 105 kr.) muliggør automatisk onboarding på en måde, der er svær i mange andre lande.
- **Digital modenhed.** MitID og e-Boks (25 mio. brugere globalt) betyder, at "log ind sikkert og verificér ejerskab" er en løst, kulturelt accepteret mekanik.
- **Bevist nabo-marked.** "Servicebog"-konceptet er allerede valideret i DK — bare for biler: Digital Servicebook har 513.000 registrerede biler og 184.000 brugere på tværs af 6 markeder, integreret i e-Boks. Konceptet "min servicebog" er kulturelt forankret.

### 2.3 Modvind

- **Sjælden brug** → høj CAC i forhold til organisk retention.
- **Gratis substitutter** (e-Boks-mapper, Google Drive, en fysisk ringbind, mæglerens dokumentguide). Vi konkurrerer mod "godt nok og gratis".
- **Norsk gratis-præcedens** kan smitte forventningen om, at "boligens servicebog bør være gratis".
- **Datatilførsel afhænger af tredjepart** (håndværkere, registre) — det er uden for vores direkte kontrol.

### 2.4 International skalering

Modellen er stærkest i lande med (a) høj ejerandel, (b) lovkrav om salgsdokumentation, (c) åben ejendomsdatainfrastruktur og (d) digital ID. **Norden + dele af DACH/Benelux** scorer højt. Briefets internationale ambition er rimelig — men arkitekturen skal abstrahere de landespecifikke registre og ID-løsninger (BBR/MitID i DK) bag en adapter, så ekspansion ikke kræver omskrivning. Dette skal med i Trin 4 (systemarkitektur) som et eksplicit krav.

---

## 3. Konkurrentanalyse

### 3.1 Direkte konkurrenter / koncept-tvillinger

**Boligmappa (Norge) — den vigtigste reference.**
- "Boligens servicehæfte"; samler dokumentation fra håndværkere, ejendomsregister og tidligere/nuværende ejere.
- 900.000+ indloggede brugere; boligmapper på 2+ mio. ejendomme; BankID-login.
- **Gratis** basis, betalt **Boligmappa+** (smarte værktøjer, markedsledende værdiestimat, sikker lagring) → freemium-bevis.
- Moat: kvalificerede håndværkere uploader automatisk; mappen er koblet til ejendomsregistret og **overdrages automatisk til ny ejer ved salg.**
- Ejet af brancheorganisationer (Nelfo, Rørentreprenørene, EFO) + Ambita (statsligt). Det forklarer, hvorfor de kan være gratis — og er en advarsel: hvis en tilsvarende dansk branchekoalition (TEKNIQ, Dansk Håndværk, realkredit) laver noget lignende, bliver det en formidabel konkurrent. **Overvej alliancer frem for ren konkurrence.**

**domusmio (Danmark) — nærmeste direkte danske spiller.**
- Digital "repræsentation" af boligen; automatisk flerårig vedligeholdelsesplan; komponent-/bygningsdelsregistrering; producentanbefalinger.
- Stadig i **pilotprogram** → tidligt, lille, ufærdigt. Det er det vigtigste signal: *vinduet er åbent, men ikke tomt.* Nogen forsøger allerede præcis dette i DK.

### 3.2 Tilstødende / indirekte konkurrenter

| Aktør | Hvad de gør | Trussel/mulighed |
|---|---|---|
| **Digital Servicebook (Makers)** | Servicebog for biler, e-Boks-integreret, 6 markeder | Kunne udvide til bolig; bevis på modellen; mulig partner |
| **e-Boks** (CataCap-ejet) | National digital postkasse, 25 mio. brugere | Dokumenter "bor" allerede her; konkurrent OG oplagt distributionskanal/integration |
| **EG ProBo / EG Bolig** | Ejendomsadministration, 200.000+ brugere, 6.000+ administratorer | B2B-administration; tilstødende, ikke boligejer-rettet; mulig enterprise-konkurrent i forenings-/administratorsegment |
| **Boligflow** | Bolig-/ejendomsadministration, automatisering | Administrator-/udlejer-fokus; tilstødende |
| **Banker (fx Jyske + Botjek)** | Bundter energi- og boligeftersyn til kunder | Vil ind i boligejer-relationen → både konkurrent og oplagt enterprise-kunde |
| **Mæglere (danbolig, m.fl.)** | Dokumentguides og salgsklargøring | Ejer salgsøjeblikket i dag → kritisk distributionspartner ELLER konkurrent |
| **boligejer.dk / ejendomsdatarapport** | Officiel offentlig datakilde | Ikke konkurrent — en *datakilde* vi integrerer |

### 3.3 White space / positionering

Ingen dansk aktør ejer i dag **hele** kæden: *automatisk offentlig data + brugergenereret historik + håndværkerdokumentation + salgs-/forsikrings-/bankgrænseflader* i ét premium-produkt. domusmio er tættest, men smal (vedligehold) og tidlig. Det er House Passports åbning.

**Positionering:** Ikke "endnu en dokumentmappe", men **"boligens verificerede, salgsklare digitale identitet"** — den platform mæglere, banker og forsikringer trækker pålidelige boligdata fra, og som boligejeren ejer.

### 3.4 De fem strategiske læringer fra Boligmappa

1. **Moaten er datatilførslen (håndværkere + registerkobling), ikke UI.** Prioritér den tidligt.
2. **Overdragelse ved salg = den naturlige vækstmotor.** Når mappen følger boligen, onboardes hver ny ejer gratis. Design dette ind i datamodellen fra dag ét (Trin 5).
3. **Gratis basis kan være nødvendigt for at vinde volumen.** Planlæg monetisering ovenpå volumen (B2B + premium), ikke som adgangsbarriere.
4. **Branchealliancer er en genvej til datatilførsel.** Et dansk håndværker-/realkreditpartnerskab kan være mere værd end produktet selv.
5. **Hvis du ikke bygger det, gør en branchekoalition det måske.** Hastighed og partnerskaber er strategisk vigtigere end feature-fuldstændighed.

---

## 4. Tværgående anbefalinger — beslutninger der bør stå fast før Trin 4

1. **Forretningsmodel:** Flyt tyngden fra B2C-abonnement til **B2B2C / to-sidet platform.** Forbruger-lag driver volumen og data; mæglere/banker/forsikringer/håndværkere driver omsætning. *(Justerer briefets abonnementsafsnit, ikke prisplanerne i sig selv.)*
2. **Moat-prioritering:** Ryk **håndværker-datapipeline + registerbaseret ejerskifte-overdragelse** frem fra "fremtidig portal" til **kernearkitektur.** Det er det eneste, der er svært at kopiere.
3. **MitID tidligere:** Ejerverificering er ikke bare login — det er det, der gør dataene *verificerede* og dermed B2B-værdifulde. Overvej at fremrykke fra "efter MVP".
4. **Distribution før skala:** Behandl mindst ét transaktionspartnerskab (mægler, bank eller forsikring) som en MVP-forudsætning, ikke et senere salgsspor.
5. **Internationalisering = adaptermønster:** Land-specifikke registre og ID bag en abstraktion fra dag ét. Indgår som krav i Trin 4.
6. **Valideringssprint før byggeri:** Bekræft de fire kritiske antagelser (§1.5) — særligt betalingsvillighed og håndværker-upload — før vi commit'er stor udvikling.

---

## 5. Åbne spørgsmål, der påvirker Trin 4–8

- Er den primære "tenant" i multi-tenancy en **husstand** eller en **professionel organisation** (mæglerkæde/bank)? Det ændrer hele tenant-modellen og bør afklares i Trin 8.
- Skal vi sigte mod **branchealliance** (à la Boligmappa) eller **uafhængig venture-vej**? Det påvirker både datatilførsel og værdiansættelse.
- Hvilken **datakilde-aftale** (BBR/Datafordeleren) er realistisk og til hvilken pris/latens? Påvirker onboarding-løftet direkte.

---

*Næste leverance (efter godkendelse): Trin 4 Systemarkitektur + Trin 5 Domænemodel, designet til 1 mio.+ boliger og 10 mio.+ dokumenter, med ovenstående moat- og multi-tenant-beslutninger indbygget.*
