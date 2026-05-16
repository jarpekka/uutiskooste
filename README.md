# Uutiskooste Vercel

Tämä on Vercel-yhteensopiva versio paikallisesta uutiskoostesovelluksesta.

## Paikallinen testaus

```bash
node server.js
```

Avaa sen jälkeen:

```text
http://127.0.0.1:4174
```

## Rakenne

```text
api/
  digest.js       Vercel API: koosteen muodostus
  sources.js      Vercel API: alueet ja lähteet
lib/
  digest.js       uutisten haku, suodatus, deduplikointi ja Markdown
  sources.js      sallittu lähdelista
public/
  index.html
  styles.css
  app.js
server.js         kevyt paikallinen kehityspalvelin
vercel.json       Vercel-asetukset
```

## Deploy Verceliin GitHubin kautta

1. Luo uusi GitHub-repositorio.
2. Lisää tämän kansion sisältö repositorioon.
3. Avaa Vercel Dashboard.
4. Valitse Add New -> Project.
5. Valitse GitHub-repositorio.
6. Framework Preset: Other.
7. Root Directory: tämän sovelluksen kansio, jos repo sisältää muutakin.
8. Build Command: jätä tyhjäksi.
9. Output Directory: jätä tyhjäksi.
10. Deploy.

## Deploy Vercel CLI:llä

Jos Vercel CLI on asennettu:

```bash
cd "/Users/jarieklund/Documents/New project/uutiskooste-vercel"
vercel login
vercel
vercel --prod
```

Ensimmäisessä `vercel`-komennossa valitse:

- Set up and deploy: yes
- Link to existing project: no, ellei projekti ole jo Vercelissä
- Framework preset: Other
- Build command: tyhjä
- Output directory: tyhjä

## iPad-käyttö

Kun deploy on valmis, Vercel antaa osoitteen kuten:

```text
https://oma-projekti.vercel.app
```

Avaa osoite iPadin Safarissa. Voit lisätä sen kotinäytölle valitsemalla Share -> Add to Home Screen.

## Huomio

Vercel Functions -ympäristössä pitkä uutishaku voi aikakatkaista, jos moni lähde hidastelee yhtä aikaa. Sovellus jättää yksittäisiä epäonnistuvia lähteitä pois ja näyttää puutteet koosteen lopussa.
