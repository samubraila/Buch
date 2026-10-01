# 📚 LeseWelt – Lesen · Übersetzen · Aussprechen · Hören

[![Bauen & Veröffentlichen](https://github.com/samubraila/Buch/actions/workflows/pages.yml/badge.svg)](https://github.com/samubraila/Buch/actions/workflows/pages.yml)

Lese- und Sprachlern-App für Laptop und Handy. Tippe auf ein Wort → sofort die **russische Übersetzung**
(Zielsprache einstellbar) und die **richtige Aussprache**. Bücher kannst du dir auch **vorlesen lassen**
oder **echte Hörbücher** hören.

**Version 2.2** – alle Neuerungen: [CHANGELOG.md](CHANGELOG.md) · Plan: [PLAN.md](PLAN.md)

## Starten

**Online (Handy & Laptop):** https://samubraila.github.io/Buch/
→ Auf dem Handy öffnen und „Zum Startbildschirm hinzufügen" / „App installieren" wählen.

<img src="docs/handy-qr.png" alt="QR-Code zur App" width="160">

📱 **Handy-Test Schritt für Schritt: [TESTEN.md](TESTEN.md)**

**Lokal am Laptop:** `start.bat` doppelklicken → der Browser öffnet http://localhost:8080

## 🔄 Immer die neueste Version

Die App **aktualisiert sich selbst**: Sie fragt beim Öffnen, beim Zurückkehren in die App und alle 30 Minuten
bei GitHub nach Updates, lädt sie im Hintergrund und aktiviert sie automatisch – beim Lesen oder Trainieren erst,
wenn du zur Bibliothek zurückgehst („✨ Update bereit"). Danach: „Aktualisiert – Was ist neu?".

Ablauf für neue Versionen:

```
git push  →  GitHub Actions: prüfen, Versionsnummer eintragen, veröffentlichen (1–2 Min.)  →  Handy holt sich das Update
```

Die installierte Version steht unter **Einstellungen → App & Updates**.

## Funktionen

| Bereich | Was geht |
|---|---|
| **Lesen** | Seiten blättern oder scrollen, 4 Themen, 5 Schriften, Inhaltsverzeichnis, Fußnoten als Popup, Fortschritt |
| **Wort antippen** | Übersetzung + Alternativen, Aussprache normal/langsam, Lautschrift, echte Aufnahmen (US/UK), Bedeutung |
| **🎓 Grammatik** | Artikel in Farbe + Plural (das Haus · die Häuser), Verbformen (gehen – ging – ist gegangen, go – went – gone), Grundform antippbar |
| **🎤 Nachsprechen** | Wort ins Mikrofon sagen – die App prüft die Aussprache in % |
| **🌐 Zweisprachig** | „Absatz übersetzen" oder Zweisprachig-Modus: Übersetzung direkt unter jedem Absatz |
| **🎧 Hören** | Buch vorlesen lassen (Satz wird markiert, Seite blättert mit), Tempo, Schlaf-Timer, +RU (Übersetzung nach jedem Satz), Sperrbildschirm-Steuerung |
| **🎙 Hörbücher** | Echte, von Menschen gelesene Hörbücher (LibriVox) suchen und hören – mit Kapiteln, Tempo, Schlaf-Timer |
| **📚 Entdecken** | 28 englische Klassiker (Standard Ebooks) und deutsche Klassiker nach Schwierigkeit, Suche in 70.000+ Gutenberg-Büchern – ein Tipp lädt das Buch |
| **🔍🔖 Suchen & Markieren** | Suche im ganzen Buch, Lesezeichen, Markierungen in 4 Farben mit Notizen |
| **⭐ Vokabeln** | Vokabelheft mit Kontext und Grammatik, Wörter selbst hinzufügen/bearbeiten, 6 Trainingsarten (Karteikarten, Auswahl, Hören, Schreiben, Sprechen, der·die·das), Wiederholung nach 1/2/4/8/16 … Tagen, CSV-Export |
| **📈 Statistik** | Tagesziel mit Ring, Serie 🔥, Lesezeit der letzten 14 Tage |
| **💾 Übertragen** | Alles (Bücher, Fortschritt, Vokabeln, Markierungen) in eine Datei sichern und auf dem anderen Gerät laden |
| **📤 Teilen** | Android: Text aus anderen Apps an LeseWelt teilen |

## Formate

EPUB · FB2 / FB2.ZIP (auch russische Windows-1251-Dateien) · PDF (mit Text) · TXT · HTML · eingefügter Text.

## Technik

Reines HTML/CSS/JavaScript ohne Build-Werkzeuge. Daten liegen nur lokal im Browser (IndexedDB).
Übersetzung: Google Translate → Ersatz MyMemory → Chrome-Offline-Übersetzer (mit Zwischenspeicher).
Wörterbuch: dictionaryapi.dev, Wiktionary. Bücher: Standard Ebooks, Project Gutenberg (über archive.org).
Hörbücher: LibriVox (über archive.org). Offline & Updates: Service Worker, veröffentlicht mit GitHub Actions.

```
index.html, css/app.css, css/v2.css, sw.js, manifest.webmanifest
js/app.js           Navigation, Teilen
js/update.js        Automatische Updates, "Was ist neu"
js/reader.js        Leser (Blättern, Wort-Erkennung, Zweisprachig, Suche, Markierungen, Hörbuch-Modus)
js/popup.js         Übersetzungs-Fenster (inkl. Nachsprechen)
js/practice.js      Spracherkennung fürs Nachsprechen
js/translate.js     Übersetzungsdienste
js/speech.js        Aussprache
js/dict.js          Wörterbuch
js/library.js       Bibliothek
js/catalog.js       Entdecken (Bücher & Hörbücher)
js/audioPlayer.js   Hörbuch-Player
js/vocab.js         Vokabelheft
js/train.js         Training (5 Arten)
js/grammar.js       Grammatik (Wiktionary, unregelmäßige Verben)
js/stats*.js        Statistik & Tagesziel
js/backup.js        Sichern & Übertragen
js/parsers/*        EPUB, FB2, PDF, TXT/HTML
tools/fetch-books.mjs   lädt beim Bauen alle „Entdecken“-Bücher, damit die App sie vom eigenen Server holt
.github/workflows/pages.yml   Automatischer Build & Veröffentlichung
```
