//! The weights of the evaluation, read from and written to JSON.
//!
//! The file has one key per group of features (`EVALUATOR.md`), with a
//! number or nested arrays: `material[value - 1]`,
//! `pst[row - 1][column - 1][value - 1]` and so on, and a free `meta` object
//! that records where the weights came from. The unit is about a hundredth
//! of a die.

use std::fmt::Write;

use serde_json::{Map, Value};

use super::features::{
    AT_RISK_THEM, AT_RISK_US, BLOCKERS_THEM, BLOCKERS_US, COLUMNS, COUNT, GAPS, GAP_THEM, GAP_US,
    MATERIAL, PST, ROWS, TEMPO, THREATS_THEM, THREATS_US, VALUES,
};

/// The groups of the file: key, offset in the vector and shape (empty for
/// a single number).
const GROUPS: [(&str, usize, &[usize]); 11] = [
    ("material", MATERIAL, &[VALUES]),
    ("pst", PST, &[ROWS, COLUMNS, VALUES]),
    ("gap_us", GAP_US, &[GAPS]),
    ("gap_them", GAP_THEM, &[GAPS]),
    ("at_risk_us", AT_RISK_US, &[]),
    ("at_risk_them", AT_RISK_THEM, &[]),
    ("blockers_us", BLOCKERS_US, &[]),
    ("blockers_them", BLOCKERS_THEM, &[]),
    ("threats_us", THREATS_US, &[]),
    ("threats_them", THREATS_THEM, &[]),
    ("tempo", TEMPO, &[]),
];

const DEFAULT_JSON: &str = include_str!("../../weights/default.json");
const HAND_JSON: &str = include_str!("../../weights/hand.json");

/// One weight per feature, and where they came from.
#[derive(Clone, Debug, PartialEq)]
pub struct Weights {
    pub values: Vec<f64>,
    pub meta: Value,
}

impl Default for Weights {
    /// The weights of the default bot (`weights/default.json`).
    fn default() -> Weights {
        Weights::from_json(DEFAULT_JSON).expect("weights/default.json is valid")
    }
}

impl Weights {
    /// The hand-set weights (`weights/hand.json`), the baseline of training.
    pub fn hand() -> Weights {
        Weights::from_json(HAND_JSON).expect("weights/hand.json is valid")
    }

    /// All weights 0.
    pub fn zero() -> Weights {
        Weights {
            values: vec![0.0; COUNT],
            meta: Value::Object(Map::new()),
        }
    }

    /// Reads a weights file. Every group must be present, with its shape.
    pub fn from_json(text: &str) -> Result<Weights, String> {
        let root: Value = serde_json::from_str(text).map_err(|e| e.to_string())?;
        let object = root
            .as_object()
            .ok_or("the weights must be a JSON object")?;
        let mut weights = Weights::zero();
        for key in object.keys() {
            if key != "meta" && !GROUPS.iter().any(|(name, _, _)| name == key) {
                return Err(format!("unknown weight group {key:?}"));
            }
        }
        for (name, offset, shape) in GROUPS {
            let value = object
                .get(name)
                .ok_or(format!("missing weight group {name:?}"))?;
            let mut flat = Vec::new();
            flatten(value, shape, &mut flat).map_err(|e| format!("{name}: {e}"))?;
            weights.values[offset..offset + flat.len()].copy_from_slice(&flat);
        }
        if let Some(meta) = object.get("meta") {
            weights.meta = meta.clone();
        }
        Ok(weights)
    }

    /// The file text: one line per innermost array.
    pub fn to_json(&self) -> String {
        let mut text = String::from("{\n");
        let meta = serde_json::to_string(&self.meta).expect("meta is JSON");
        writeln!(text, "  \"meta\": {meta},").unwrap();
        for (i, (name, offset, shape)) in GROUPS.iter().enumerate() {
            let size: usize = shape.iter().product();
            write!(text, "  \"{name}\": ").unwrap();
            nest(&self.values[*offset..*offset + size], shape, 1, &mut text);
            text.push_str(if i + 1 < GROUPS.len() { ",\n" } else { "\n" });
        }
        text.push_str("}\n");
        text
    }
}

fn flatten(value: &Value, shape: &[usize], out: &mut Vec<f64>) -> Result<(), String> {
    match shape.split_first() {
        None => {
            out.push(value.as_f64().ok_or("expected a number")?);
            Ok(())
        }
        Some((&len, rest)) => {
            let array = value.as_array().ok_or("expected an array")?;
            if array.len() != len {
                return Err(format!("expected {len} entries, found {}", array.len()));
            }
            array.iter().try_for_each(|item| flatten(item, rest, out))
        }
    }
}

/// Writes `values` with `shape` as nested arrays, indented by `level`.
fn nest(values: &[f64], shape: &[usize], level: usize, text: &mut String) {
    match shape {
        [] => text.push_str(&number(values[0])),
        [_] => {
            let items: Vec<String> = values.iter().map(|&v| number(v)).collect();
            write!(text, "[{}]", items.join(", ")).unwrap();
        }
        [len, rest @ ..] => {
            let step = values.len() / len;
            text.push_str("[\n");
            for i in 0..*len {
                text.push_str(&"  ".repeat(level + 1));
                nest(&values[i * step..(i + 1) * step], rest, level + 1, text);
                text.push_str(if i + 1 < *len { ",\n" } else { "\n" });
            }
            text.push_str(&"  ".repeat(level));
            text.push(']');
        }
    }
}

/// A weight with 2 decimals, without trailing zeros.
fn number(value: f64) -> String {
    let text = format!("{value:.2}");
    let text = text.trim_end_matches('0').trim_end_matches('.');
    if text == "-0" {
        "0".into()
    } else {
        text.into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_embedded_weights_read_and_round_trip() {
        for weights in [Weights::default(), Weights::hand()] {
            assert_eq!(Weights::from_json(&weights.to_json()).unwrap(), weights);
        }
    }

    #[test]
    fn a_missing_or_misshapen_group_is_an_error() {
        let mut value: Value = serde_json::from_str(&Weights::hand().to_json()).unwrap();
        value["material"] = serde_json::json!([1, 2, 3]);
        let error = Weights::from_json(&value.to_string()).unwrap_err();
        assert!(error.contains("material"), "{error}");
        value.as_object_mut().unwrap().remove("material");
        assert!(Weights::from_json(&value.to_string()).is_err());
        let mut value: Value = serde_json::from_str(&Weights::hand().to_json()).unwrap();
        value["mobility"] = serde_json::json!(1);
        assert!(Weights::from_json(&value.to_string()).is_err());
    }
}
