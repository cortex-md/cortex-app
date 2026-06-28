#[cfg(target_os = "macos")]
use crate::commands::registry::read_vault_registry;
#[cfg(target_os = "macos")]
use tauri::AppHandle;

#[cfg(target_os = "macos")]
pub fn setup_dock_menu(_app: &AppHandle) {
    use objc2::rc::Retained;
    use objc2::runtime::{AnyClass, AnyObject};
    use objc2::{msg_send, msg_send_id};
    use objc2_foundation::NSString;

    let entries = read_vault_registry().unwrap_or_default();

    unsafe {
        let menu_cls = match AnyClass::get("NSMenu") {
            Some(c) => c,
            None => return,
        };
        let menu: Retained<AnyObject> = msg_send_id![menu_cls, new];
        let _: () = msg_send![&menu, setAutoenablesItems: false];

        let item_cls = match AnyClass::get("NSMenuItem") {
            Some(c) => c,
            None => return,
        };

        for entry in &entries {
            let title = NSString::from_str(&entry.name);
            let item: Retained<AnyObject> = msg_send_id![item_cls, new];
            let _: () = msg_send![&item, setTitle: &*title];
            let _: () = msg_send![&item, setEnabled: true];
            let _: () = msg_send![&menu, addItem: &*item];
        }

        let app_cls = match AnyClass::get("NSApplication") {
            Some(c) => c,
            None => return,
        };
        let ns_app: Retained<AnyObject> = msg_send_id![app_cls, sharedApplication];
        let _: () = msg_send![&ns_app, setDockMenu: &*menu];
    }
}

#[cfg(target_os = "macos")]
pub fn refresh_dock_menu(app: &AppHandle) {
    setup_dock_menu(app);
}
