# Testovnice Medicina

Základný monorepo scaffold pre projekt s:

- webovou stránkou v `apps/web`
- iOS/mobile appkou v `apps/mobile`
- zdieľanými typmi, obsahovým modelom a dátami v `packages/*`
- import skriptmi a zdrojmi v `scripts/` a `packages/question-bank/data/`

## Navrhnutá architektúra

- `apps/web`: verejný web a neskôr aj webová verzia testovníc
- `apps/mobile`: Expo app pripravená pre iOS
- `packages/question-bank`: doménové typy, datasety, importy a seed dáta
- `packages/ui`: miesto pre zdieľané komponenty
- `packages/config`: spoločné TypeScript nastavenia
- `docs`: produktové a technické poznámky

## Práca s PDF

Zdroj otázok je momentálne externý PDF dokument. Import pipeline žije v:

- `scripts/import_pdf.py`

Skript z PDF vyrobí:

- surový export strán podľa sekcií
- odpoveďové kľúče, ak ich nájde
- manifest o importe

Výstupy sa ukladajú do:

- `packages/question-bank/data/imports/`

## Ďalšie kroky

1. Doparsovať otázky a odpovede do čistého JSON formátu.
2. Navrhnúť kategórie, tagy a režimy učenia.
3. Rozbehnúť web a mobile app zo scaffoldu.

