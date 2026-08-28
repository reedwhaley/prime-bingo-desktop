# Prime Bingo Desktop

Prime Bingo is a custom Bingo platform built for the **Metroid Prime Randomizer community**. It supports normal Bingo play, tournament rooms, team play, fog of war, live shared boards, and our custom **Central Dynamo** format.

The desktop app connects directly to the Prime Bingo service at [mprandomizer.com](https://mprandomizer.com) and uses your Discord account for sign-in.

> **Current status:** Prime Bingo is in active community testing. If you manage to make it do something stupid, that is useful information.

## Download

Grab the latest release here:

**[Prime Bingo Desktop Releases](https://github.com/reedwhaley/prime-bingo-desktop/releases)**

Release builds are produced for Windows, macOS, and Linux. Download the installer/package for your operating system and run it normally.

## Getting started

### 1. Sign in with Discord

Launch Prime Bingo and click **Sign in with Discord**.

The app will open your default browser so you can authorize the desktop client. Finish the sign-in there, then return to Prime Bingo. The app will remember your desktop session so you normally will not need to sign in again every time you open it.

### 2. Open the Room Browser

Once signed in, you will land in the **Room Browser**.

From there you can:

- open a room you have access to
- create a practice room
- refresh the room list
- open **User settings**

Click a room card to open it, then use the available room actions to join, ready up, leave, report a result, or perform any staff actions you have permission to use.

### 3. Create a room

Click **Create room** from the Room Browser.

The creation form lets you choose the game, Bingo variant, board options, and other available room settings. Practice rooms can be created directly from the desktop client.

Prime Bingo currently supports:

- **Metroid Prime Randomizer**
- **Metroid Prime 2: Echoes Randomizer**
- **Metroid Prime 1 & 2 Crossgame Randomizer**

## Board generation algorithms

When you create a room, the **Algorithm** setting controls how goals and difficulty are arranged on the board. It does **not** change the Randovania seed or game logic. It only changes how Prime Bingo builds the Bingo board from the available goal pool.

Prime Bingo currently offers three generation styles:

### Random

**Random** is the least structured option.

Goals are selected and placed without trying to create a deliberate difficulty pattern across the board. Normal duplicate prevention and the goal list's tag restrictions still apply, but there is no attempt to make every row, column, or route follow a particular difficulty curve.

Use Random when you want the board to be unpredictable and are less concerned about how evenly the difficulty is distributed.

### SRLv5

**SRLv5** is based on the long-running SpeedRunsLive/BingoSync v5 style of Bingo generation.

Instead of treating every square as interchangeable, SRLv5 spreads difficulty buckets around the board and then selects a goal appropriate for the difficulty assigned to each position. On a traditional 5x5 board, the original SRLv5 model uses the full 1-25 difficulty range across the 25 squares.

It also considers goal relationships while filling the board. Prime Bingo's **line tags** are used to discourage or prevent closely related goals from ending up together where the configured line restriction says they should not. The result is generally a more deliberately balanced board than Random while still leaving plenty of variation between generations.

For larger formats such as Central Dynamo, Prime Bingo adapts the same difficulty-distribution approach to the selected board size rather than pretending a 9x9 board somehow still contains only 25 squares. The fixed `Start` cells are handled separately from generated goals.

Use SRLv5 when you want difficulty spread across the board with the normal goal-tag balancing doing most of the cleanup work.

### Isaac's

**Isaac's** is based on the classic Binding of Isaac Bingo generator style.

Rather than using 25 individual difficulty buckets like SRLv5, Isaac's groups goals into broader difficulty bands and places those bands according to a more structured difficulty layout. A goal is then chosen from the pool appropriate for that position.

This tends to produce a board with a more obvious mixture of easier, middle, and harder goals instead of the finer 1-25 distribution used by SRLv5.

Prime Bingo still applies its own goal restrictions when choosing the actual goals, including the board and line tag rules defined in the goal lists. In other words, choosing Isaac's changes the difficulty layout; it does not turn off the protections against bad or repetitive goal combinations.

Use Isaac's when you want a structured difficulty pattern but prefer broader difficulty bands over SRLv5's more granular spread.

### Tags and constraints apply to all algorithms

The algorithm decides **where difficulty goes** and how candidate goals are chosen. The goal-list tags handle **which combinations are allowed or discouraged**.

- **Line tags** are used for relationships that should be restricted within the same Bingo line or equivalent generated relationship.
- **Board tags** are used to spread categories across the board and keep too many similar goals from clustering together.
- Goals are not duplicated on the same board where the generator rules prohibit duplication.

So changing the algorithm should change the shape and feel of the board, not bypass the balancing rules attached to the goals themselves.

## Board controls

The board controls are intentionally simple:

| Control | Action |
| --- | --- |
| **Left click** | Toggle goal completion |
| **Right click** | Toggle a star |
| **Mouse wheel up** | Increment a numeric goal |
| **Mouse wheel down** | Decrement a numeric goal |

Numeric goals use the amount configured for that goal, so counters do not necessarily move one unit at a time.

## Classic Bingo

**Classic Bingo** is the standard 5x5 board format.

Complete goals and mark them on the shared board while the room tracks player state, lines, counters, stars, activity, and results. The exact room rules may vary depending on whether the room is practice, weekly, or tournament play.

## Central Dynamo

**Central Dynamo** is a custom **2v2 team Bingo format** we created for Prime Bingo.

It gets its name from the Central Dynamo maze in Metroid Prime. Once both teams start building routes across a larger shared board, the result looks suspiciously familiar.

Central Dynamo boards can be **7x7, 9x9, 11x11, or 13x13**.

### How it works

Each player builds their own route across the shared board from their assigned starting position.

- Players begin from opposite-corner starting positions.
- After starting a route, you can only continue into goals adjacent to your own currently valid path.
- Each player's route is tracked separately, even though Central Dynamo is a team game.
- The server validates the route before accepting `Done`.

### Marking and ownership

Complete a goal, then mark it. Marking a Central Dynamo tile makes it complete, assigns it to you, and lets it contribute to your route.

- Once a goal has been legitimately completed and marked, it stays complete for Bingo purposes even if you later die, reset, reload, or lose the item in your current save.
- Left click your own completed tile only when correcting a misclick or a goal that should not have been marked.
- A correction clears both completion and ownership. Fog is recalculated from the remaining connected marked route, so cells exposed only by that tile return to fog while overlapping reveals remain visible.
- An eligible player may later complete and own the corrected tile under the normal adjacency rules.

### Counters in Central Dynamo

Numeric counters can only be changed where that specific player's current route allows progress. Reaching the target completes and assigns the tile. Manually decreasing a completed counter below its target is a correction, so completion and ownership are cleared and fog is recalculated from the remaining connected route.

### Finishing

`Done` is only available when the server can validate a current completed and owned start-to-end Central Dynamo path. Completing that path does not finish the race automatically; the player must still select `Done` after their required in-game finish, such as a final boss.

## Fog of war

Rooms can use fog of war to hide goals until they are legitimately revealed.

When a tile is hidden, Prime Bingo also protects related information such as numeric counter progress and hidden goal metadata. Opponent activity can be restricted to board coordinates so the activity feed does not quietly reveal a goal that the board itself is hiding.

If you think fog of war has leaked information, please report it. Those are exactly the kinds of bugs we want to find during testing.

## Stars and numeric goals

**Stars** are personal markers and can be toggled with right click.

Goals with numeric progress display a counter directly on the tile. Use the mouse wheel to increase or decrease the counter. Reaching the goal's target completes it; manually dropping a Central Dynamo counter below the target corrects the mark and clears ownership.

## RaceTime account linking

RaceTime account linking is available from:

**Room Browser -> User settings**

When the production RaceTime OAuth service is available:

1. Click **Connect RaceTime**.
2. Your default browser opens for RaceTime authorization.
3. Finish authorization and return to Prime Bingo.
4. Refresh the room list.
5. The RaceTime card will show **Connected** and the button becomes **Manage RaceTime**.

For supported tournament rooms, the player's manual `Done` action can submit that player's own `.done` to the associated RaceTime room. Board progress and line completion never submit `.done` automatically.

RaceTime OAuth credentials are handled server-side and are not exposed through room snapshots, chat, or board activity data.

## User settings

Open **User settings** from the Room Browser to manage your desktop preferences.

Current settings include:

- player color
- RaceTime account linking when available
- logout

Your player color is used for your board completion, stars, and other player-specific UI where appropriate.

## Tournament and staff tools

Tournament rooms include additional tools that normal practice rooms do not need.

### Board DVR

Authorized staff can open the **Board DVR**, a read-only replay of the Bingo board's event history.

The DVR can reconstruct historical board state without modifying the live room, including:

- goal text
- tile fills
- marks and ownership changes
- stars
- counters
- difficulty colors
- Central Dynamo route state

Staff can select events, scrub through the timeline, step between events, return to live state, or play the replay at speeds from **0.5x to 4x**.

Replay timing distinguishes between **Pre-race**, **T-...**, and **T+...** based on the room's actual activation/RaceTime start.

Tournament room history is retained for review so staff can line board activity up with a race VOD instead of trying to reconstruct everything from memory afterward.

## Troubleshooting

### Discord sign-in does not finish

Make sure you completed the authorization in the browser window that Prime Bingo opened, then return to the app. If the request expired or failed, use **Restart sign-in** and try again.

### A room is missing

Click **Refresh rooms**. The Room Browser only shows rooms your signed-in account is allowed to see.

### I need to correct a Central Dynamo tile

Left click your own completed tile. It becomes incomplete and unowned; cells exposed only through that route return to fog, while cells revealed by another valid route stay visible.

### My Central Dynamo route stopped working

A corrected tile no longer contributes to your route. Mark it again after legitimately completing it, or build another valid connection.

### I cannot increment a Central Dynamo counter

Counters are restricted by your current valid path. Make sure the goal is adjacent to a completed section that you own.

### `Done` is unavailable

For Classic Bingo, score a line first. For Central Dynamo, the server must validate a full start-to-end route made from currently completed tiles owned by your team. In either format, `Done` remains a manual action after the required in-game finish.

### RaceTime still shows disconnected

After completing authorization in your browser, return to Prime Bingo and refresh the room list. RaceTime linking also depends on the production OAuth service being configured on the server.

## Reporting bugs

This is still active testing, so please report anything that looks wrong, even if it seems minor.

The most useful reports include:

- room code
- game and board variant
- player/team involved
- roughly when it happened
- what you were doing
- what you expected to happen
- what actually happened
- screenshots if the problem is visual

GitHub issues can be opened here:

**[Report an issue](https://github.com/reedwhaley/prime-bingo-desktop/issues)**

For tournament testing, the room's event history and Board DVR can also help staff narrow down exactly when something went wrong.

---

# Development

Everything below this point is for people building or working on the desktop client rather than simply using it.

## Project structure

- `src/` - desktop client UI and API integration
- `src-tauri/` - native Tauri wrapper
- `scripts/` - local Windows staging/build helpers

## Local frontend scripts

```powershell
npm install
npm run dev
npm run build
```

## Native desktop scripts

```powershell
npm run tauri:dev
npm run tauri:build
powershell -ExecutionPolicy Bypass -File .\scripts\build-windows.ps1
```

## Recommended Windows build flow

On the current development machine, building directly from the UNC path has been unreliable.

1. Stage the app into `C:\Bingo\desktop_client`:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\stage-to-cbingo.ps1
   ```

2. From `C:\Bingo\desktop_client`, run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\build-windows.ps1
   ```

`build-windows.ps1` normalizes the Rust toolchain path, avoids the stray `devkitPro` `link.exe`, checks for the required Microsoft C++ toolchain and Windows SDK libraries, and then invokes the Tauri build.

## Native prerequisites

For local native builds you will need:

- Node.js / npm
- Rust / Cargo
- Microsoft C++ Build Tools for MSVC on Windows
- Windows 10/11 SDK libraries on Windows

The GitHub release workflow currently builds native release packages for Windows, Ubuntu Linux, and macOS.

## Windows build notes

Direct `npm install` from a UNC path has been unreliable on the current development system because `esbuild` child installers do not behave well with a UNC working directory.

If a native Windows build fails immediately with missing `kernel32.lib` or `msvcrt.lib`, the Tauri app is blocked on the Microsoft build tools / Windows SDK rather than Rust itself.
