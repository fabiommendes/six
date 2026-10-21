//! Statistics of a match between two bots: points, Elo with its 95%
//! interval from the trinomial variance (win, draw, loss), and the win rate
//! with its Wilson interval.

/// The normal quantile of a two-sided 95% interval.
const Z95: f64 = 1.959_963_984_540_054;

/// Wins, draws and losses of one bot against another.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Tally {
    pub wins: u64,
    pub draws: u64,
    pub losses: u64,
}

impl Tally {
    /// The number of games.
    pub fn games(&self) -> u64 {
        self.wins + self.draws + self.losses
    }

    /// Points: 1 per win, 1/2 per draw.
    pub fn points(&self) -> f64 {
        self.wins as f64 + self.draws as f64 / 2.0
    }

    /// Points per game, from 0 to 1.
    pub fn score(&self) -> f64 {
        self.points() / self.games() as f64
    }

    /// The Elo difference that predicts `score`: positive when this bot is
    /// stronger, infinite when it won or lost every game.
    pub fn elo(&self) -> f64 {
        elo(self.score())
    }

    /// The 95% interval of the Elo difference: the score plus or minus 1.96
    /// standard errors, from the variance of the outcome of one game
    /// (trinomial: 1, 1/2 or 0), mapped to Elo.
    pub fn elo_interval(&self) -> (f64, f64) {
        let n = self.games() as f64;
        let s = self.score();
        let variance = (self.wins as f64 * (1.0 - s).powi(2)
            + self.draws as f64 * (0.5 - s).powi(2)
            + self.losses as f64 * s.powi(2))
            / n;
        let margin = Z95 * (variance / n).sqrt();
        (elo(s - margin), elo(s + margin))
    }

    /// Wins per game. Draws do not count.
    pub fn win_rate(&self) -> f64 {
        self.wins as f64 / self.games() as f64
    }

    /// The 95% Wilson interval of the win rate.
    pub fn win_rate_interval(&self) -> (f64, f64) {
        wilson(self.wins, self.games())
    }

    /// The same games seen from the other bot.
    pub fn flipped(&self) -> Tally {
        Tally {
            wins: self.losses,
            draws: self.draws,
            losses: self.wins,
        }
    }
}

/// The Elo difference whose expected score is `score`.
pub fn elo(score: f64) -> f64 {
    if score <= 0.0 {
        f64::NEG_INFINITY
    } else if score >= 1.0 {
        f64::INFINITY
    } else {
        -400.0 * (1.0 / score - 1.0).log10()
    }
}

/// The 95% Wilson interval of a proportion of `k` in `n`.
pub fn wilson(k: u64, n: u64) -> (f64, f64) {
    let n = n as f64;
    let p = k as f64 / n;
    let z2 = Z95 * Z95;
    let denominator = 1.0 + z2 / n;
    let center = (p + z2 / (2.0 * n)) / denominator;
    let half = Z95 * (p * (1.0 - p) / n + z2 / (4.0 * n * n)).sqrt() / denominator;
    ((center - half).max(0.0), (center + half).min(1.0))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() < 0.05
    }

    #[test]
    fn elo_and_interval_of_60_20_20() {
        // s = 0.7, variance 0.16, standard error 0.04; by hand:
        // elo(0.7) = 400 log10(7/3) = 147.19, elo(0.7 -+ 0.0784).
        let tally = Tally {
            wins: 60,
            draws: 20,
            losses: 20,
        };
        assert_eq!(tally.points(), 70.0);
        assert!(close(tally.elo(), 147.19));
        let (low, high) = tally.elo_interval();
        assert!(close(low, 86.22), "{low}");
        assert!(close(high, 218.25), "{high}");
        assert!(close(tally.flipped().elo(), -147.19));
    }

    #[test]
    fn an_even_match_is_zero_elo() {
        let tally = Tally {
            wins: 10,
            draws: 80,
            losses: 10,
        };
        assert!(close(tally.elo(), 0.0));
        let (low, high) = tally.elo_interval();
        assert!(close(low, -high));
    }

    #[test]
    fn wilson_interval_by_hand() {
        let tally = Tally {
            wins: 370,
            draws: 20,
            losses: 10,
        };
        assert!(close(tally.win_rate(), 0.925));
        let (low, high) = tally.win_rate_interval();
        assert!((low - 0.89495).abs() < 1e-4, "{low}");
        assert!((high - 0.94696).abs() < 1e-4, "{high}");
        let (low, high) = wilson(10, 10);
        assert!((low - 0.72246).abs() < 1e-3 && high > 0.9999);
    }

    #[test]
    fn a_clean_sweep_is_infinite_elo() {
        let tally = Tally {
            wins: 5,
            draws: 0,
            losses: 0,
        };
        assert_eq!(tally.elo(), f64::INFINITY);
    }
}
