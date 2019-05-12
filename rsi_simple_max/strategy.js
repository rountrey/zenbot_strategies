/*
 Licence: Creative Common (Zero CC0)
 Contact: rountrey on reddit

 Donations are welcome! 
 BTC:
      1GAJ6a6Fn9hEUUQhYgRXNBc7UZCj3QiGn9
 LTC:
      LeE9Kh6ZeepxUzVvNL6683mKv54zTsxQkJ
 DASH:
      Xs7FAQxtbE3rVJzKbTf3VQ6rtLXMXjU4RP
 DOGE:
      D8Vjsquu4aZxMdvrpHpQfeZkF7HYnQiFy1
 XLM:
      GBP55PX2K67ZI746O2QRIALX34EPZPKRPCHKGOPKAKSXCFDJVLUTQ2RK
 XRP:
      rU9NFC23SSjGK5JFHmBFtAcENXUK7eEM8K
 ZEC:
      t1c8tFqto5fiy343bf4U5PFdRAJNFovBsiJ
 ETH, BNB, BAT, USDC, STORM, AMB, ZRX,:
     0xdF3Be8Ff3a34E5d7A9159EE928B5C6dF6594e859
*/

// IGNORE THIS, STILL WORKING ON IT!!!

var z = require('zero-fill')
  , n = require('numbro')
  , rsi = require('../../../lib/rsi')
  , Phenotypes = require('../../../lib/phenotype')

module.exports = {
  name: 'rsi_simple_max',
  description: 'Attempts to buy low and sell high by tracking RSI high-water readings.',

  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '5m')
    this.option('period_length', 'period length, same as --period', String, '5m')
    this.option('min_periods', 'min. number of history periods', Number, 128)
    this.option('rsi_periods', 'number of RSI periods', 14)
    this.option('oversold_rsi', 'buy when RSI reaches or drops below this value', Number, 30)
    this.option('overbought_rsi', 'sell when RSI reaches or goes above this value', Number, 72)
    this.option('rsi_recover', 'allow RSI to recover this many points before buying', Number, 0)
    this.option('rsi_drop', 'allow RSI to fall this many points before selling', Number, 0)
    this.option('rsi_divisor', 'sell when RSI reaches high-water reading divided by this value', Number, 2)
  },

  calculate: function (s) {
    rsi(s, 'rsi', s.options.rsi_periods)
  },

  onPeriod: function (s, cb) {
    if (s.in_preroll) return cb()
    if (typeof s.period.rsi === 'number') {
        if (s.period.rsi < 48) {
          s.rsi_min = Math.min(s.period.rsi, s.lookback[0].rsi, s.lookback[1].rsi, s.lookback[2].rsi)
            if (s.period.rsi < s.rsi_min) {
              s.signal = null
            } else if (s.period.rsi > s.rsi_min && s.period.rsi < 50) { 
              s.signal = 'buy'
            }
        }

        else if (s.period.rsi > 55) {
          s.rsi_max = Math.max(s.period.rsi, s.lookback[0].rsi, s.lookback[1].rsi, s.lookback[2].rsi)
            if (s.period.rsi > s.rsi_max) {
              s.signal = null
            } else if (s.period.rsi < s.rsi_max && s.period.rsi > 50) { 
              s.signal = 'sell'
            }
        }
    }
    cb()
  },

  onReport: function (s) {
    var cols = []
    if (typeof s.period.rsi === 'number') {
      var color = 'grey'
      if (s.period.rsi <= s.options.oversold_rsi) {
        color = 'green'
      } else if (s.period.rsi >= s.options.overbought_rsi) {
        color = 'red'
      }
      cols.push(z(4, n(s.period.rsi).format('0'), ' ')[color])
    }
    return cols
  },

  phenotypes: {
    // -- common
    period_length: Phenotypes.RangePeriod(1, 120, 'm'),
    min_periods: Phenotypes.Range(1, 200),
    markdown_buy_pct: Phenotypes.RangeFloat(-1, 5),
    markup_sell_pct: Phenotypes.RangeFloat(-1, 5),
    order_type: Phenotypes.ListOption(['maker', 'taker']),
    sell_stop_pct: Phenotypes.Range0(1, 50),
    buy_stop_pct: Phenotypes.Range0(1, 50),
    profit_stop_enable_pct: Phenotypes.Range0(1, 20),
    profit_stop_pct: Phenotypes.Range(1,20),

    // -- strategy
    rsi_periods: Phenotypes.Range(1, 200),
    oversold_rsi: Phenotypes.Range(1, 100),
    overbought_rsi: Phenotypes.Range(1, 100),
    rsi_recover: Phenotypes.Range(1, 100),
    rsi_drop: Phenotypes.Range(0, 100),
    rsi_divisor: Phenotypes.Range(1, 10)
  }
}

