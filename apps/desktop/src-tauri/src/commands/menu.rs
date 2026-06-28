use crate::commands::registry::read_vault_registry;
use tauri::menu::{Menu, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Runtime};

const RECENTS_SUBMENU_ID: &str = "recents-submenu";

pub fn build_menu<R: Runtime>(app: &AppHandle<R>) -> Result<Menu<R>, tauri::Error> {
    let recents_submenu = build_recents_submenu(app)?;

    let new_note = MenuItemBuilder::with_id("menu-new-note", "New Note")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;

    let open_vault = MenuItemBuilder::with_id("menu-open-vault", "Open Vault...")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;

    let close_vault = MenuItemBuilder::with_id("menu-close-vault", "Close Vault").build(app)?;

    let settings = MenuItemBuilder::with_id("menu-open-settings", "Settings...")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let command_palette = MenuItemBuilder::with_id("menu-command-palette", "Command Palette")
        .accelerator("CmdOrCtrl+Shift+P")
        .build(app)?;

    let search_vault = MenuItemBuilder::with_id("menu-search-vault", "Search in Vault")
        .accelerator("CmdOrCtrl+F")
        .build(app)?;

    let toggle_sidebar = MenuItemBuilder::with_id("menu-toggle-sidebar", "Toggle Sidebar")
        .accelerator("CmdOrCtrl+B")
        .build(app)?;

    let toggle_theme = MenuItemBuilder::with_id("menu-toggle-theme", "Toggle Colorscheme")
        .accelerator("CmdOrCtrl+Shift+L")
        .build(app)?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&new_note)
        .separator()
        .item(&open_vault)
        .item(&recents_submenu)
        .separator()
        .item(&close_vault)
        .build()?;

    let app_menu = SubmenuBuilder::new(app, "Cortex")
        .about(None)
        .separator()
        .item(&settings)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let navigate_menu = SubmenuBuilder::new(app, "Navigate")
        .item(&command_palette)
        .separator()
        .item(&search_vault)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&toggle_sidebar)
        .item(&toggle_theme)
        .separator()
        .fullscreen()
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .separator()
        .close_window()
        .build()?;

    let menu = Menu::with_items(
        app,
        &[
            &app_menu,
            &file_menu,
            &edit_menu,
            &navigate_menu,
            &view_menu,
            &window_menu,
        ],
    )?;

    Ok(menu)
}

fn build_recents_submenu<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<tauri::menu::Submenu<R>, tauri::Error> {
    let mut builder = SubmenuBuilder::with_id(app, RECENTS_SUBMENU_ID, "Recents");

    let entries = read_vault_registry().unwrap_or_default();

    if entries.is_empty() {
        let no_recents = MenuItemBuilder::with_id("no-recents", "No Recent Vaults")
            .enabled(false)
            .build(app)?;
        builder = builder.item(&no_recents);
    } else {
        for entry in &entries {
            let item_id = format!("recent-vault:{}", entry.path);
            let item = MenuItemBuilder::with_id(item_id, &entry.name).build(app)?;
            builder = builder.item(&item);
        }
    }

    builder.build()
}

pub fn setup_menu_event_handler<R: Runtime>(app: &AppHandle<R>) {
    let handle = app.clone();
    app.on_menu_event(move |_app, event| {
        let id = event.id().0.as_str();

        if id == "menu-new-note" {
            let _ = handle.emit("menu-new-note", ());
            return;
        }

        if id == "menu-open-vault" {
            let _ = handle.emit("menu-open-vault", ());
            return;
        }

        if id == "menu-close-vault" {
            let _ = handle.emit("menu-close-vault", ());
            return;
        }

        if id == "menu-open-settings" {
            let _ = handle.emit("menu-open-settings", ());
            return;
        }

        if id == "menu-toggle-sidebar" {
            let _ = handle.emit("menu-toggle-sidebar", ());
            return;
        }

        if id == "menu-search-vault" {
            let _ = handle.emit("menu-search-vault", ());
            return;
        }

        if id == "menu-command-palette" {
            let _ = handle.emit("menu-command-palette", ());
            return;
        }

        if id == "menu-toggle-theme" {
            let _ = handle.emit("menu-toggle-theme", ());
            return;
        }

        if let Some(path) = id.strip_prefix("recent-vault:") {
            let _ = handle.emit("menu-recent-vault", path.to_string());
        }
    });
}

#[tauri::command]
pub fn refresh_menu_recents(app: AppHandle) -> Result<(), String> {
    let menu = app.menu().ok_or("No menu found")?;

    let old_submenu = menu
        .get(RECENTS_SUBMENU_ID)
        .ok_or("Recents submenu not found")?;

    menu.remove(&old_submenu).map_err(|e| e.to_string())?;

    let new_submenu = build_recents_submenu(&app).map_err(|e| e.to_string())?;

    let file_menu_item = menu.get("File").ok_or("File menu not found")?;
    if let Some(file_submenu) = file_menu_item.as_submenu() {
        file_submenu
            .insert(&new_submenu, 3)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
