use tauri_plugin_opener::OpenerExt;

#[tauri::command]
fn open_external_url(_app: tauri::AppHandle, url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    _app.opener()
        .open_url(url, None::<&str>)
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    set_windows_app_id();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![open_external_url])
        .run(tauri::generate_context!())
        .expect("error while running Prime Bingo desktop");
}

#[cfg(target_os = "windows")]
fn set_windows_app_id() {
    use windows_sys::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;

    let app_id: Vec<u16> = "com.wcrllc.primebingo"
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let _ = SetCurrentProcessExplicitAppUserModelID(app_id.as_ptr());
    }
}
