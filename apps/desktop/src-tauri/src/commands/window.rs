#[tauri::command]
pub fn restart_app(app: tauri::AppHandle) {
    app.request_restart();
}
