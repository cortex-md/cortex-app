use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |folder| {
        let result = folder.map(|f| f.to_string());
        let _ = tx.send(result);
    });
    rx.await.map_err(|e| e.to_string())
}
