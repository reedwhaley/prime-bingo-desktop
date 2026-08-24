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

### Claims and completion are separate

A Central Dynamo tile can be **claimed** without currently being **complete**.

- **Claims are permanent for players.** Once you commit to a tile, you cannot unclaim it just because you do not like what comes next.
- Completing a claimed tile causes it to fill and contribute to your valid route.
- If you later lose that progress, mark the tile incomplete. The claim stays in place, but the route through that tile is broken.
- Recomplete the goal and the connection becomes valid again.
- If a numeric counter drops below its target, the tile becomes incomplete without removing the claim.

This is intentional. Central Dynamo is built around committing to a route rather than revealing a goal, changing your mind, and backing out.

### Counters in Central Dynamo

Numeric counters can only be changed where that specific player's current route allows progress.

If an incomplete claimed tile breaks your route, you cannot continue extending through that broken section until the goal is completed again.

### Finishing

`Done` is only available when the server can validate a complete start-to-end Central Dynamo path with all required claimed tiles currently complete.

If `Done` is unavailable when you think you are finished, check your route for an incomplete claimed tile or a broken connection.

## Fog of war

Rooms can use fog of war to hide goals until they are legitimately revealed.

When a tile is hidden, Prime Bingo also protects related information such as numeric counter progress and hidden goal metadata. Opponent activity can be restricted to board coordinates so the activity feed does not quietly reveal a goal that the board itself is hiding.

If you think fog of war has leaked information, please report it. Those are exactly the kinds of bugs we want to find during testing.

## Stars and numeric goals

**Stars** are personal markers and can be toggled with right click.

Goals with numeric progress display a counter directly on the tile. Use the mouse wheel to increase or decrease the counter. Reaching the goal's target can complete the goal automatically, and dropping back below the target can make it incomplete again where the room rules require it.

## RaceTime account linking

RaceTime account linking is available from:

**Room Browser -> User settings**

When the production RaceTime OAuth service is available:

1. Click **Connect RaceTime**.
2. Your default browser opens for RaceTime authorization.
3. Finish authorization and return to Prime Bingo.
4. Refresh the room list.
5. The RaceTime card will show **Connected** and the button becomes **Manage RaceTime**.

For supported tournament rooms, a verified Bingo completion can submit that player's own `.done` to the associated RaceTime room automatically.

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
- claims
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

### I cannot unclaim a Central Dynamo tile

That is intentional. Player claims in Central Dynamo are permanent. Staff can make corrections when necessary.

### My Central Dynamo route stopped working

Check for a claimed tile that is currently incomplete. An incomplete claimed tile breaks the active connection through that section until the goal is completed again.

### I cannot increment a Central Dynamo counter

Counters are restricted by your current valid path. Make sure the goal is adjacent to a valid section of your own route and that an earlier incomplete tile is not blocking the connection.

### `Done` is unavailable

For Central Dynamo, the server must be able to validate a full start-to-end route and every required claimed tile on that route must currently be complete.

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
