# The Web Wand Engine (TWWE)

[中文](./README_zh.md) | English

A Web-based Noita wand evaluation and synchronization tool. This project aims to provide an intuitive, beautiful, and powerful interface to help players analyze complex wand logic and achieve real-time linkage between web-side design and in-game data through a highly integrated synchronization system.

## ✨ Core Features

### 1. Bidirectional Game Data Sync
*   **Manual Push/Pull**: Support one-click synchronization of wands from the current save to the web side, or real-time pushing of wands designed on the web side into the game.
*   **Single-Sync Guarantee**: Deeply polished push and pull logic ensures that even in complex Mod environments, single-sync remains stable and reliable.
*   **Seamless Connection**: The plugin side interacts with the backend through high-performance Socket communication, supporting real-time acquisition of all in-game wands and spell data.

### 2. Local Wand Warehouse
*   **Persistent Storage**: Built-in powerful local warehouse system, supporting permanent storage of various designed wands in the browser (localStorage).
*   **Directory Tree Management**: Support creating multi-level folders, easily organizing your wand collection through drag and drop.
*   **Smart Tags & Search**: Automatically generate search info for wands in the warehouse, supporting name and Pinyin filtering.

### 3. Multi-Mod Ecosystem Compatibility
*   **Deep Integration**: Support one-click acquisition and import of stored wands from `Wand Editor` and `Spell Lab` (and its branch `Shugged`) save settings.
*   **Real-time Mod Spell Scraping**: Real-time synchronization of all loaded Mod spell data during game runtime via Socket, ensuring absolute accuracy of spell icons and attributes.
*   **Simulator Injection**: The backend supports injecting Mod's `ModLuaFileAppend` logic into the local evaluation engine, achieving accurate attribute simulation and recursive calculation for Mod spells.

### 4. Noita Wiki Deep Integration
*   **Template Parsing**: Directly paste Noita Wiki's `{{Wand2 ...}}` or old `{{Wand ...}}` template code, and TWWE can instantly restore it into a visual wand.
*   **Tampermonkey Script Enhancement**: Provide `noita_wiki_simulator.user.js` script, which, after installation, can display an "[Open in Simulator]" button next to the wand panel on Noita Wiki for one-click jumping.

### 5. High-Efficiency Interaction Design
*   **High-Frequency Preference Sorting**: The spell selector automatically counts the usage frequency of spells in all workflows, prioritizing commonly used spells.
*   **Pinyin Search**: Support full Pinyin and initial search for spell names, fast and precise positioning.
*   **Deep Keyboard Shortcuts**:
    *   `Ctrl + C` / `V` / `X`: **Smart context operations**. Default to copy/paste/cut on a single slot under the mouse; if there's a selected spell group, batch operations are performed on the entire selected area.
    *   `Ctrl + Z` / `Y`: Infinite undo and redo steps.
    *   `Ctrl + A`: Select all spells in the current wand.
    *   `Ctrl + H` / `B`: Quickly open or close the history/wand warehouse panel.
    *   `Space`: Insert an empty slot at the current position.
    *   `Delete` / `Backspace`: Delete hovered or selected spells. If "**Delete Empty Slot**" is enabled in settings, pressing `Delete` can directly delete the spell and its slot (reducing wand capacity).
    *   `Alt (Hold)`: Real-time display of the logic order numbers of spell slots.
*   **Mouse Commands & Modes**:
    *   **Arrow Mode**: **Default Mode** (Selection mode). Supports clicking or dragging the mouse for **box selection**, quickly selecting multiple spells.
    *   **Hand Mode**: Grab mode. Supports clicking or dragging a single spell.
    *   `Middle Click`: Mark/unmark a spell slot (for highlighting or specific debugging).
    *   `Alt + Left Click`: Quickly toggle spell remaining uses (0 or full); if it's a conditional spell (e.g., low HP trigger), directly toggle the corresponding simulation environment switch.

### 6. Dual Engine Evaluation Calculation
*   **Local High-Performance Mode**: Call the highly optimized local `wand_eval_tree` process, supporting super complex spell calculations with millions of recursions, simulating real firing logic with extreme performance.
*   **Static Compatibility Mode (WASM)**: Frontend integrates Lua WASM engine for basic evaluation when detached from the backend environment (e.g., GitHub Pages), performance suitable for lightweight verification.

## 🚀 Quick Start

### 1. Online Use
You can directly access the [GitHub Pages Online Version](https://asmallhamis.github.io/TheWebWandEngine/).
> [!NOTE]
> The online version runs in static mode (WASM), cannot connect to the local game, and calculation performance is limited by the browser. For instant sync or high-performance simulation, please download the local version below.

### 2. Download Local Version
Download the latest green portable version from [GitHub Releases](https://github.com/Asmallhamis/TheWebWandEngine/releases/latest):
1. Run `TheWebWandEngine.exe` (or `Start_TheWebWandEngine.bat`).
2. The program will automatically open the UI in the default browser (default port `17471`).

### 3. In-Game Synchronization
Copy the plugin folder `wand_sync` to Noita's `mods` directory and enable it in the game.
> [!IMPORTANT]
> "**Enable unsafe mods**" must be turned on in game settings to support Socket communication.

## 🛠️ Development & Build (Advanced)

### 1. Environment Preparation
- **Python 3.8+** and **Node.js 16+**.
- **LuaJIT**: Ensure `luajit.exe` exists in the `bin/` directory (local evaluation engine driver).
- **Resource Files**: Rename the game's unpacked `data` folder to `noitadata` and place it in the root directory to get complete spell icons and translation support.

### 2. Run Locally
```bash
# Backend
pip install -r requirements.txt
python backend/server.py

# Frontend
cd frontend && npm install && npm run dev
```

### 3. Build Scripts
- **`build_portable.bat`**: Generate a single-file portable EXE.
- **`build_gh_pages.bat`**: Build the GitHub Pages static web version.
- **`verify_static_site.bat`**: Build and start a local static server for verification (simulating GitHub Pages environment).

### 4. Build & Release (Manual)
If you need to build manually or operate under Linux:
1. **Create Virtual Environment**: `python -m venv .venv`
2. **Activate Virtual Environment**: 
   - Windows: `.venv\Scripts\activate`
   - Linux: `source .venv/bin/activate`
3. **Generate Executable**: Run `python build_portable.py`. The generated single executable will be located at `dist/TheWebWandEngine`.

## ⚖️ Open Source License & Third-Party Credits

### Core Engine
This project integrates the following open-source components:
- **[wand_eval_tree](https://github.com/NathanSnail/wand_eval_tree)** (by NathanSnail): Core Lua simulation engine.
  - **Modification Description**: This repository includes a modified version of the engine, fixing negative number parsing issues under specific attributes and adding support for standard JSON data export.
  - **License**: [GPL-3.0](./wand_eval_tree/LICENSE.txt)

### Acknowledgments
During development, the following projects provided great inspiration and reference:
- **[Component Explorer](https://github.com/dextercd/Noita-Component-Explorer)**: Reference for core component field parsing.
- **[Spell Lab Shugged](https://github.com/shoozzzh/Spell-Lab-Shugged)**: Excellent wand editing tool, provided UI interaction inspiration for this project.
- **[Wand Editor](https://github.com/KagiamamaHIna/Wand-Editor)**: Excellent wand editing tool, this project referenced its UI design and used some code parts.
- **[KuroLeaf's Noita Aliases](https://noita.wiki.gg/zh/wiki/User:KuroLeaf/aliases.csv)**: Alias mapping data support for Pinyin search.

## 📝 License
This project is under the **GPL-3.0** license.

---
*Disclaimer: This project has no official affiliation with Nolla Games. Please respect original game copyrights.*
