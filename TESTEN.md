# 📱 LeseWelt auf dem Handy testen

## 1. App öffnen

Scanne den QR-Code mit der Handy-Kamera – oder tippe die Adresse ein:

<img src="docs/handy-qr.png" alt="QR-Code zu https://samubraila.github.io/Buch/" width="220">

**https://samubraila.github.io/Buch/**

## 2. Als App installieren

| Handy | So geht's |
|---|---|
| **Android** (Chrome) | Menü **⋮** → **„App installieren"** (oder „Zum Startbildschirm hinzufügen") |
| **iPhone / iPad** (Safari) | **Teilen-Knopf** □↑ → **„Zum Home-Bildschirm"** → „Hinzufügen" |

Danach hast du das LeseWelt-Icon auf dem Startbildschirm und die App öffnet sich ohne Browser-Leiste.

## 3. Welche Version habe ich?

**Einstellungen** → ganz unten steht **„Version: 2026-…-abc1234"**.
Die Zahl am Ende ist der Commit auf GitHub. So siehst du, ob das neueste Update schon da ist.

## 4. Test-Checkliste

Einfach der Reihe nach durchgehen und abhaken:

**Grundlagen**
- [ ] App öffnet sich, Bibliothek ist zu sehen
- [ ] Beispiel **„Alice's Adventures in Wonderland"** antippen → Buch öffnet sich
- [ ] Nach links/rechts **wischen** → Seite blättert um
- [ ] **Mitte antippen** → Menüleisten oben/unten erscheinen und verschwinden

**Übersetzen & Aussprache**
- [ ] Ein **Wort antippen** → Karte mit russischer Übersetzung erscheint
- [ ] Das Wort wird **automatisch ausgesprochen** (Lautstärke an? iPhone: Stumm-Schalter aus!)
- [ ] **„Langsam"** → Wort wird langsam gesprochen
- [ ] **„Satz übersetzen"** → ganzer Satz auf Russisch
- [ ] **Lange auf ein Wort drücken** und Markierung ziehen → Leiste „Übersetzen / Anhören" erscheint
- [ ] Deutsches Beispiel **„Die Bremer Stadtmusikanten"** → Wort antippen → deutsche Aussprache

**Vokabeln**
- [ ] In der Wort-Karte auf **⭐** tippen → „Im Vokabelheft gespeichert"
- [ ] Das Wort ist im Text jetzt **gepunktet unterstrichen**
- [ ] Unten **„Vokabeln"** → Wort steht in der Liste
- [ ] **„Trainieren"** → Karteikarte → „Antwort zeigen" → „Gewusst"

**Darstellung**
- [ ] Oben **Aa** → Thema **Sepia** und **Dunkel** ausprobieren
- [ ] Schriftgröße **A+ / A−** ändern
- [ ] Lesemodus **„Scrollen"** ausprobieren
- [ ] Oben **☰** (Inhalt) → Kapitelliste öffnet sich
- [ ] **🎧** → Vorlesen startet, aktueller Satz wird gelb markiert

**Eigene Bücher**
- [ ] Ein freies EPUB herunterladen, z. B. von [standardebooks.org](https://standardebooks.org) oder [gutenberg.org](https://www.gutenberg.org)
- [ ] In der Bibliothek **„Buch hinzufügen"** → Datei aus „Downloads" wählen → Buch erscheint mit Cover

**Offline**
- [ ] **Flugmodus** einschalten → App öffnen → Bibliothek und Bücher funktionieren
- [ ] Schon nachgeschlagene Wörter werden auch offline übersetzt

## 5. Wenn etwas nicht geht

| Problem | Lösung |
|---|---|
| **Kein Ton** | Lautstärke hoch; iPhone: Stumm-Schalter an der Seite aus. Einstellungen → Aussprache → **„Online-Stimme"** probieren |
| **Stimme klingt schlecht** | Einstellungen → Aussprache → andere Stimme wählen und **„▶ Test"** drücken |
| **„Übersetzung nicht erreichbar"** | Internet prüfen, kurz warten, **„Erneut versuchen"** |
| **Alte Version / Änderung fehlt** | App ganz schließen und neu öffnen. Wenn „Neue Version verfügbar" erscheint → **„Neu laden"** |
| **„App installieren" fehlt** | Android: Chrome verwenden. iPhone: **Safari** verwenden (nicht Chrome) |

## 6. Wie kommen Updates aufs Handy?

1. Änderung am Laptop machen und auf GitHub schieben:
   ```
   git add -A
   git commit -m "Beschreibung der Änderung"
   git push
   ```
2. GitHub baut die App automatisch (Reiter **Actions** → „Bauen & Veröffentlichen", dauert ca. 1–2 Min.).
3. App auf dem Handy schließen und neu öffnen → neue Version (in Einstellungen prüfen).

Build-Status: https://github.com/samubraila/Buch/actions
