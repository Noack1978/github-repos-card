# 🐙 github-repos-card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/custom-components/hacs)
[![GitHub release](https://img.shields.io/github/release/Noack1978/github-repos-card.svg)](https://github.com/Noack1978/github-repos-card/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Eine sortierbare und gruppierbare Lovelace-Karte für Home Assistant, die alle Repositories aus der [GitHub-Integration](https://www.home-assistant.io/integrations/github) automatisch in einer Tabelle darstellt.

## Features

- 🔍 **Automatische Erkennung** aller konfigurierten GitHub-Repositories
- 🖱️ **Visueller Editor** mit Repo-Auswahl, Layout- und Sichtbarkeits-Tabs
- 🔼 **Sortierung** per Klick auf Spaltenheader (auf-/absteigend)
- 📂 **Gruppierung** nach beliebiger Spalte per Chip-Auswahl
- ☑️ **Repo-Filter** – nur bestimmte Repositories anzeigen
- 🔗 **Klickbare Links** direkt zum GitHub-Repository
- 🌍 **Mehrsprachig** – unterstützt deutsche und englische HA-Entitäten
- ✨ **Neue Repos erscheinen automatisch** ohne Kartenanpassung

## Voraussetzungen

- [GitHub-Integration](https://www.home-assistant.io/integrations/github) eingerichtet
- Mindestens ein Repository in der Integration konfiguriert

## Installation

### Via HACS (empfohlen)

[![In HACS öffnen](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Noack1978&repository=github-repos-card&category=frontend)

1. Auf den Button klicken – HACS öffnet sich direkt mit diesem Repository
2. **Herunterladen** klicken
3. Home Assistant neu laden (F5)

Oder manuell als benutzerdefiniertes Repository:

1. HACS öffnen → **Frontend**
2. Oben rechts: **⋮ → Benutzerdefinierte Repositories**
3. URL eingeben: `https://github.com/Noack1978/github-repos-card`  
   Kategorie: **Frontend**
4. **Hinzufügen** → Karte in HACS suchen und installieren

### Manuell

1. `github-repos-card.js` aus dem [neuesten Release](https://github.com/Noack1978/github-repos-card/releases) herunterladen
2. Datei nach `/config/www/` kopieren
3. In HA: **Einstellungen → Dashboards → Ressourcen**
4. Ressource hinzufügen:
   - URL: `/local/github-repos-card.js`
   - Ressourcentyp: **JavaScript-Modul**

## Verwendung

Karte im Dashboard hinzufügen — am einfachsten über den **visuellen Editor** oder per YAML:

```yaml
type: custom:github-repos-card
layout_options:
  grid_columns: full
```

`grid_columns: full` sorgt dafür, dass die Karte die volle Dashboard-Breite nutzt — empfohlen für Sections-Dashboards. Im visuellen Editor unter dem **Layout**-Tab einstellbar.

## Visueller Editor

Der eingebaute Editor bietet drei Tabs:

- **Karte** – Repo-Auswahl per Checkbox und optionaler Sterne-Suffix
- **Layout** – Kartenbreite und -höhe (z.B. `grid_columns: full`)
- **Sichtbarkeit** – Bedingungen wann die Karte angezeigt wird

### Repo-Auswahl

Im **Karte**-Tab werden alle erkannten GitHub-Repositories als Checkboxen aufgelistet. Einzelne Repos lassen sich damit ein- oder ausblenden. „Alle anzeigen" ist der Standard — neue Repos erscheinen dann automatisch.

## Optionale YAML-Konfiguration

```yaml
type: custom:github-repos-card
star_suffix: _sterne        # Nur nötig, wenn automatische Erkennung fehlschlägt
repos:                      # Nur bestimmte Repos anzeigen (leer = alle)
  - ha_washdata
  - ha_dhl_tracking
layout_options:
  grid_columns: full
```

| Option | Standard | Beschreibung |
|--------|----------|--------------|
| `star_suffix` | auto | Suffix der Sterne-Entität (z.B. `_sterne`, `_stars`) |
| `repos` | alle | Liste der anzuzeigenden Repo-Basis-IDs |

## Spalten

| Spalte | Beschreibung |
|--------|-------------|
| Repository | Name des Repositories (klickbar) |
| Benutzer | GitHub-Benutzername des Inhabers |
| Version | Neuestes Release-Tag |
| Probleme | Anzahl offener Issues |
| ⭐ | Sterne |
| 🍴 | Forks |

## Sortierung

Klick auf einen **Spalten-Header** sortiert nach dieser Spalte (↑ aufsteigend). Ein weiterer Klick wechselt zu absteigend (↓).

## Gruppierung

Über die **Chip-Buttons** oberhalb der Tabelle lässt sich nach einer Spalte gruppieren:

- **Repository** → Alphabetisch nach erstem Buchstaben
- **Benutzer** → Nach GitHub-User
- **Version** → Nach Hauptversion (v1.x, v2.x …)
- **Probleme / ⭐ / 🍴** → Nach Zahlenbereichen

Ein aktiver Chip ist farbig markiert. Erneutes Klicken hebt die Gruppierung auf.

## Mehrsprachigkeit

Die Karte erkennt automatisch, welche Sprache deine HA-Instanz verwendet:

| Sprache | Sterne-Suffix |
|---------|--------------|
| Deutsch | `_sterne` |
| Englisch | `_stars` |
| Französisch | `_étoiles` |
| Niederländisch | `_sterren` |
| Portugiesisch | `_estrelas` |
| Spanisch | `_estrellas` |

## Lizenz

MIT – siehe [LICENSE](LICENSE)
