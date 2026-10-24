# Origo – oppituntitila

Konseptiprototyyppi lukion suljetusta oppimisympäristöstä, joka toimisi osana Origoa. Opettaja aloittaa oppitunnin luokalleen, opiskelijat liittyvät siihen yhdellä napilla, ja tunnin ajan kaikki tarvittava on yhdessä koko näytön tilassa. Opettaja näkee reaaliajassa, kuka on paikalla ja kuka poistuu.

> **Konseptiesittely.** Origon Luokat- ja Kurssikirjat-näkymät on mallinnettu, jotta oppituntitilan paikka palvelussa näkyy. Tämä ei ole Origon virallinen palvelu.

## Tiedostot

| Tiedosto | Sisältö |
|---|---|
| `index.html` | Koko prototyyppi yhtenä tiedostona (HTML, CSS ja JavaScript) |
| `docs/origo-oppituntinappi.html` | Mallikuva siitä, mihin "Aloita oppitunti" -nappi sijoittuu Origon luokkasivulla |

## Kulku

1. **Opettaja** avaa Origon Luokat-näkymän, valitsee luokan ja painaa **Aloita oppitunti**.
2. **Opiskelijan** Origo-näkymän sivupalkkiin ilmestyy **Liity oppitunnille: luokan nimi**. Napin painaminen avaa oppituntitilan koko näytölle.
3. Opettaja seuraa luokkaa: paikalla, sallitussa ohjelmassa (esim. TI-Nspire), poistunut tai ei paikalla. Jokaisesta yli 5 sekunnin poistumisesta tulee ilmoitus.
4. Kun opettaja päättää tunnin, opiskelijat palaavat automaattisesti Origo-näkymään ja saavat tuntikoosteen. Opettajalle tallentuu tuntiraportti.

Ylälaidan **Demo**-palkista voi vaihtaa opettajan ja opiskelijan näkymän välillä.

## Ominaisuudet

**Opiskelija**
- Origo-kirjat (MAA3, FY1, ENA1), luvut ja itsetarkistuvat tehtävät
- Materiaalit, tehtävät, läksyt ja projektit määräaikoineen, opettajan muistiinpanot
- Teksti-, taulukko- (kaavat, esim. `=SUMMA(A1:A5)`) ja esitystyökalu, palautus opettajalle
- Tekoälyapu, joka ohjaa ajattelemaan eikä anna valmiita vastauksia
- Viestit opettajalle ja avunpyyntö, lukukuittaukset
- Oma tilanne: läsnäolo, poistumiset ja tehtävät (opettaja näkee samat tiedot)
- Liittyminen luokkaan 6-merkkisellä koodilla

**Opettaja**
- Opiskelijalista: tehdyt tehtävät, palautukset, tila, läsnäolo-%, poistumiset ja poissaoloaika
- Poistumisilmoitukset ja tapahtumaloki, lyhyiden katkosten suodatus
- Pikaviestit näytölle ja "Katse tänne"
- Keskustelut opiskelijoiden kanssa
- Sallitut ohjelmat ja palvelut, joiden käyttö ei ole poistumista
- Tuntiraportit, joissa korostetaan matala läsnäolo ja toistuvat poistumiset
- Esittelytila: 24 kuvitteellista opiskelijaa simuloituine tiloineen

## Tekninen toteutus

Prototyyppi on tehty Claude-artefaktiksi. Tallennus, reaaliaikainen läsnäolo, käyttäjätiedot ja tekoälyapu tulevat claude.ai:n artefaktiympäristön palveluista (`window.claude.use("db" | "room" | "user" | "sample")`).

**Jos `index.html` avataan muualla, kuten GitHub Pagesissa tai suoraan selaimessa, käyttöliittymä näkyy, mutta tallennus, luokat, reaaliaikainen seuranta, viestit ja tekoälyapu eivät toimi.** Toimiva versio vaatii joko claude.ai-ympäristön tai oman taustapalvelun (esim. tietokanta, WebSocket-yhteys ja tekoäly-API).

### Tietomalli

| Polku | Sisältö | Lukuoikeus |
|---|---|---|
| `courses/<id>` | luokka: nimi, kirja, liittymiskoodi, sallitut ohjelmat | kaikki |
| `live/<luokka>` | oppitunti käynnissä, aihe, alkamisaika | kaikki |
| `materials`, `tasks`, `notes` | luokan sisältö (`courseId`) | kaikki |
| `enroll/<opiskelija>` | edistyminen ja reaaliaikainen tila | opettaja ja opiskelija itse |
| `enroll/<opiskelija>/subs/<id>` | palautukset ja opettajan kommentit | opettaja ja opiskelija itse |
| `viestit/<opiskelija>` | `{ nimimerkki, kurssi, viimeisin: { t, kuka, teksti, apu }, oppilasLuki, opettajaLuki }` | opettaja ja opiskelija itse |
| `viestit/<opiskelija>/m/<viesti>` | `{ t, kuka: "oppilas" \| "opettaja", teksti, apu }` | opettaja ja opiskelija itse |
| `reports/<id>` | tuntiraportti | opettaja |
| `data/users/<opiskelija>/…` | omat tekstit, taulukot, esitykset, vastaukset ja liitytyt luokat | vain opiskelija |

### Oppituntitilan avaaminen Origosta

Origon nappi on tavallinen linkki:

```
<oppituntitilan osoite>#oppitunti-<luokan tunniste>
```

## Rajoitukset

- Selain ei voi estää Alt + Tab -näppäinyhdistelmää. Esc ja F11 estetään koko näytön tilassa Chromessa ja Edgessä. Origo tunnistaa poistumiset ja ilmoittaa niistä opettajalle. Varsinainen esto vaatii laitehallinnan tai erillisen kokeselaimen.
- Sallitun ohjelman käyttö perustuu opiskelijan painallukseen, koska selain ei näe toisen ohjelman sisälle.
- Liittymiskoodi pitää opiskelijan luokkalistan siistinä, mutta se ei ole pääsynhallintaa.
- Origo-kirjojen sisältö on esimerkkiaineistoa.
