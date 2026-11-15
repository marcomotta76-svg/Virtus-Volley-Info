# Virtus Caserta — Volley Info

Applicazione informativa installabile su Android e iPhone (PWA), stagione 2026/27.

## Funzionalità

- Home con prossima partita, risultati recenti e squadra preferita.
- Ricerca squadre Virtus e avversarie nei campionati seguiti.
- Calendario per squadra e campionato; schede delle gare con parziali e palestre.
- Classifiche FIPAV ufficialmente pubblicate.
- Consultazione offline degli ultimi dati salvati; nessun account richiesto.

La grafica utilizza l'icona Volley Info selezionata (opzione 1) e lo stemma Virtus originale fornito, ottimizzati in versioni leggere per le schermate dei cellulari.

## Pubblicazione su GitHub Pages

Repository: https://github.com/marcomotta76-svg/Virtus-Volley-Info

1. Se si utilizza GitHub Free, rendere **pubblico** il repository tramite **Settings → General → Danger Zone → Change repository visibility**.
2. Aprire **Settings → Pages** e impostare **Build and deployment → Source: GitHub Actions**.
3. Aprire **Actions → Pubblica Volley Info Virtus Caserta** e fare **Run workflow**, oppure pubblicare una modifica su main.
4. Dopo la conclusione positiva, l'app sarà raggiungibile tramite l'URL mostrato da GitHub Pages (normalmente https://marcomotta76-svg.github.io/Virtus-Volley-Info/).

Se GitHub Pages è già abilitato con un piano che consente repository privati, si può mantenere quella visibilità, tenendo presente che l'URL del sito e i contenuti pubblicati possono comunque essere accessibili pubblicamente.

## Installazione sul cellulare

Android: aprire il sito con Chrome → menu ⋮ → Installa app / Aggiungi a schermata Home.

iPhone: aprire con Safari → Condividi → Aggiungi alla schermata Home.

## Dati

Lo script `importer/sync.py` legge il feed pubblico indipendente `https://kushnirandriy-droid.github.io/app-pallavolo/data.json`, i cui dati derivano dai portali FIPAV Caserta e Campania. Il workflow `.github/workflows/pages.yml` tenta di aggiornarli ogni tre ore. Se il feed non risponde, la pubblicazione conserva la copia già validata nel repository; l'app mantiene una cache locale.

Fotografia iniziale importata: 9 campionati/gironi che coinvolgono Virtus Caserta, 60 squadre e 246 gare. Data della fotografia: 15/11/2026 22:41 (ora italiana). **Sette gironi** hanno un calendario parziale delle avversarie, esplicitamente segnalato nell'app. Non sono presenti dati inventati.

I risultati visualizzati non sono punteggi live e possono arrivare in ritardo rispetto alla partita.

## Sviluppo

- `index.html`, `app.js`, `style.css`: applicazione mobile-first.
- `source_adapter.js`: conversione di emergenza dal feed pubblico via browser.
- `data.json`: ultima fotografia valida.
- `sw.js`, `manifest.webmanifest`: installazione e cache offline.
- `icons/icon-source.png`: icona base della PWA; GitHub Actions genera le dimensioni richieste.
- `logos/virtus_caserta_original.png`: stemma Virtus per le squadre.
- `importer/sync.py`: acquisizione e conversione del feed.
