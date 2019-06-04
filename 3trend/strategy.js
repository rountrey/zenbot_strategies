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

var z = require('zero-fill')
  , n = require('numbro')
  , ema = require('../../../lib/ema')
  , rsi = require('../../../lib/rsi')
  , stddev = require('../../../lib/stddev')
  , ta_trix = require('../../../lib/ta_trix')
  , Phenotypes = require('../../../lib/phenotype')

module.exports = {
  name: '3trend',
  description:
    'Sets trend EMA, TRIX averages, and MACD histogram. Buy if min price in falling trend rises, sell if max price in rising trend lowers. Optional RSI.',

  getOptions: function () {
// common
    this.option('period', 'period length, same as --period_length', String, '15m')
    this.option('period_length', 'period length, same as --period', String, '15m')
    this.option('min_periods', 'min. number of history periods', Number, 128)
    this.option('multi_trade', 'if off, then buy/sell signals only happen after crossing 0', String, 'off')
    this.option('pct_change', 'do not trade if last trade is below this, neg. numbers OK', Number, '-10')
// ema options
    this.option('trend_ema', 'number of periods for trend EMA', Number, 6)
// macd options
    this.option('ema_short_period', 'number of periods for the shorter EMA', Number, 12)
    this.option('ema_long_period', 'number of periods for the longer EMA', Number, 18)
    this.option('signal_period', 'number of periods for the signal EMA', Number, 6)
// trix options
    this.option('timeperiod', 'timeperiod for TRIX', Number, 6)
// rsi options
    this.option('rsi_safety', 'will not sell if rsi is above/below 50 +/- this number, set to -49 to cancel', Number, 3)
    this.option('rsi_periods', 'number of RSI periods', 14)
    this.option('oversold_rsi', 'buy when RSI reaches or drops below this value', Number, 9)
    this.option('overbought_rsi', 'sell when RSI reaches or goes above this value', Number, 99)
  },

  calculate: function(s) {
// calculate RSI
    rsi(s, 'rsi', s.options.rsi_periods)
// calculate EMA
    ema(s, 'trend_ema', s.options.trend_ema)
    if (s.period.trend_ema && s.lookback[0] && s.lookback[0].trend_ema) {
      s.period.trend_ema_rate = s.period.trend_ema
    }
// calculate MACD
    ema(s, 'ema_short', s.options.ema_short_period)
    ema(s, 'ema_long', s.options.ema_long_period)
    if (s.period.ema_short && s.period.ema_long) {
      s.period.macd = (s.period.ema_short - s.period.ema_long)
      ema(s, 'signal', s.options.signal_period, 'macd')
      if (s.period.signal) {
        s.period.macd_histogram = s.period.macd - s.period.signal
      }
    }
  },


  onPeriod: function (s, cb) {

    if (typeof s.last_trade_worth !== 'number') {
      last_trade_pct = 0
    } else {
      last_trade_pct = (s.last_trade_worth * 100)
    }

    if (s.prev_action !== 'bought' && s.prev_action !== 'sold') {
      s.pct_change = 0
    } else {
      s.pct_change = s.options.pct_change
    }

//rsi trades
    if (typeof s.period.rsi === 'number') {
      s.rsi_avg = ((s.lookback[0].rsi + s.lookback[1].rsi + s.lookback[2].rsi) / 3)  
      if (s.period.rsi <= s.options.oversold_rsi) {
        s.signal = 'buy'
      }
      if (s.period.rsi >= s.options.overbought_rsi) {
        s.signal = 'sell'
      }
    }

//trix
    ta_trix(s, s.options.timeperiod).then(function(signal) {
      s.period['trix'] = signal
      if (s.period.trix && s.lookback[0] && s.lookback[0].trix) {
        s.trix_avg = ((s.lookback[0].trix + s.lookback[1].trix + s.lookback[2].trix) / 3)  
      }

//ema
    if (typeof s.period.trend_ema === 'number') {
      s.ema_avg = ((s.lookback[0].trend_ema + s.lookback[1].trend_ema + s.lookback[2].trend_ema) / 3)
      s.period.close_avg = ((s.lookback[0].close + s.lookback[1].close + s.lookback[2].close) / 3)
      s.period.open_avg = ((s.lookback[0].open + s.lookback[1].open + s.lookback[2].open) / 3)
      s.period.avg_diff = ((s.period.close_avg - s.period.open_avg) / s.period.close_avg * 100)
      s.period.diff_avg = ((s.lookback[0].avg_diff + s.lookback[1].avg_diff + s.lookback[2].avg_diff) / 3)
    }

//macd
    if (typeof s.period.macd_histogram === 'number') {
      s.macd_avg = ((s.lookback[0].macd_histogram + s.lookback[1].macd_histogram + s.lookback[2].macd_histogram) / 3)
    }

//buying
    if (typeof s.period.trend_ema === 'number') {
      if (s.trend !== 'falling' || s.trend !== 'bought') {
        if (s.period.trix < s.trix_avg && s.period.trend_ema < s.ema_avg && s.period.macd_histogram < 0) { // && last_trade_pct >= 0) {
          s.trend = 'falling'
          s.acted_on_trend = false
          s.price_min = Math.min(s.lookback[0].close, s.lookback[1].close, s.lookback[2].close)
        }
      }
      if (s.trend === 'falling') {
        if (s.period.close >= s.price_min && s.period.rsi < (50 - s.options.rsi_safety) && last_trade_pct >= s.pct_change) {
          if (s.prev_action !== 'bought' && s.options.multi_trade === 'off') {
            s.signal = 'buy'
          } else if (s.options.multi_trade !== 'off') {
            s.signal = 'buy'
          }
            if (s.action == 'bought') {
              s.acted_on_trend = true
              s.prev_action = 'bought'
            }
            if (s.prev_action == 'bought' && s.trend == 'falling') {
              s.trend = 'bought'
            }
        }
      }
// selling
      if (s.trend !== 'rising' || s.trend !== 'sold') {
        if (s.period.trix > s.trix_avg && s.period.trend_ema > s.ema_avg && s.period.macd_histogram > 0) { // && last_trade_pct >= 0) {
          s.trend = 'rising'
          s.acted_on_trend = false
          s.price_max = Math.max(s.lookback[0].close, s.lookback[1].close, s.lookback[2].close)
        }
      }
      if (s.trend === 'rising') {
        if (s.period.close <= s.price_max && s.period.rsi > (50 + s.options.rsi_safety) && last_trade_pct >= s.pct_change) { 
          if (s.prev_action !== 'sold' && s.options.multi_trade === 'off') {
            s.signal = 'sell'
          } else if (s.options.multi_trade !== 'off') {
            s.signal = 'sell'
          }
            if (s.action == 'sold') {
              s.acted_on_trend = true
              s.prev_action = 'sold'
            }
            if (s.prev_action == 'sold' && s.trend == 'rising') {
              s.trend = 'sold'
            }
        } 
      }
    }
    cb()
  }).catch(function(error) {
      console.log(error)
      cb()
    })
  },

  onReport: function(s) {
    var cols = []

    if (typeof s.period.trend_ema === 'number') {
      var color = 'grey'
      if (s.period.trend_ema > s.ema_avg) {
        color = 'green'
      } else if (s.period.trend_ema < s.ema_avg) {
        color = 'red'
      } 
        cols.push(z(8, n(s.ema_avg).format('0.0000'), ' ')[color])
     }

    if (typeof s.period.macd_histogram === 'number') {
      var color = 'grey'
      if (s.period.macd_histogram > 0) {
        color = 'green'
      } else if (s.period.macd_histogram < 0) {
        color = 'red'
      } 
        cols.push(z(8, n(s.period.macd_histogram).format('0.0000'), ' ')[color])
     }

    if (typeof s.period.trix === 'number') {
      var color = 'grey'
      if (s.period.trix > s.trix_avg) {
        color = 'green'
      } else if (s.period.trix < s.trix_avg) {
        color = 'red'
      } 
        cols.push(z(8, n(s.trix_avg).format('0.0000'), ' ')[color])
     }

    if (typeof s.period.rsi === 'number') {
      var color = 'grey'
      if (s.period.rsi > (50 + s.options.rsi_safety) && s.trend === 'rising') {
        color = 'green'
      } else if (s.period.rsi < (50 + s.options.rsi_safety) && s.trend === 'falling') {
        color = 'red'
      } 
        cols.push(z(8, n(s.period.rsi).format('0.0'), ' ')[color])
     }

//    if (typeof s.period.trend_ema === 'number') {
//      var color = 'grey'
//      if (s.trend === 'falling') {
//        cols.push((' falling').blue)
//      }
//      else if (s.trend === 'bought') {
//        cols.push((' bought ').green)
//      }
//      else if (s.trend === 'rising') {
//        cols.push((' rising ').yellow)
//      }
//      else if (s.trend === 'sold') {
//        cols.push((' sold   ').red)
//      }
//      else {
//        cols.push(('        ').black)
//      }
//     }

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
    oversold_rsi: Phenotypes.Range(20, 100),
    timeperiod: Phenotypes.Range(1, 60),
    up_trend_threshold: Phenotypes.Range(0, 60),
    down_trend_threshold: Phenotypes.Range(0, 60),
    trix_drop: Phenotypes.Range(0, 60),
    trix_recover: Phenotypes.Range(0, 60),
    overbought_rsi_periods: Phenotypes.Range(1, 50),
    overbought_rsi: Phenotypes.Range(20, 100)
  },
}

