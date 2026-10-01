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

---

# 🚀 Version 2.0 – Großes Update

Ziel: Aus dem Leser wird eine richtige **Sprachlern-App zum Lesen**, und das Handy hat **immer automatisch die neueste Version**.

## 7. Immer die neueste Version auf dem Handy 🔄
- Die App fragt **beim Start**, **beim Zurückkehren in die App** und **alle 30 Minuten** bei GitHub nach einem Update.
- Ein neues Update wird im Hintergrund geladen und **automatisch aktiviert**:
  - in Bibliothek, Vokabeln oder Einstellungen: die App lädt sofort neu
  - beim Lesen oder Trainieren: kleiner Hinweis „Update bereit“. Es wird aktiviert, sobald du zur Bibliothek gehst (dein Lesefortschritt bleibt gespeichert).
- Nach dem Update: Hinweis **„Aktualisiert – Was ist neu?“** mit der Liste der Neuerungen.
- Einstellungen → **„Nach Updates suchen“** prüft sofort, ob es eine neue Version gibt.
- Ablauf für neue Versionen: `git push` → GitHub Actions baut (1–2 Min.) → Handy holt sich das Update automatisch.

## 8. Bücher direkt in der App finden 📚 („Entdecken“)
- **Englisch:** 28 ausgewählte Klassiker von Standard Ebooks (schöne EPUBs mit Cover), sortiert nach **Leicht / Mittel / Schwer**
- **Deutsch:** Klassiker von Project Gutenberg (Kafka, Thomas Mann, Goethe, Storm, Spyri …)
- **Suche** in über 70.000 freien Büchern (Gutenberg über archive.org), nach Sprache filterbar
- Ein Tipp → Buch wird geladen und öffnet sich (ohne Umweg über „Downloads“)

## 9. Zweisprachig lesen 🌐
- **Absatz übersetzen:** Die Übersetzung erscheint direkt unter dem Absatz im Buch.
- **Zweisprachig-Modus:** Jeder Absatz bekommt automatisch die russische Übersetzung darunter.

## 10. Suchen, Lesezeichen & Markierungen 🔖
- **Suche im ganzen Buch** mit Textausschnitten, Tipp springt zur Stelle
- **Lesezeichen** für die aktuelle Seite
- **Textstellen markieren** in 4 Farben, mit **Notiz**
- Alles in einer Liste: Inhalt | Lesezeichen | Markierungen

## 11. Aussprache üben 🎤
- **„Nachsprechen“**: Du sprichst das Wort ins Mikrofon, die App prüft die Aussprache (✓ / nochmal).
- Das geht im Wort-Fenster und im Training.

## 12. Besser trainieren 🧠
- 4 Trainingsarten: **Karteikarten**, **Auswahl** (4 Antworten), **Hören** (welches Wort hörst du?), **Schreiben**
- Weiterhin mit Wiederholung nach 1 / 2 / 4 / 8 / 16 … Tagen

## 13. Statistik & Tagesziel 📈
- Lesezeit pro Tag, nachgeschlagene und gespeicherte Wörter
- **Tagesziel** (z. B. 15 Min.) mit Fortschrittsring und **Serie** 🔥 (Tage am Stück)
- Übersicht der letzten 14 Tage

## 14. Alles übertragen: Laptop ↔ Handy 💾
- **Alles sichern** (Bücher, Fortschritt, Vokabeln, Markierungen, Statistik) in **eine Datei**
- Auf dem anderen Gerät **„Sicherung laden“**. Auf dem Handy auch direkt **teilen** (z. B. per Telegram oder WhatsApp an dich selbst).

## 15. Text aus anderen Apps teilen 📤
- Android: In einer anderen App Text markieren → **Teilen → LeseWelt** → Text öffnet sich zum Lesen und Übersetzen.

## 16. Bücher hören 🎧 (Hörbuch-Modus)
- **Jedes Buch anhören:** großer Player mit Play/Pause, Satz vor/zurück, Tempo, Stimme
- Der aktuelle Satz wird im Buch markiert und die Seite blättert mit (**Mitlesen**)
- **Zweisprachig hören:** Erst der Satz im Original, dann auf Russisch
- **Sperrbildschirm-Steuerung** (Play/Pause/Weiter) und Weiterhören bei ausgeschaltetem Bildschirm (mit Online-Stimme)
- **Schlaf-Timer:** 15 / 30 / 45 / 60 Min. oder Kapitelende
- Die App merkt sich, wo du beim Hören aufgehört hast
- **Echte Hörbücher (LibriVox):** von Menschen gelesene, kostenlose Hörbücher suchen und anhören (Englisch, Deutsch, Russisch …), mit Kapiteln, Tempo, Schlaf-Timer und Merken der Position

## Umsetzung Version 2.0 (Reihenfolge)
1. Auto-Update + „Was ist neu“
2. Datenbank-Erweiterung (Markierungen, Statistik)
3. Entdecken (Katalog + Suche + Download)
4. Suche im Buch, Lesezeichen, Markierungen
5. Absatz-Übersetzung + Zweisprachig-Modus
6. Nachsprechen (Spracherkennung)
7. Trainingsarten
8. Statistik & Tagesziel
9. Sicherung / Übertragung + Teilen
10. Hörbuch-Modus + echte Hörbücher (LibriVox)
11. Tests (Laptop + Handy), Push → GitHub baut → Online-Test

**Stand Version 2.0: ✅ umgesetzt und getestet (30.09.2026)**
- Alle Punkte 7–16 sind eingebaut und im Browser getestet (Laptop 1280 px und Handy 390 px)
- Auto-Update getestet: offene App wechselt ohne Zutun auf die neue Version; beim Lesen/Trainieren erscheint nur „Update bereit"
- Neuigkeiten: [CHANGELOG.md](CHANGELOG.md) · Handy-Test: [TESTEN.md](TESTEN.md)


---

# 🔧 Version 2.1 – Bücher laden repariert & Vokabeln schneller

**Problem (Rückmeldung vom Handy):** Bücher aus „Entdecken“ ließen sich nicht herunterladen/lesen.
**Ursache (mit iPhone-Engine WebKit nachgestellt):** Safari kann Bilder (Blobs) nicht in der App-Datenbank speichern →
jedes Buch mit Cover/Bildern scheiterte mit „Error preparing Blob/File data to be stored in object store“.

## 17. Umsetzung
1. ✅ Cover und Bilder als ArrayBuffer speichern (funktioniert in allen Browsern, alte Bücher bleiben lesbar)
2. ✅ Bücher vom eigenen Server: GitHub Actions lädt alle „Entdecken“-Bücher beim Bauen herunter
   (`tools/fetch-books.mjs`, mit Zwischenspeicher) und veröffentlicht sie unter `books/`
3. ✅ „📖 Lesen“: ein Tipp lädt und öffnet das Buch, mit Ladebalken; mehrere Quellen nacheinander (eigener Server → Original-Seite)
4. ✅ Mehr Bücher: 12 englische (vor allem leichte) + Heidi, Siddhartha, Effi Briest; deutsche Bücher als EPUB mit Cover;
   Gutenberg-Lizenztext wird automatisch ausgeblendet
5. ✅ Wunsch: großer Knopf „Zu Vokabeln“ im Wort-Fenster und „⭐ Vokabeln“ beim Markieren von Text
6. ✅ Fehler verständlich anzeigen, „Erneut versuchen“, „Hilfe & Diagnose“ mit Bericht zum Kopieren
7. ✅ Getestet mit iPhone-Engine (WebKit) und Chrome


---

# 🎓 Version 2.2 – Grammatik & besser lernen

Ziel: Beim Lesen nicht nur die Übersetzung sehen, sondern auch **die Grammatik** – und die Vokabeln gezielter üben.

## 18. Grammatik-Box beim Wort
- **Deutsche Nomen:** Artikel in Farbe (**der** blau · **die** rot · **das** grün) und Plural – z. B. „**das** Haus · die Häuser“
- **Verben:** die wichtigsten Formen – „gehen – ging – ist gegangen · er geht“, „go – went – gone“
- **Adjektive:** „schön – schöner – am schönsten“
- **Grundform:** Bei gebeugten Wörtern („ging“, „Häuser“, „went“) wird die Grundform gezeigt – antippen öffnet sie
- Quelle: Wiktionary (Deutsch und Englisch), englische unregelmäßige Verben zusätzlich fest eingebaut

## 19. Vokabeln mit Grammatik
- Gespeicherte Nomen behalten ihren Artikel („das Haus“), Verben ihre Formen – im Vokabelheft und beim Training
- **Neues Training „der · die · das“:** Artikel deutscher Nomen üben
- **Vokabelheft:** Wort selbst hinzufügen, Übersetzung bearbeiten, nach Buch filtern, „Aus diesem Buch üben“

## 20. Startseite
- **Lernkarte:** „12 Wörter warten auf dich → Üben“
- **Wort des Tages** aus deinem Vokabelheft (mit Aussprache)

## 21. Bibliothek ordnen
- Sortieren: zuletzt gelesen · neu hinzugefügt · Titel · Fortschritt
- Filter: alle · angefangen · neu · fertig gelesen, nach Sprache
- Abzeichen „✓ Gelesen“ für beendete Bücher

## 22. Verbesserungen
- Hörbuch-Cover: Ersatzbild, wenn archive.org kein Bild liefert
- Alle Funktionen auch mit der iPhone-Engine (WebKit) getestet

## Umsetzung Version 2.2 (Reihenfolge)
1. Grammatik-Modul (Wiktionary + unregelmäßige Verben) und Anzeige im Wort-Fenster
2. Vokabeln mit Grammatik speichern und anzeigen, Artikel-Training
3. Vokabelheft: hinzufügen, bearbeiten, nach Buch filtern
4. Startseite: Lernkarte und Wort des Tages
5. Bibliothek: sortieren und filtern
6. Tests (Chrome + iPhone-Engine), Doku, Push → GitHub baut → Online-Test

**Stand Version 2.2: ✅ umgesetzt und getestet (01.10.2026)**
- Punkte 18–22 eingebaut; getestet mit Chrome und iPhone-Engine (WebKit)
- Geprüfte Beispiele: ging → gehen – ging – ist gegangen · Häuser → das Haus · die Häuser · Mutter → die Mutter · die Mütter ·
  lief → laufen – lief – ist gelaufen · went → go – went – gone · children → child

