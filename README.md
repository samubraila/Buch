# 📚 LeseWelt – Lesen · Übersetzen · Aussprechen

[![Bauen & Veröffentlichen](https://github.com/samubraila/Buch/actions/workflows/pages.yml/badge.svg)](https://github.com/samubraila/Buch/actions/workflows/pages.yml)

Lese-App für Laptop und Handy. Tippe auf ein Wort → du bekommst sofort die **russische Übersetzung**
(Zielsprache einstellbar) und hörst die **richtige Aussprache** (Englisch US/UK, Deutsch und weitere Sprachen).

## Starten

**Online (Handy & Laptop):** https://samubraila.github.io/Buch/
→ Auf dem Handy öffnen und „Zum Startbildschirm hinzufügen" / „App installieren" wählen.

<img src="docs/handy-qr.png" alt="QR-Code zur App" width="160">

📱 **Handy-Test Schritt für Schritt: [TESTEN.md](TESTEN.md)**

**Lokal am Laptop:** `start.bat` doppelklicken → der Browser öffnet http://localhost:8080

**Handy (gleiches WLAN):** Im schwarzen Startfenster steht eine Adresse wie
`http://192.168.x.x:8080` – diese im Handy-Browser öffnen.
Falls es nicht lädt: Windows-Firewall fragt beim ersten Start → „Zugriff zulassen" (privates Netzwerk).

> Hinweis: Über die WLAN-Adresse funktioniert alles zum Lesen und Übersetzen, aber die
> **Installation als App** und der **Offline-Modus** brauchen HTTPS – dafür die Online-Adresse
> (GitHub Pages) oben verwenden. Jeder `git push` auf `main` baut und aktualisiert die Online-Version automatisch (GitHub Actions, ca. 1–2 Min.).

## So benutzt du die App

| Aktion | Was passiert |
|---|---|
| **Wort antippen** | Übersetzung + Alternativen, Aussprache (normal / langsam), Lautschrift, Satz im Kontext |
| **Satz übersetzen** | Knopf im Wort-Fenster übersetzt den ganzen Satz |
| **Text markieren** (lange drücken / mit der Maus ziehen) | Leiste „Übersetzen / Anhören" für die ganze Stelle |
| **⭐ Stern** | Wort ins Vokabelheft (mit Satz aus dem Buch) |
| **Wischen / Pfeiltasten / Rand antippen** | Seite umblättern |
| **Mitte antippen** | Menüleisten ein-/ausblenden |
| **🎧 Kopfhörer-Symbol** | Kapitel vorlesen lassen, aktueller Satz wird markiert |
| **Aa** | Thema (Hell/Sepia/Dunkel/Schwarz), Schrift, Größe, Zeilenabstand, Rand, Seiten/Scrollen, Buchsprache |

## Formate

EPUB · FB2 / FB2.ZIP (auch russische Windows-1251-Dateien) · PDF (mit Text, nicht eingescannt) · TXT · HTML ·
eingefügter Text.

Kostenlose Bücher: [Standard Ebooks](https://standardebooks.org) (Englisch),
[Project Gutenberg](https://www.gutenberg.org) (Englisch, Deutsch, …).

## Vokabelheft

- Alle gespeicherten Wörter mit Übersetzung, Kontext, Buch
- **Trainieren**: Karteikarten mit Wiederholung nach 1 / 2 / 4 / 8 / 16 … Tagen
- Export als CSV (z. B. für Anki), Sicherung/Wiederherstellung als JSON

## Aussprache – Tipps für beste Qualität

- **Automatisch** (Standard): beste Stimme des Geräts, sonst natürliche Online-Stimme
- Bei englischen Wörtern gibt es oft **echte Aufnahmen** (Knöpfe „US" / „UK")
- Bessere Gerätestimmen: Windows → Einstellungen → Zeit & Sprache → Sprache → Sprachpaket;
  iPhone → Bedienungshilfen → Gesprochene Inhalte → Stimmen („Premium"); Android → Sprachausgabe → Google

## Technik

Reines HTML/CSS/JavaScript ohne Build-Schritt. Daten liegen nur lokal im Browser (IndexedDB).
Übersetzung: Google Translate → Ersatz MyMemory → Chrome-Offline-Übersetzer; Ergebnisse werden zwischengespeichert.
Wörterbuch: dictionaryapi.dev (Lautschrift, Aufnahmen), Wiktionary (Bedeutungen).

```
index.html, css/app.css, sw.js, manifest.webmanifest
js/app.js          Navigation
js/reader.js       Leser (Blättern, Wort-Erkennung, Vorlesen)
js/popup.js        Übersetzungs-Fenster
js/translate.js    Übersetzungsdienste
js/speech.js       Aussprache
js/dict.js         Wörterbuch
js/library.js      Bibliothek
js/vocab*.js       Vokabelheft + Training
js/parsers/*       EPUB, FB2, PDF, TXT/HTML
```
