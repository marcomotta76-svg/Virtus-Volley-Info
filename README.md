# Volley Info — Virtus Caserta (prova pubblica)

PWA informativa per Android, iOS e desktop. Grafica con logo app scelto (opzione 1) e stemma originale Virtus per le squadre del club.

## Pubblicazione su GitHub Pages

1. Creare un **nuovo repository pubblico** dedicato, ad esempio `volley-info-virtus-caserta`.
2. Caricare i file e le cartelle di questo pacchetto **alla radice** del repository, preservando `.github/workflows/pages.yml`.
3. In **Settings → Pages → Build and deployment**, selezionare **Source: GitHub Actions**.
4. Aprire la sezione **Actions** e verificare che il workflow "Pubblica Volley Info Virtus Caserta" sia terminato correttamente.
5. La pagina sarà all'indirizzo indicato in **Settings → Pages** (tipicamente `https://<account>.github.io/volley-info-virtus-caserta/`).

### Installazione Android
Chrome → aprire il sito HTTPS → menu ⋮ → "Installa app" / "Aggiungi alla schermata Home".

### Installazione iPhone
Safari → Condividi → Aggiungi alla schermata Home.

## Aggiornamento dei dati

La pubblicazione iniziale e i successivi aggiornamenti programmati ogni 3 ore eseguono l'importatore Python. Il sistema:
- legge il feed pubblico indipendente `https://kushnirandriy-droid.github.io/app-pallavolo/data.json`, basato su FIPAV Caserta e Campania;
- prova a completare i 7 gironi provinciali dove il feed iniziale contiene solo le gare Virtus;
- genera `public/data.json` con la data di aggiornamento della fonte;
- non incorpora risultati inventati o dati di test.

Se il collegamento remoto è temporaneamente indisponibile, la PWA prova a interrogare il feed pubblico nel browser e conserva gli ultimi dati validi già letti. Il pulsante aggiorna **non è un live score**. L'operatività del job dipende dalla disponibilità dei siti pubblici e dalla pianificazione best-effort di GitHub Actions.

## Limiti

Il software dipende dai siti FIPAV e da un feed pubblico indipendente. Nei gironi non completamente acquisiti, la ricerca delle avversarie può mostrare solo una parte degli incontri; le classifiche restano quelle della fonte. Non c'è un pannello di inserimento manuale né notifiche push.

I loghi avversari vengono visualizzati quando disponibili. Solo lo stemma Virtus fornito è incorporato.