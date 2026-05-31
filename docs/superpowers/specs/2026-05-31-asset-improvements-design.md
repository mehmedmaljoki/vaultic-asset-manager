# Design — Asset Manager Verbesserungen (3 Features)

**Datum:** 2026-05-31
**Status:** Approved
**Betroffene App:** `mobile/` (Expo SDK 54, Expo Router v6, offline-first, SQLite)

## Überblick

Drei unabhängige Verbesserungen am Offline Asset Manager:

1. **Edelmetalle als Standard** beim Hinzufügen neuer Assets (statt Bargeld).
2. **Länderspezifische Goldmünzen** — Hybrid aus gebündeltem Katalog + eigenen, wiederverwendbaren Münzvorlagen.
3. **Safe-Area / runde Bildschirme** — Navigation und Inhalte funktionieren auf iOS und Android (mit und ohne Navigationsleiste, Gesten- und 3-Button-Nav).

**Umsetzungsreihenfolge:** Feature 1 (trivial) → Feature 3 (Layout, eigenständig) → Feature 2 (größter Brocken).

Alle drei respektieren die Architekturregeln aus `mobile/CLAUDE.md` (4-Schichten-MVC, keine Mock-Preise, offline-first, `fetch()` only, neue Strings in allen 16 Sprachen).

---

## Feature 1 — Edelmetalle als Standard

### Befund
- [assets.tsx:258](../../../mobile/app/(tabs)/assets.tsx) — `AssetForm` startet mit `useState<Asset['type']>(initial?.type ?? 'money')`.
- `'metals'` steht in `CATEGORIES` ([Category.ts:12](../../../mobile/lib/models/Category.ts)) bereits an erster Stelle.
- Subtype-Default ist bereits `'gold'`, Reinheit-Default `999`.

### Änderung
- Default-Type `'money'` → `'metals'` in `AssetForm`.
- Effekt: Frisches Add-Formular öffnet mit Edelmetalle / Gold / Gramm / Reinheit.
- Edit-Modus unverändert (`initial?.type` greift weiter).

### Risiko
Minimal, ein Einzeiler. Kein Datenmodell- oder Migrationsbedarf.

---

## Feature 2 — Länderspezifische Goldmünzen (Hybrid)

### Grundprinzip
Eine Münze ist Metall mit **bekanntem Bruttogewicht pro Stück** und **bekannter Feinheit**.
Statt einer parallelen Logik wird an die bestehende Metall-Berechnung angedockt:

Heute (Barren): `value = Menge(g) × Preis/g × Reinheit/1000`
Münze: `value = Stückzahl × Bruttogewicht/Stück × Preis/g × Reinheit/1000`

### a) Datenmodell

**Neue Datei `lib/models/CoinCatalog.ts`** — gebündelter statischer Katalog.

```ts
export interface CatalogCoin {
  id: string;            // z.B. 'TR_ceyrek_ziynet'
  country: string;       // Anzeigename, z.B. 'Türkei'
  countryCode: string;   // ISO, z.B. 'TR' (für Gruppierung/Sortierung)
  name: string;          // Eigenname, z.B. 'Çeyrek Altın (Ziynet)'
  aliases: string[];     // Suchbegriffe, z.B. ['ceyrek','quarter','ziynet']
  metal: 'gold' | 'silver';
  grossWeightG: number;  // Bruttogewicht pro Stück
  fineness: number;      // millesimal, z.B. 916
  fineGoldG: number;     // reiner Goldgehalt (Anzeige/Plausibilität)
  alloy: string;         // lesbare Legierung, bei Auswahl angezeigt (z.B. 'Au-Cu (22 Karat)')
  notes?: string;
}
export const COIN_CATALOG: CatalogCoin[] = [ /* ~35 Einträge */ ];
```

- Quelle: vom Nutzer gelieferte JSON (AT/DE, TR, CH, FR, ZA, CA, US, GB, MX, CN, AU).
- Fraktionen (Philharmoniker ¼/½/⅒ oz etc.) werden als **eigene Katalogeinträge** aufgelöst (kein verschachteltes `fractions`-Feld) — einfacher im Picker.
- `fineness` wird auf das vorhandene `purity`-Feld gemappt (gleiche millesimal-Skala).

**Erweiterung `Asset` interface** ([Asset.ts](../../../mobile/lib/models/Asset.ts)):

```ts
coinId?: string;       // Referenz auf Katalog- oder Custom-Münze (Herkunft/Anzeige)
gramsPerUnit?: number; // Bruttogewicht pro Stück; nur bei Münzen gesetzt
```

- Münz-Asset: `type='metals'`, `subtype='gold'|'silver'`, `quantity = Stückzahl`, `purity = Feinheit`, `gramsPerUnit = Bruttogewicht/Stück`, `unit = 'coin'`, `coinId` gesetzt.
- **Denormalisiert:** Gewicht + Feinheit liegen auf dem Asset, nicht nur als Katalog-Lookup. Werte bleiben offline und nach Katalog-Updates stabil.

**Erweiterung `calcValue`** ([AssetService.ts:21-23](../../../mobile/lib/services/AssetService.ts)):

```ts
if (asset.type === 'metals') {
  const purity = asset.purity ?? 1000;
  const perUnitG = asset.gramsPerUnit ?? 1;   // Barren: undefiniert → 1 (qty ist Gramm)
  return qty * perUnitG * price * (purity / 1000);
}
```

Voll abwärtskompatibel: Barren haben `gramsPerUnit = undefined` → Faktor `1` → identisch zu heute.

**DB-Migration:** Zwei neue, nullbare Spalten in `assets` (`coin_id TEXT`, `grams_per_unit REAL`) via bestehendes Migrationssystem in `lib/db/`. AssetRepository liest/schreibt die neuen Felder.

### b) Eigene Münzen (wiederverwendbar)

- **Neue Tabelle `custom_coins`** + `CustomCoinRepository` (folgt 4-Schichten-Architektur).
- Schema: gleiche Form wie `CatalogCoin` (id mit Präfix `custom_`, `country` z.B. „Eigene", `aliases` optional leer).
- Einmal angelegt → erscheint oben im Münz-Picker (Sektion „Eigene Münzen"), wiederverwendbar bevor man die Münze besitzt.
- Service-Schicht `CoinService` (pure TS) bündelt Katalog + Custom und liefert der UI: `getCountries()` (Länder mit ≥1 Münze, sortiert, inkl. „Eigene"), `getCoinsByCountry(code)` und optionale Suche innerhalb eines Landes über `name + aliases`.

### c) UI im Formular (bei `type = 'metals'`)

- **Umschalter Barren/Gramm ↔ Münze** (Segmented Control oder zwei Chips) oben im Metall-Block.
- **Modus Barren:** unverändert (Gold/Silber/… + Gramm + Reinheit).
- **Modus Münze — zweistufige Auswahl** (handlicher als eine große Liste):
  1. **Schritt 1 — Land/Region wählen:** eigenes Auswahlfeld (`SelectRow` → `PickerSheet`) mit den Ländern, die im Katalog Münzen haben (z.B. Türkei, Österreich, Deutschland, Schweiz, Frankreich, Südafrika, Kanada, USA, GB, …) — plus Sektion **„Eigene"** für selbst angelegte Münzen. Reihenfolge: häufige/lokal relevante Länder zuerst, Rest alphabetisch. Länderliste wird zur Laufzeit aus `COIN_CATALOG` + `custom_coins` abgeleitet (kein hartkodiertes Duplikat).
  2. **Schritt 2 — Münze wählen:** zweites Dropdown (`SelectRow` → `PickerSheet`), gefiltert auf das gewählte Land. Innerhalb des Landes optional Suchfeld über `name + aliases`. Auswahl füllt automatisch: Name, `subtype` (Metall), `gramsPerUnit`, `purity`, `coinId`.
  - Land wechseln setzt die Münzauswahl zurück.
  - **Nach Auswahl** erscheint ein Info-Block mit **Legierung** (z. B. „Au-Cu (22 Karat)"), **Gewicht in Gramm** und **Gewicht in Unze** (Feinunze = g / 31,1035). Bei eigenen Münzen wird die Legierung aus Metall + Feinheit abgeleitet (z. B. „Gold 999").
- **Anzahl (z.B. 5 × Çeyrek):** Mengenfeld mit `unit = 'coin'`, Label „Anzahl / Stück". Nutzer gibt die Stückzahl ein (`quantity = 5`). Live-Wert = `Stückzahl × Bruttogewicht × Preis/g × Reinheit/1000` wird berechnet und angezeigt.
- **Eigene Münze:** in der Länder-Sektion „Eigene" ganz oben Eintrag **„Eigene Münze hinzufügen"** → Eingabe Name, Metall, Bruttogewicht (g), Feinheit → speichert in `custom_coins`, landet danach unter „Eigene" und ist direkt auswählbar.
- **Detail-/Listenansicht:** zeigt z.B. „5 Stück · Çeyrek Altın". `iconFor`/Anzeige-Logik berücksichtigt Münz-Assets.

### d) Bewusst nicht im Scope (YAGNI)
- **Numista / Online-Preis-APIs / Bild-Identifikation.** App ist strikt offline-first (`mobile/CLAUDE.md`: kein Backend, `fetch()` only für die bestehenden Preis-Endpoints). Katalog wird **statisch gebündelt**.
- „Online weitere Münzen importieren" ist ein potenzielles späteres, separates Feature.

### e) i18n
- Münznamen bleiben Eigennamen (nicht übersetzt).
- Neue UI-Labels (`asset_coin_mode_bar`, `asset_coin_mode_coin`, `asset_coin_country`, `asset_coin_select`, `asset_coin_count`, `asset_add_custom_coin`, `asset_coin_section_own`, Ländernamen etc.) in **allen 16 Sprachen** in `lib/i18n.ts`.
- RTL (ar, fa) für den neuen Picker beachten.

---

## Feature 3 — Safe-Area / runde Bildschirme

### Befunde
1. **Hauptursache:** Tab-Bar in [_layout.tsx:27-28](../../../mobile/app/(tabs)/_layout.tsx) — feste `height` (iOS 80 / Android 64) + `paddingBottom: iOS?24:8`. `insets.bottom` wird ignoriert → auf Android mit Gesten-Nav / Buttonleiste sitzt bzw. überdeckt die Bar Elemente.
2. **Listen verdeckt:** `FlatList`-Inhalte (z.B. [assets.tsx:624](../../../mobile/app/(tabs)/assets.tsx), debts.tsx) ohne unteren Abstand für die Tab-Bar → letzte Einträge verschwinden dahinter.
3. **Cleanup:** doppelter Import von `useSafeAreaInsets` in assets.tsx (Zeile 8 — prüfen/entfernen falls redundant).

### Lösung
- **Tab-Bar inset-aware:** `TabLayout` nutzt `useSafeAreaInsets()`. Höhe = Basishöhe + `insets.bottom`, `paddingBottom = insets.bottom + Rest`. Deckt ab: iOS Home-Indicator, Android Gesten-Nav, Android 3-Button, sowie ganz ohne Navigationsleiste.
- **Gemeinsame Tab-Bar-Höhe:** kleine Helper-Konstante/Hook (z.B. `useTabBarHeight()` oder Konstante in `lib/theme`), damit Screens den korrekten unteren Abstand kennen.
- **Listen-Padding:** alle Tab-Screens bekommen unten `contentContainerStyle`-Padding = Tab-Bar-Höhe (+ kleiner Puffer), damit nichts abgeschnitten wird. Betrifft `index`, `assets`, `zakat`, `debts`, `settings`.
- **Oben:** `edges={['top']}` bleibt (deckt Notch/runde obere Ecken bereits ab).

### Verifikation
- Android: Gesten-Nav **und** 3-Button-Nav.
- iOS: Gerät mit Home-Indicator (z.B. iPhone 14/15) und ohne.
- Letzte Listeneinträge auf jedem Tab vollständig sichtbar, Tab-Bar nicht überdeckt.

---

## Testing (gemäß CLAUDE.md)
- **Feature 2:** Unit-Tests für erweiterte `calcValue` (Münz-Fall, Barren-Fall unverändert), `CoinService` (Suche/Gruppierung), `CustomCoinRepository`. `expo-sqlite`-Mock vorhanden.
- **Feature 1 & 3:** primär manuelle/visuelle Verifikation; ggf. Snapshot/Render-Test für Default-Type.
- Keine echten Netzwerkaufrufe in Tests.

## Offene Punkte
Keine — alle Entscheidungen mit Nutzer geklärt (Hybrid-Ansatz, eigene `custom_coins`-Tabelle, Numista raus, Umschalter-Flow ok).
