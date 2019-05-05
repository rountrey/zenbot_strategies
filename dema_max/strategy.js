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
  , rsi = require('../../../lib/rsi')
  , ema = require('../../../lib/ema')
  , Phenotypes = require('../../../lib/phenotype')

module.exports = {
  name: 'dema_max',
  description: 'Buy when difference between short ema and long ema moves away from minimum and maximum. With rsi safety, overbought, oversold',

  getOptions: function () {
//common
    this.option('period', 'period length eg 10m', String, '5m')
    this.option('period_length', 'period length eg 10m', String, '5m')
    this.option('min_periods', 'min. number of history periods', Number, 128)
//dema
    this.option('ema_short_period', 'number of periods for the shorter EMA', Number, 10)
    this.option('ema_long_period', 'number of periods for the longer EMA', Number, 15)
    this.option('dema_drop', 'will sell when dema_high drops this amount', Number, 0)        //suggest leaving this as is
    this.option('dema_recover', 'will buy when dema_low number raises this amount', Number, 0)     //suggest leaving this as is
    this.option('noise_level_pct', 'do not trade min/max ema is below this % of max/min', Number, 0)    
//rsi
    this.option('rsi_periods', 'number of periods for overbought RSI', Number, 14)
    this.option('oversold_rsi', 'buy when RSI reaches or drops below this value', Number, 9) //36
    this.option('overbought_rsi', 'sell when RSI reaches or goes above this value', Number, 99) //72
//trade options
    this.option('rsi_buy_safety', 'do not buy when rsi is higher than this', Number, 46)
    this.option('rsi_sell_safety', 'do not sell when rsi is lower than this', Number, 54)
    this.option('multi_trade', 'if off, then buy/sell signals only happen after crossing 0', String, 'off')
  },

  calculate: function (s) {
//rsi
    rsi(s, 'rsi', s.options.rsi_periods)
//dema
    ema(s, 'ema_short', s.options.ema_short_period)
    ema(s, 'ema_long', s.options.ema_long_period)
    if (s.period.ema_short && s.period.ema_long) {
      s.period.dema_histogram = ((s.period.ema_short - s.period.ema_long) / s.period.ema_short * 100) 
    }
  },

  onPeriod: function (s, cb) {
//rsi
    if (typeof s.period.rsi === 'number') {
      if (s.period.rsi <= s.options.oversold_rsi) {
        s.signal = 'buy'
      }

      if (s.period.rsi >= s.options.overbought_rsi) {
        s.signal = 'sell'
      }
    }

//dema
    if (typeof s.period.dema_histogram === 'number' && typeof s.lookback[0].dema_histogram === 'number') {
      s.period.trend_dema = s.period.dema_histogram >= 0 ? 'up' : 'down'
//buy
      if (s.period.dema_histogram < 0) {
        if (s.trend !== 'down') {
          s.acted_on_trend = false
          s.noise_up = 0
        }
          s.trend = 'down'
          s.dema_low = Math.min(s.period.dema_histogram, s.lookback[0].dema_histogram, s.lookback[1].dema_histogram, s.lookback[2].dema_histogram)
          s.noise_down = ((s.dema_high - s.dema_low) / s.dema_high * 1)
          s.period.noise = ((s.dema_high - s.dema_low) / s.dema_high * -1)
          s.noise_min = Math.min(s.period.noise, s.lookback[0].noise, s.lookback[1].noise)
            if (s.period.rsi > s.options.rsi_buy_safety || s.options.noise_level_pct != 0 && s.noise_down < s.options.noise_level_pct) {
              s.signal = null
            } else if (s.trend === 'down' && s.period.noise >= s.noise_min && s.period.dema_histogram > (s.dema_low + s.options.dema_recover)) {
                if (s.options.multi_trade === 'off') {
                  s.signal = !s.acted_on_trend ? 'buy' : null
                } else if (s.options.multi_trade !== 'off') {
                    s.signal = 'buy'
                }  
            } 
      }
//sell
      if (s.period.dema_histogram > 0) {
        if (s.trend !== 'up') {
          s.acted_on_trend = false
          s.noise_down = 0
        }
          s.trend = 'up'
          s.dema_high = Math.max(s.period.dema_histogram, s.lookback[0].dema_histogram, s.lookback[1].dema_histogram, s.lookback[2].dema_histogram)
          s.noise_up = ((s.dema_low - s.dema_high) / s.dema_low * 1)
          s.period.noise = ((s.dema_high - s.dema_low) / s.dema_low * -1)
          s.noise_max = Math.max(s.period.noise, s.lookback[0].noise, s.lookback[1].noise)
            if (s.period.rsi < s.options.rsi_sell_safety || s.options.noise_level_pct != 0 && s.noise_up < s.options.noise_level_pct) {
              s.signal = null
            } else if (s.trend === 'up' && s.period.noise <= s.noise_max && s.period.dema_histogram < (s.dema_high - s.options.dema_drop)) {//
                if (s.options.multi_trade === 'off') {
                  s.signal = !s.acted_on_trend ? 'sell' : null
                } else if (s.options.multi_trade !== 'off') {
                    s.signal = 'sell'
                }  
            } 
      }

    }
    cb()
  },

  onReport: function (s) {
    var cols = []


    if (typeof s.period.dema_histogram === 'number') {
      var color = 'grey'
      if (s.period.rsi > s.options.rsi_buy_safety && s.period.rsi < s.options.rsi_sell_safety) {
        color = 'grey'
      }
      else if (s.period.dema_histogram > (s.dema_low + s.options.dema_recover) && s.trend == 'down') {
        color = 'yellow'
      }
      else if (s.period.dema_histogram < 0 && s.trend == 'down') {
        color = 'red'
      }
      if (s.period.rsi > s.options.rsi_buy_safety && s.period.rsi < s.options.rsi_sell_safety) {
        color = 'grey'
      }
      else if (s.period.dema_histogram < (s.dema_high - s.options.dema_drop) && s.trend == 'up') {
        color = 'blue'
      }
      else if (s.period.dema_histogram > 0 && s.trend == 'up') {
        color = 'green'
      }
      cols.push(z(8, n(s.period.dema_histogram).format('+00.0000'), '   ')[color])
    }

    if (typeof s.period.noise === 'number') {
      var color = 'grey'
      if (s.noise_down < s.options.noise_level_pct && s.noise_up < s.options.noise_level_pct) {
        color = 'grey'
      }
      else if (s.period.noise < 0 && s.period.noise > s.noise_min && s.trend == 'down') {
        color = 'yellow'
      }
      else if (s.period.noise < 0 && s.trend == 'down') {
        color = 'red'
      }
      if (s.noise_down < s.options.noise_level_pct && s.noise_up < s.options.noise_level_pct) {
        color = 'grey'
      }
      else if (s.period.noise > 0 && s.period.noise < s.noise_max && s.trend == 'up') {
        color = 'blue'
      }
      else if (s.period.noise > 0 && s.trend == 'up') {
        color = 'green'
      }
      cols.push(z(8, n(s.period.noise).format('+00.00'), ' ')[color])
    }

    if (typeof s.period.rsi === 'number') {
      var color = 'grey'
      if (s.period.rsi > s.options.rsi_buy_safety && s.period.rsi < s.options.rsi_sell_safety) {
        color = 'grey'
      }
      else if (s.period.rsi <= s.options.oversold_rsi) {
        color = 'yellow'
      }
      else if (s.period.rsi < 50) {
        color = 'red'
      }
      if (s.period.rsi > s.options.rsi_buy_safety && s.period.rsi < s.options.rsi_sell_safety) {
        color = 'grey'
      }
      else if (s.period.rsi >= s.options.overbought_rsi) {
        color = 'blue'
      }
      else if (s.period.rsi > 50) {
        color = 'green'
      }
      cols.push(z(8, n(s.period.rsi).format('00.00'), ' ')[color])
    }


//buy (green)
//    if (typeof s.noise_down === 'number') {
//      var color = 'grey'
//      if (s.noise_down < s.options.noise_level_pct && s.noise_down != 0) {
//        color = 'yellow'
//      }
//      if (s.noise_down >= s.options.noise_level_pct && s.signal === 'buy') {//
//        color = 'cyan'
//      }
//      else if (s.noise_down > s.options.noise_level_pct && s.signal === null) {
//        color = 'green'
//      }
//      cols.push(z(8, n(s.noise_down).format('+00.00'), ' ')[color])
//    }

//sell (red)
//    if (typeof s.noise_up === 'number') {
//      var color = 'grey'
//      if (s.noise_up < s.options.noise_level_pct && s.noise_up != 0) {
//        color = 'yellow'
//      }
//      if (s.noise_up >= s.options.noise_level_pct && s.signal === 'sell') {//
//        color = 'magenta'
//      }
//      else if (s.noise_up > s.options.noise_level_pct && s.signal === null) {
//        color = 'green'
//      }
//      cols.push(z(8, n(s.noise_up).format('+00.00'), ' ')[color])
//    }

    else {
      cols.push('   ')
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
    ema_short_period: Phenotypes.Range(1, 20),
    ema_long_period: Phenotypes.Range(20, 100),
    up_trend_threshold: Phenotypes.Range(0, 50),
    down_trend_threshold: Phenotypes.Range(0, 50),
    overbought_rsi_periods: Phenotypes.Range(1, 50),
    overbought_rsi: Phenotypes.Range(20, 100)
  }
}
