//! Training data: positions from self-play games, in a binary file of
//! fixed-size little-endian records after a header.
//!
//! Header (16 bytes): `SEKSDATA`, the format version (`u32`) and the record
//! size (`u32`). Record (72 bytes):
//!
//! | Bytes | Content |
//! |---|---|
//! | 0..61 | the board, 4 bits per cell by `Cell::index`, low nibble first: 0 empty, 1 to 6 a white die of that value, 7 to 12 a black die of value 1 to 6 |
//! | 61 | bit 0: side to move (1 for the Blacks); bits 1-2: result for the Whites (0 loss, 1 draw, 2 win) |
//! | 62 | plies without a capture |
//! | 63 | unused, 0 |
//! | 64..66 | score of the search, from the side to move (`i16`) |
//! | 66..68 | ply of the position in its game (`u16`) |
//! | 68..72 | game number (`u32`) |

use std::io::{Read, Write};

use seks_engine::{Board, Cell, Die, Side, CELL_COUNT};

const MAGIC: &[u8; 8] = b"SEKSDATA";
const VERSION: u32 = 1;
/// Bytes per record.
pub const RECORD: usize = 72;
const HEADER: usize = 16;

/// How a game ended, for the Whites.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Result {
    Loss = 0,
    Draw = 1,
    Win = 2,
}

/// One position of a self-play game.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Sample {
    pub board: Board,
    pub to_move: Side,
    pub plies_without_capture: u8,
    /// For the Whites.
    pub result: Result,
    /// The search's score, from the side to move.
    pub score: i16,
    pub ply: u16,
    pub game: u32,
}

impl Sample {
    /// The result for the side to move: 1 win, 1/2 draw, 0 loss.
    pub fn outcome_for_mover(&self) -> f64 {
        let white = match self.result {
            Result::Loss => 0.0,
            Result::Draw => 0.5,
            Result::Win => 1.0,
        };
        match self.to_move {
            Side::White => white,
            Side::Black => 1.0 - white,
        }
    }

    pub fn encode(&self) -> [u8; RECORD] {
        let mut bytes = [0; RECORD];
        for index in 0..CELL_COUNT {
            let nibble = match self.board.get(Cell::from_index(index)) {
                None => 0,
                Some(die) => match die.side() {
                    Side::White => die.value(),
                    Side::Black => die.value() + 6,
                },
            };
            bytes[index / 2] |= nibble << (4 * (index % 2));
        }
        bytes[61] = u8::from(self.to_move == Side::Black) | (self.result as u8) << 1;
        bytes[62] = self.plies_without_capture;
        bytes[64..66].copy_from_slice(&self.score.to_le_bytes());
        bytes[66..68].copy_from_slice(&self.ply.to_le_bytes());
        bytes[68..72].copy_from_slice(&self.game.to_le_bytes());
        bytes
    }

    pub fn decode(bytes: &[u8]) -> std::result::Result<Sample, String> {
        let mut board = Board::empty();
        for index in 0..CELL_COUNT {
            let nibble = (bytes[index / 2] >> (4 * (index % 2))) & 0x0F;
            let die = match nibble {
                0 => None,
                1..=6 => Some(Die::new(Side::White, nibble)),
                7..=12 => Some(Die::new(Side::Black, nibble - 6)),
                _ => return Err(format!("bad cell code {nibble}")),
            };
            board.set(Cell::from_index(index), die);
        }
        let result = match (bytes[61] >> 1) & 3 {
            0 => Result::Loss,
            1 => Result::Draw,
            2 => Result::Win,
            other => return Err(format!("bad result code {other}")),
        };
        Ok(Sample {
            board,
            to_move: if bytes[61] & 1 == 1 {
                Side::Black
            } else {
                Side::White
            },
            plies_without_capture: bytes[62],
            result,
            score: i16::from_le_bytes([bytes[64], bytes[65]]),
            ply: u16::from_le_bytes([bytes[66], bytes[67]]),
            game: u32::from_le_bytes([bytes[68], bytes[69], bytes[70], bytes[71]]),
        })
    }
}

/// Writes the header of a data file.
pub fn write_header(out: &mut impl Write) -> std::io::Result<()> {
    out.write_all(MAGIC)?;
    out.write_all(&VERSION.to_le_bytes())?;
    out.write_all(&(RECORD as u32).to_le_bytes())
}

/// Reads every sample of a data file.
pub fn read(input: &mut impl Read) -> std::result::Result<Vec<Sample>, String> {
    let mut bytes = Vec::new();
    input.read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    if bytes.len() < HEADER || &bytes[..8] != MAGIC {
        return Err("not a seks-bots data file".into());
    }
    let version = u32::from_le_bytes(bytes[8..12].try_into().unwrap());
    let size = u32::from_le_bytes(bytes[12..16].try_into().unwrap()) as usize;
    if version != VERSION || size != RECORD {
        return Err(format!(
            "data format {version} with {size}-byte records is not supported"
        ));
    }
    let body = &bytes[HEADER..];
    if body.len() % RECORD != 0 {
        return Err("the file ends in the middle of a record".into());
    }
    body.chunks_exact(RECORD).map(Sample::decode).collect()
}

/// Reads a data file by path in chunks of up to `chunk` samples, calling
/// `f` on each, so a large file never sits whole in memory.
pub fn read_chunks(
    path: &std::path::Path,
    chunk: usize,
    f: &mut dyn FnMut(&[Sample]),
) -> std::result::Result<usize, String> {
    let error = |e: String| format!("{}: {e}", path.display());
    let file = std::fs::File::open(path).map_err(|e| error(e.to_string()))?;
    let mut input = std::io::BufReader::new(file);
    let mut header = [0; HEADER];
    input
        .read_exact(&mut header)
        .map_err(|_| error("not a seks-bots data file".into()))?;
    check_header(&header).map_err(error)?;
    let mut bytes = vec![0; RECORD * chunk.max(1)];
    let mut samples = Vec::with_capacity(chunk.max(1));
    let mut total = 0;
    loop {
        let mut filled = 0;
        while filled < bytes.len() {
            match input.read(&mut bytes[filled..]) {
                Ok(0) => break,
                Ok(n) => filled += n,
                Err(e) => return Err(error(e.to_string())),
            }
        }
        if filled % RECORD != 0 {
            return Err(error("the file ends in the middle of a record".into()));
        }
        samples.clear();
        for record in bytes[..filled].chunks_exact(RECORD) {
            samples.push(Sample::decode(record).map_err(error)?);
        }
        if !samples.is_empty() {
            f(&samples);
            total += samples.len();
        }
        if filled < bytes.len() {
            return Ok(total);
        }
    }
}

fn check_header(bytes: &[u8]) -> std::result::Result<(), String> {
    if bytes.len() < HEADER || &bytes[..8] != MAGIC {
        return Err("not a seks-bots data file".into());
    }
    let version = u32::from_le_bytes(bytes[8..12].try_into().unwrap());
    let size = u32::from_le_bytes(bytes[12..16].try_into().unwrap()) as usize;
    if version != VERSION || size != RECORD {
        return Err(format!(
            "data format {version} with {size}-byte records is not supported"
        ));
    }
    Ok(())
}

/// Reads a data file by path.
pub fn read_file(path: &std::path::Path) -> std::result::Result<Vec<Sample>, String> {
    let mut file = std::fs::File::open(path).map_err(|e| format!("{}: {e}", path.display()))?;
    read(&mut file).map_err(|e| format!("{}: {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn records_round_trip() {
        let mut board = Board::initial();
        board.set(Cell::new(6, 6), Some(Die::new(Side::Black, 6)));
        board.set(Cell::new(11, 11), Some(Die::new(Side::White, 3)));
        let sample = Sample {
            board,
            to_move: Side::Black,
            plies_without_capture: 37,
            result: Result::Draw,
            score: -1234,
            ply: 301,
            game: 70_000,
        };
        assert_eq!(Sample::decode(&sample.encode()).unwrap(), sample);
        let mut file = Vec::new();
        write_header(&mut file).unwrap();
        file.extend_from_slice(&sample.encode());
        file.extend_from_slice(&sample.encode());
        assert_eq!(read(&mut file.as_slice()).unwrap(), vec![sample, sample]);
        assert!(read(&mut &file[..file.len() - 1]).is_err());
        let path = std::env::temp_dir().join(format!("seks-data-{}.bin", std::process::id()));
        file.extend_from_slice(&sample.encode());
        std::fs::write(&path, &file).unwrap();
        let mut sizes = Vec::new();
        let total = read_chunks(&path, 2, &mut |chunk| sizes.push(chunk.len())).unwrap();
        std::fs::remove_file(&path).unwrap();
        assert_eq!((total, sizes), (3, vec![2, 1]));
    }

    #[test]
    fn the_result_turns_with_the_side_to_move() {
        let mut sample = Sample {
            board: Board::initial(),
            to_move: Side::White,
            plies_without_capture: 0,
            result: Result::Win,
            score: 0,
            ply: 0,
            game: 0,
        };
        assert_eq!(sample.outcome_for_mover(), 1.0);
        sample.to_move = Side::Black;
        assert_eq!(sample.outcome_for_mover(), 0.0);
    }
}
