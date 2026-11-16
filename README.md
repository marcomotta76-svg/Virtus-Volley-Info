# Virtus Caserta — Volley Info

App informativa installabile su Android e iPhone (PWA), dedicata esclusivamente a Virtus Caserta e alle sue avversarie.

## Come aprirla sul telefono

[Apri Volley Info](https://marcomotta76-svg.github.io/Virtus-Volley-Info/).

- Android (Chrome): menu ⋮ → Installa app / Aggiungi a schermata Home.
- iPhone (Safari): Condividi → Aggiungi alla schermata Home.

La PWA include Home, ricerca di tutte le squadre nei gironi seguiti, scelta della squadra Virtus preferita, calendari, risultati, classifiche, dettagli delle gare e navigazione alle palestre.

## Acquisizione autonoma FIPAV

**Non utilizza feed di terzi, né il feed dell'app Kushnir.**

Il sistema `importer/direct.py` legge direttamente:
- [FIPAV Caserta](https://caserta.portalefipav.net/), calendari completi e classifiche di otto gironi provinciali.
- [FIPAV Campania](https://www.fipavcampania.it/mobile/), calendario, classifica e pagine di dettaglio della Serie D femminile, girone C.

Il workflow `.github/workflows/pages.yml` aggiorna il sito automaticamente ogni tre ore, con controllo del formato e della coerenza dei dati. Se una fonte non risponde o un girone risulta illeggibile, il workflow fallisce e **non sostituisce la copia valida già pubblicata**.

Le date e i parziali del campionato regionale provengono direttamente dalle pagine delle gare; quando disponibili vengono riutilizzati dalla precedente copia **già acquisita autonomamente** per limitare le richieste.

Un giro diretto completo di test del 16 novembre 2026 ha trovato 9 gironi, 60 squadre, 400 gare e 156 date regionali. Altri campionati richiedono un aggiornamento della configurazione per le stagioni successive.

**I dati non sono punteggi live.** Una partita non viene considerata conclusa solo perché è trascorso l'orario d'inizio.

## Struttura

- `index.html`, `app.js`, `style.css`: interfaccia mobile-first.
- `manifest.webmanifest`, `sw.js`: installazione e cache offline.
- `logos/` e `icons/`: stemma Virtus e icona Volley Info (proposta 1).
- `importer/direct.py`: scraper autonomo, validazione, import e conservazione dei dati.
- `importer/probe.py`: test diagnostico delle due fonti ufficiali.
- `data.json`: ultima fotografia pubblicata verificata; la provenienza deve avere `method: direct-fipav`.

## Limiti e rispetto delle fonti

L'importazione dipende dai portali ufficiali FIPAV, che possono modificare il formato delle pagine. Le richieste sono sequenziali e limitate; non sono effettuate da ogni smartphone. La classifica è letta dai siti FIPAV, non ricalcolata da dati eventualmente incompleti.

L'app non richiede login, non contiene chat, convocazioni, registrazioni o scouting.
