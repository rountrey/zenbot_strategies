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
  , Phenotypes = require('../../../lib/phenotype')

module.exports = {
  name: 'retrend_price',
  description:
    'Sets trend based on RSI and EMA averages. Buy on min price in falling trend, sell on max price in rising trend. Optional buy on low RSI.',

  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '15m')
    this.option('period_length', 'period length, same as --period', String, '15m')
    this.option('min_periods', 'min. number of history periods', Number, 52)
    this.option('trend_ema', 'number of periods for trend EMA', Number, 3)
    this.option('trade_pct', 'raise trade threshold, lower with negative', Number, 0)
    this.option('rsi_safety', 'at what point to trade', Number, 0) //set to -49 to remove this check
    this.option('rsi_periods', 'number of RSI periods', 14)
    this.option('oversold_rsi', 'buy when RSI reaches or drops below this value', Number, 9)
    this.option('overbought_rsi', 'sell when RSI reaches or goes above this value', Number, 99)
    this.option('multi_trade', 'if off, then buy/sell signals only happen after crossing 0', String, 'off')
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
// get rsi avg
      s.rsi_avg = ((s.lookback[0].rsi + s.lookback[1].rsi + s.lookback[2].rsi) / 3)  
// buy on rsi oversold
      if (s.period.rsi <= s.options.oversold_rsi) {
        s.signal = 'buy'
      }
// sell on rsi overbought
      if (s.period.rsi >= s.options.overbought_rsi) {
        s.signal = 'sell'
      }
    }

//ema
    if (typeof s.period.trend_ema === 'number') {
      s.period.ema_avg = ((s.lookback[0].trend_ema + s.lookback[1].trend_ema + s.lookback[2].trend_ema) / 3)
// set trend for buys
      if (s.trend !== 'falling' || s.trend !== 'bottom') {
        if (s.period.trend_ema < s.period.ema_avg && s.period.rsi < s.rsi_avg) {
          s.trend = 'falling'
          s.acted_on_trend = false
          s.price_min = Math.min(s.period.close, s.lookback[0].close, s.lookback[1].close, s.lookback[2].close)
        }
      }
// action for buys
      if (s.trend === 'falling') {
        if (s.period.close >= (s.price_min + (s.options.trade_pct / 100 * s.price_min)) && s.period.rsi < (50 - s.options.rsi_safety)) {
            s.signal = !s.acted_on_trend ? 'buy' : null
            if (s.action == 'bought') {
              s.acted_on_trend = true
              s.trend = 'bottom'
            }
        }
      }
// set trend for sells
      if (s.trend !== 'rising' || s.trend !== 'top') {
        if (s.period.trend_ema > s.period.ema_avg && s.period.rsi > s.rsi_avg) {
          s.trend = 'rising'
          s.acted_on_trend = false
          s.price_max = Math.max(s.period.close, s.lookback[0].close, s.lookback[1].close, s.lookback[2].close)
        }
      }
// action for sells
      if (s.trend === 'rising') {
        if (s.period.close <= (s.price_max - (s.options.trade_pct / 100 * s.price_max)) && s.period.rsi > (50 + s.options.rsi_safety)) {
            s.signal = !s.acted_on_trend ? 'sell' : null
            if (s.action == 'sold') {
              s.acted_on_trend = true
              s.trend = 'top'
              s.last_sell_price = s.period.close
            }
        } 
      }
    }
    cb()
  },


  onReport: function(s) {
    var cols = []
//    if (typeof s.period.trend_ema === 'number') {
//      var color = 'grey'
//      if (s.trend === 'falling') {
//        cols.push(('falling').blue)
//      }
//      else if (s.trend === 'bottom') {
//        cols.push(('bottom ').green)
//      }
//      else if (s.trend === 'rising') {
//        cols.push(('rising ').yellow)
//      }
//      else if (s.trend === 'top') {
//        cols.push(('top    ').red)
//      }
//      else {
//        cols.push(('       ').black)
//      }
//    }

    if (typeof s.period.trend_ema === 'number') {
      var color = 'grey'
      if (s.period.trend_ema > s.period.ema_avg && s.period.rsi > s.rsi_avg) {
        color = 'green'
      } else if (s.period.trend_ema < s.period.ema_avg && s.period.rsi < s.rsi_avg) {
        color = 'red'
      } 
        cols.push(z(8, n(s.rsi_avg).format('0.00'), ' ')[color])
        cols.push(z(8, n(s.period.trend_ema).format('0.0000'), ' ')[color])
    } 
    if (typeof s.period.close === 'number') {
      var color = 'grey'
      if (s.trend === 'falling' || s.trend === 'bottom') {
        cols.push(z(8, n(s.price_min).format('0.00000'), '    ').green)
      }
      else if (s.trend === 'rising' || s.trend === 'top') {
        cols.push(z(8, n(s.price_max).format('0.00000'), '    ').red)
      }
    } 

    if (typeof s.period.close === 'number') {
      var color = 'grey'
      if (s.signal === 'buy' || s.action == 'bought') {
        color = 'green'
      }
      else if (s.signal === 'sell' || s.action == 'sold') {
        color = 'red'
      }
        cols.push(z(8, n(s.period.close).format('0.00000'), '    ')[color])
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

