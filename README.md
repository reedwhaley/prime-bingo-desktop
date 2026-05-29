# Prime Bingo Desktop

This folder contains the standalone desktop client frontend and the Tauri wrapper that will produce the Windows executable.

## Current structure

- `src/`: desktop client UI and API integration
- `src-tauri/`: native Tauri wrapper for the standalone app

## Local frontend scripts

- `npm run dev`
- `npm run build`

## Native desktop scripts

- `npm run tauri:dev`
- `npm run tauri:build`
- `powershell -ExecutionPolicy Bypass -File .\scripts\build-windows.ps1`

## Recommended Windows build flow

- Stage the app into `C:\Bingo\desktop_client` first. Building directly from the UNC path has been unreliable on this machine.
- Use `powershell -ExecutionPolicy Bypass -File .\scripts\stage-to-cbingo.ps1` from this repo copy to refresh `C:\Bingo\desktop_client`.
- Run `powershell -ExecutionPolicy Bypass -File .\scripts\build-windows.ps1` from `C:\Bingo\desktop_client`.
- `build-windows.ps1` normalizes the Rust toolchain path, forces the Rust linker away from the stray `devkitPro` `link.exe`, and checks for the required Microsoft C++ toolchain and Windows SDK libs before invoking `npm run tauri:build`.

## Native prerequisites

- Rust/Cargo installed, typically under `C:\Users\Reed Whaley\.cargo\bin`
- Microsoft C++ Build Tools for MSVC
- Windows 10/11 SDK libraries (`kernel32.lib`, `userenv.lib`, `ws2_32.lib`, `dbghelp.lib`)

## Notes

- On this machine, direct `npm install` from the UNC path has been unreliable because `esbuild` child installers do not like a UNC working directory on Windows.
- If the native build fails immediately with missing `kernel32.lib` or `msvcrt.lib`, the Tauri app is still blocked on the Microsoft build tools / Windows SDK, not on Rust itself.
