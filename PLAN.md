# 📚 LeseWelt – Plan

Eine Lese-App für Laptop und Handy (PWA, installierbar), mit eingebautem Übersetzer
(Standard: → Russisch) und richtiger Aussprache (Englisch / Deutsch / weitere Sprachen).

## 1. Ziele
- Englische, deutsche und andere Bücher **sauber und schön** lesen.
- **Wort antippen** → sofort Übersetzung ins Russische + Aussprache hören.
- **Satz / Textstelle markieren** → ganze Stelle übersetzen und vorlesen.
- Funktioniert auf **Laptop und Handy**, speichert alles lokal (keine Anmeldung).

## 2. Funktionen

### Bibliothek
- Bücher importieren: **EPUB, FB2, TXT, HTML, PDF** (Text) – per Button oder Drag & Drop.
- Text direkt einfügen (Copy & Paste) als „Buch“.
- Beispielbücher (Englisch + Deutsch) zum sofortigen Ausprobieren.
- Cover, Titel, Autor, Sprache, Lesefortschritt in %, zuletzt gelesen.
- Suchen / sortieren, Buch löschen.

### Lesen
- Zwei Modi: **Seiten blättern** (wie ein Buch, Wischen / Pfeiltasten / Antippen am Rand) oder **Scrollen**.
- Themen: Hell, Sepia, Dunkel, Schwarz (OLED).
- Schrift: Literata, Merriweather, Source Sans, System; Größe, Zeilenabstand, Randbreite, Blocksatz mit Silbentrennung.
- Inhaltsverzeichnis, Kapitel vor/zurück, Fortschrittsbalken, Position wird automatisch gespeichert.
- Vollbild / ruhiger Lesemodus (Leisten blenden sich aus).

### Übersetzer & Wörterbuch
- Wort antippen → Popup (auf dem Handy als Karte unten):
  - Übersetzung ins Russische (Zielsprache einstellbar) + Alternativen nach Wortart.
  - Lautschrift (IPA) für englische Wörter, wenn verfügbar.
  - Bedeutung (Wiktionary) für Englisch/Deutsch.
  - **Satz übersetzen**: der ganze Satz, in dem das Wort steht.
  - ⭐ Ins Vokabelheft speichern (mit Satz als Kontext).
- Text markieren → „Übersetzen“ / „Vorlesen“ für die ganze Stelle.
- Dienste mit Ausweichlösung: Google → MyMemory → Chrome-Offline-Übersetzer; Ergebnisse werden zwischengespeichert.

### Aussprache
- 🔊 Wort normal und 🐢 langsam anhören.
- Sprache automatisch (Buchsprache / erkannte Sprache), manuell umschaltbar (EN-US, EN-GB, DE …).
- Stimmen: beste Gerätestimme (Natural/Google-Stimmen bevorzugt) **oder** Online-Stimme (Google), einstellbar.
- **Vorlesen**: Kapitel Satz für Satz vorlesen, aktueller Satz wird markiert.

### Vokabelheft
- Alle gespeicherten Wörter mit Übersetzung, Kontext-Satz, Buch, Datum.
- Gespeicherte Wörter werden im Buch dezent markiert.
- **Karteikarten-Training** (Leitner-System: Wiederholung nach 1/2/4/8/16 Tagen).
- Export als CSV (z. B. für Anki).

## 3. Technik
- Reines HTML/CSS/JavaScript (ES-Module), **kein Build nötig**.
- Speicherung: IndexedDB (Bücher, Fortschritt, Vokabeln, Übersetzungs-Cache).
- Offline-Fähig über Service Worker, installierbar über Web-App-Manifest.
- Bibliotheken lokal: JSZip (EPUB), pdf.js (PDF).
- Wort-Erkennung per `caretPositionFromPoint` + `Intl.Segmenter`, Markierung per CSS Highlight API.
- Buch-Inhalte werden bereinigt (Sanitizer) – keine Skripte aus Büchern.

## 4. Starten
- Laptop: `start.bat` doppelklicken → öffnet http://localhost:8080
- Handy im gleichen WLAN: Adresse aus dem Startfenster (http://192.168.x.x:8080) öffnen.
- Für Installation als App auf dem Handy (HTTPS): online über GitHub Pages → https://samubraila.github.io/Buch/

## 5. Umsetzung (Reihenfolge)
1. Grundgerüst, Design-System, Themen, Manifest, Icons
2. Datenbank + Bibliothek + Import (EPUB, FB2, TXT, HTML, PDF, Einfügen)
3. Leser (Seiten/Scrollen, Einstellungen, Inhaltsverzeichnis, Fortschritt)
4. Wort antippen → Übersetzung, Wörterbuch, Satzübersetzung
5. Aussprache + Vorlesen
6. Vokabelheft + Karteikarten + CSV
7. Service Worker (offline), Tests auf Laptop- und Handy-Breite


## 6. Auf Github Push 
1. git@github.com:samubraila/Buch.git 
2. Test und auf github starten so das auch als app dort startet und ich bei mir auf händy dann auch nutzen kann

**Stand: ✅ erledigt (30.09.2026)**
- Code liegt auf https://github.com/samubraila/Buch (Branch `main`)
- App läuft online: **https://samubraila.github.io/Buch/** – auf dem Handy als App installierbar, funktioniert offline
- Automatischer Build mit GitHub Actions (`.github/workflows/pages.yml`): JavaScript prüfen → Versionsnummer eintragen → veröffentlichen
- Versionsnummer sichtbar in der App unter **Einstellungen → Version**
- Handy-Testanleitung mit QR-Code und Checkliste: [TESTEN.md](TESTEN.md)