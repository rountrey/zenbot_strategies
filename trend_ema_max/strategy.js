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
  , ema = require('../../../lib/ema')
  , rsi = require('../../../lib/rsi')
  , stddev = require('../../../lib/stddev')
  , Phenotypes = require('../../../lib/phenotype')

module.exports = {
  name: 'trend_ema_max',
  description:
    'Buy when (EMA - last(EMA) > 0) and sell when (EMA - last(EMA) < 0). Optional buy on low RSI.',

  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '15m')
    this.option('period_length', 'period length, same as --period', String, '15m')
    this.option('min_periods', 'min. number of history periods', Number, 52)
    this.option('trend_ema', 'number of periods for trend EMA', Number, 6)
    this.option('trade_pct', 'at what point to trade', Number, 15)
    this.option('rsi_safety', 'at what point to trade', Number, 3)
    this.option('oversold_rsi_periods', 'number of periods for oversold RSI', Number, 14)
    this.option('oversold_rsi', 'buy when RSI reaches this value', Number, 10)
  },

  calculate: function(s) {
    rsi(s, 'rsi', s.options.rsi_periods)

    ema(s, 'trend_ema', s.options.trend_ema)
    if (s.period.trend_ema && s.lookback[0] && s.lookback[0].trend_ema) {
      s.period.trend_ema_rate = s.period.trend_ema
    }
  },


  onPeriod: function (s, cb) {
//rsi
    if (typeof s.period.rsi === 'number') {
      s.rsi_avg = ((s.period.rsi + s.lookback[0].rsi + s.lookback[1].rsi + s.lookback[2].rsi + s.lookback[3].rsi) / 5)
//      if (s.rsi_avg > 50) {
//        s.trend = 'up'
//      } else if (s.rsi_avg > 50) {
//        s.trend = 'down'
//      }
      if (s.period.rsi <= s.options.oversold_rsi) {
        s.signal = 'buy'
      }
      if (s.period.rsi >= s.options.overbought_rsi) {
        s.signal = 'sell'
      }
    }

    if (typeof s.period.trend_ema === 'number') {
      s.period.ema_avg = ((s.lookback[0].trend_ema + s.lookback[1].trend_ema + s.lookback[2].trend_ema) / 3)
      s.period.ema_diff = ((s.period.trend_ema - s.period.ema_avg) / s.period.ema_avg * 10000)
      if (s.period.trend_ema > s.period.ema_avg && s.period.rsi > 50) {
        s.trend = 'up'
      } else if (s.period.trend_ema < s.period.ema_avg && s.period.rsi < 50) {
        s.trend = 'down'
      }

      if (s.trend === 'down') {
        s.diff_min = Math.min(s.period.ema_diff, s.lookback[0].ema_diff, s.lookback[1].ema_diff)
        if (s.diff_min < s.period.ema_diff && s.options.trade_pct < (s.period.ema_diff * -1) && s.period.rsi < (50 - s.options.rsi_safety)) {
          s.signal = 'buy'
        }
      } else if (s.trend === 'up') {
        s.diff_max = Math.max(s.period.ema_diff, s.lookback[0].ema_diff, s.lookback[1].ema_diff)
        if (s.diff_max > s.period.ema_diff && s.options.trade_pct < (s.period.ema_diff * 1)  && s.period.rsi > (50 + s.options.rsi_safety)) {
          s.signal = 'sell'
        }
      }
    }
    cb()
  },


//    if (typeof s.period.trend_ema === 'number') {
//      if (s.trend !== 'down') {
//        s.acted_on_trend = false
//        s.noise_up = 0
//        }
//        s.trend = 'down'
//        s.ema_min = Math.min(s.period.trend_ema, s.lookback[0].trend_ema, s.lookback[1].trend_ema)
//        s.noise_down = ((s.ema_max - s.ema_min) / s.ema_max * 1)
//        s.period.noise = ((s.ema_max - s.ema_min) / s.ema_max * -1)
//        s.noise_min = Math.min(s.period.noise, s.lookback[0].noise, s.lookback[1].noise)
//          if (s.options.noise_level_pct != 0 && s.noise_down < s.options.noise_level_pct) {
//            s.signal = null
//          } else if (s.trend === 'down' && s.period.trend_ema >= s.ema_min) {
//              if (s.options.multi_trade === 'off') {
//                s.signal = !s.acted_on_trend ? 'buy' : null
//                s.ema_min_lock = s.ema_min
//              } else if (s.options.multi_trade !== 'off') {
//                  s.signal = 'buy'
//                  s.ema_min_lock = s.ema_min
//              }  
//          } 
//      }
//
//      if (s.trend !== 'up') {
//        s.acted_on_trend = false
//        s.noise_up = 0
//        }
//        s.trend = 'up'
//        s.ema_max = Math.max(s.period.trend_ema, s.lookback[0].trend_ema, s.lookback[1].trend_ema)
//        s.noise_up = ((s.ema_min - s.ema_max) / s.ema_min * 1)
//        s.period.noise = ((s.ema_max - s.ema_min) / s.ema_min * -1)
//        s.noise_max = Math.max(s.period.noise, s.lookback[0].noise, s.lookback[1].noise)
//          if (s.options.noise_level_pct != 0 && s.noise_down < s.options.noise_level_pct) {
//            s.signal = null
//          } else if (s.trend === 'up' && s.period.trend_ema <= s.ema_max) {
//              if (s.options.multi_trade === 'off') {
//                s.signal = !s.acted_on_trend ? 'buy' : null
//                s.ema_max_lock = s.ema_max
//              } else if (s.options.multi_trade !== 'off') {
//                  s.signal = 'buy'
//                  s.ema_min_lock = s.ema_min
//              }  
//          } 
//      }
//    }
//    cb()
//  },

  onReport: function(s) {
    var cols = []
    if (typeof s.period.trend_ema === 'number') {
      var color = 'grey'
      if (s.trend !== 'down') {
        color = 'green'
      } else if (s.trend !== 'up') {
        color = 'red'
      }
        cols.push(z(8, n(s.period.trend_ema_rate).format('0.0000'), ' ')[color])

      if (s.options.trade_pct < (s.period.ema_diff * -1)) {
        color = 'green'
      } else if (s.options.trade_pct < (s.period.ema_diff * 1)) {
        color = 'red'
      }
//        cols.push(z(8, n(s.period.ema_avg).format('0.0000'), ' ')[color])
        cols.push(z(8, n(s.period.ema_diff).format('0.0000'), ' ')[color])
    } else {
      if (s.period.trend_ema_stddev) {
        cols.push('                  ')
      } else {
        cols.push('         ')
      }
    }
    return cols
  },

  phenotypes: {
    // -- common
    period_length: Phenotypes.RangePeriod(1, 120, 'm'),
    min_periods: Phenotypes.Range(1, 100),
    markdown_buy_pct: Phenotypes.RangeFloat(-1, 5),
    markup_sell_pct: Phenotypes.RangeFloat(-1, 5),
    order_type: Phenotypes.ListOption(['maker', 'taker']),
    sell_stop_pct: Phenotypes.Range0(1, 50),
    buy_stop_pct: Phenotypes.Range0(1, 50),
    profit_stop_enable_pct: Phenotypes.Range0(1, 20),
    profit_stop_pct: Phenotypes.Range(1,20),

    // -- strategy
    trend_ema: Phenotypes.Range(1, 40),
    oversold_rsi_periods: Phenotypes.Range(5, 50),
    oversold_rsi: Phenotypes.Range(20, 100)
  },
}

