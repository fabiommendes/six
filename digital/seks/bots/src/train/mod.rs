//! Training of the evaluation weights: self-play data ([`selfplay`],
//! [`dataset`]), Texel tuning ([`tune`]) and the generation loop that only
//! promotes weights that beat the previous ones ([`run`]).

pub mod dataset;
pub mod run;
pub mod selfplay;
pub mod tune;
