# Path of Building engine (My Ritualist Overlay)

Runs [Path of Building Community (PoE2)](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2)
without its window, to compare an item with the character's equipment
("Compare in PoB" shortcut, see `main/src/atziri-pob.ts`).

- `pob-server.lua`: reads one JSON command per line on stdin, answers one JSON
  line on stdout (load a build, pick the main skill, compare an item).
- `_SimpleGraphic.def.lua`: copied unchanged from Path of Building
  (`src/_SimpleGraphic.def.lua`): stand-ins for the graphics engine functions.
- `luajit/`: LuaJIT 2.1 for Windows x64 (MSYS2 `mingw-w64-ucrt-x86_64-luajit`
  package, installed with Scoop).

The Path of Building code itself is not shipped: the user's installed
Path of Building 2 is used (it updates itself with every game patch).

## Licenses

- Path of Building Community: MIT License, Copyright (c) 2016 David Gowor.
- LuaJIT: MIT License, Copyright (C) 2005-2026 Mike Pall.
  https://luajit.org/
