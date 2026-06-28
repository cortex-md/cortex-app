pub enum MergeResult {
    Clean(String),
    WithConflicts(String),
}

pub fn merge_markdown(ancestor: &str, local: &str, remote: &str) -> MergeResult {
    if local == remote {
        return MergeResult::Clean(local.to_string());
    }
    if local == ancestor {
        return MergeResult::Clean(remote.to_string());
    }
    if remote == ancestor {
        return MergeResult::Clean(local.to_string());
    }

    let dmp = dmp::new();

    let local_patches = dmp.patch_make1(ancestor, local);
    let apply_result = dmp.patch_apply(&local_patches, ancestor);
    let (merged_chars, local_results) = match apply_result {
        Ok(result) => result,
        Err(_) => return MergeResult::WithConflicts(conflict_markers(local, remote)),
    };
    let merged: String = merged_chars.into_iter().collect();

    let remote_patches = dmp.patch_make1(ancestor, remote);
    let apply_result = dmp.patch_apply(&remote_patches, &merged);
    let (final_chars, remote_results) = match apply_result {
        Ok(result) => result,
        Err(_) => return MergeResult::WithConflicts(conflict_markers(local, remote)),
    };
    let merged: String = final_chars.into_iter().collect();

    let all_applied = local_results.iter().all(|&r| r) && remote_results.iter().all(|&r| r);

    if all_applied {
        MergeResult::Clean(merged)
    } else {
        MergeResult::WithConflicts(conflict_markers(local, remote))
    }
}

fn conflict_markers(local: &str, remote: &str) -> String {
    format!(
        "<<<<<<< LOCAL\n{}\n=======\n{}\n>>>>>>> REMOTE\n",
        local, remote
    )
}

pub fn merge_binary(local_mtime: Option<i64>, remote_mtime: Option<i64>) -> BinaryWinner {
    match (local_mtime, remote_mtime) {
        (Some(l), Some(r)) if l >= r => BinaryWinner::Local,
        (Some(_), Some(_)) => BinaryWinner::Remote,
        (Some(_), None) => BinaryWinner::Local,
        (None, Some(_)) => BinaryWinner::Remote,
        (None, None) => BinaryWinner::Remote,
    }
}

pub enum BinaryWinner {
    Local,
    Remote,
}

pub fn merge_json(ancestor: &str, local: &str, remote: &str) -> Result<MergeResult, String> {
    let ancestor_val: serde_json::Value =
        serde_json::from_str(ancestor).map_err(|e| e.to_string())?;
    let local_val: serde_json::Value = serde_json::from_str(local).map_err(|e| e.to_string())?;
    let remote_val: serde_json::Value = serde_json::from_str(remote).map_err(|e| e.to_string())?;

    let merged = merge_json_values(&ancestor_val, &local_val, &remote_val);
    let output = serde_json::to_string_pretty(&merged).map_err(|e| e.to_string())?;
    Ok(MergeResult::Clean(output))
}

fn merge_json_values(
    ancestor: &serde_json::Value,
    local: &serde_json::Value,
    remote: &serde_json::Value,
) -> serde_json::Value {
    use serde_json::Value;

    match (ancestor, local, remote) {
        (Value::Object(a), Value::Object(l), Value::Object(r)) => {
            let mut merged = serde_json::Map::new();
            let mut all_keys: std::collections::HashSet<String> = std::collections::HashSet::new();
            for key in a.keys().chain(l.keys()).chain(r.keys()) {
                all_keys.insert(key.clone());
            }

            for key in &all_keys {
                let a_val = a.get(key);
                let l_val = l.get(key);
                let r_val = r.get(key);

                match (a_val, l_val, r_val) {
                    (_, Some(lv), Some(rv)) if lv == rv => {
                        merged.insert(key.clone(), lv.clone());
                    }
                    (Some(av), Some(lv), Some(rv)) if lv == av => {
                        merged.insert(key.clone(), rv.clone());
                    }
                    (Some(av), Some(lv), Some(rv)) if rv == av => {
                        merged.insert(key.clone(), lv.clone());
                    }
                    (Some(av), Some(lv), Some(rv)) => {
                        let child = merge_json_values(av, lv, rv);
                        merged.insert(key.clone(), child);
                    }
                    (Some(_), Some(lv), None) => {
                        merged.insert(key.clone(), lv.clone());
                    }
                    (Some(_), None, Some(rv)) => {
                        merged.insert(key.clone(), rv.clone());
                    }
                    (None, Some(lv), Some(rv)) => {
                        let winner = if has_newer_updated_at(lv, rv) { lv } else { rv };
                        merged.insert(key.clone(), winner.clone());
                    }
                    (None, Some(lv), None) => {
                        merged.insert(key.clone(), lv.clone());
                    }
                    (None, None, Some(rv)) => {
                        merged.insert(key.clone(), rv.clone());
                    }
                    (Some(_), None, None) => {}
                    (None, None, None) => {}
                }
            }
            Value::Object(merged)
        }
        (_, l, r) if l == r => l.clone(),
        (a, l, _r) if l == a => _r.clone(),
        (a, _l, r) if r == a => _l.clone(),
        (_, l, r) => {
            if has_newer_updated_at(l, r) {
                l.clone()
            } else {
                r.clone()
            }
        }
    }
}

fn has_newer_updated_at(a: &serde_json::Value, b: &serde_json::Value) -> bool {
    let a_time = a.get("updatedAt").and_then(|v| v.as_str()).unwrap_or("");
    let b_time = b.get("updatedAt").and_then(|v| v.as_str()).unwrap_or("");
    a_time >= b_time
}

pub fn is_markdown(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown")
}

pub fn is_json_config(path: &str) -> bool {
    path.starts_with(".cortex/") && path.ends_with(".json")
}

pub fn is_binary(path: &str) -> bool {
    !is_markdown(path) && !is_json_config(path)
}
