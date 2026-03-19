# Architektúra

## Ciele

- jeden repozitár pre web aj iOS
- zdieľaný doménový model pre otázky
- jednoduchý import ďalších PDF zdrojov
- postupná migrácia zo surových PDF dát na čistý dataset

## Obsahový model

Každá otázka by mala mať:

- predmet
- pôvodné číslo otázky
- text zadania
- 4 možnosti
- 1 až 4 správne odpovede
- voliteľné vysvetlenie
- tagy pre filtrovanie a spaced repetition

## Navrhnutý workflow

1. Import PDF do surového textu a answer-key mapy.
2. Normalizácia otázok do JSON.
3. Review dát a doplnenie tagov.
4. Napojenie na web/mobile UI.

