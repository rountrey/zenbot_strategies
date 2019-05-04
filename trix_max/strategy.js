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
  , ta_trix = require('../../../lib/ta_trix')
  , Phenotypes = require('../../../lib/phenotype')

module.exports = {
  name: 'trix_max',
  description: 'TRIX but trades are done at the peaks and valleys, not when it crosses the 0 line.',

  getOptions: function () {
//common
    this.option('period', 'period length eg 10m', String, '15m')
    this.option('period_length', 'period length eg 10m', String, '15m')
    this.option('min_periods', 'min. number of history periods', Number, 128)
//trix
    this.option('timeperiod', 'timeperiod for TRIX', Number, 9)
    this.option('trix_drop', 'will sell when trix number drops this amount', Number, 0.0001)        //suggest leaving this as is
    this.option('trix_recover', 'will buy when trix number raises this amount', Number, 0.0001)     //suggest leaving this as is
    this.option('noise_level_pct', 'do not trade when trix is this % of last trix', Number, 0)      //original plan to prevent trades on minor fluctuations across 0
//rsi
    this.option('rsi_periods', 'number of periods for overbought RSI', Number, 14)
    this.option('oversold_rsi', 'buy when RSI reaches or drops below this value', Number, 9)
    this.option('overbought_rsi', 'sell when RSI reaches or goes above this value', Number, 99)
//trade options
    this.option('continue_buying', 'keep buying till empty', String, null)
    this.option('continue_selling', 'keep selling till empty', String, null)
    this.option('rsi_buy_safety', 'do not buy when rsi is higher than this', Number, 48)
    this.option('rsi_sell_safety', 'do not sell when rsi is lower than this', Number, 51)
    this.option('multi_trade', 'if off, then buy/sell signals only happen after crossing 0', String, 'off')
  },

  calculate: function (s) {
    rsi(s, 'rsi', s.options.rsi_periods)
  },

  onPeriod: function (s, cb) {
//    if (s.in_preroll) return cb()
//rsi
    if (typeof s.period.rsi === 'number') {
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
        s.period.trend_trix = s.period.trix >= 0 ? 'up' : 'down'
      }

      if (s.period.trix >= 0) {
        if (s.trend !== 'up') {
          s.acted_on_trend = false
        }
          s.trend = 'up'
          s.trix_high = Math.max(s.period.trix, s.lookback[0].trix, s.lookback[1].trix)
            if (s.options.noise_level_pct != 0 && (((s.period.trix / s.lookback[0].trix) * 100) > s.options.noise_level_pct)) {
              s.signal = null
            } else if (s.trend === 'up' && s.period.trix <= s.trix_high - s.options.trix_drop && s.period.rsi > s.options.rsi_sell_safety) {
                if (s.options.multi_trade === 'off') {
                  s.signal = !s.acted_on_trend ? 'sell' : s.options.continue_selling
                } else if (s.options.multi_trade !== 'off') {
                    s.signal = 'sell'
                }  
            } 
      }

      if (s.period.trix <= 0) {
        if (s.trend !== 'down') {
          s.acted_on_trend = false
        }
        s.trend = 'down'
        s.trix_low = Math.min(s.period.trix, s.lookback[0].trix, s.lookback[1].trix)
            if (s.options.noise_level_pct != 0 && (((s.period.trix / s.lookback[0].trix) * 100) < s.options.noise_level_pct)) {
              s.signal = null
            } else if (s.trend === 'down' && s.period.trix >= s.trix_low + s.options.trix_recover && s.period.rsi < s.options.rsi_buy_safety) {
                if (s.options.multi_trade === 'off') {
                  s.signal = !s.acted_on_trend ? 'buy' : s.options.continue_selling
                } else if (s.options.multi_trade !== 'off') {
                    s.signal = 'buy'
                }  
          } 
      }

      cb()
    }).catch(function(error) {
      console.log(error)
      cb()
    })
  },

  onReport: function (s) {
    let cols = []
//rsi
    if (typeof s.period.rsi === 'number') {
//default
      var color = 'grey'
//will not trade
      if (s.period.rsi >= s.options.rsi_buy_safety && s.period.trix <= 0 || s.period.rsi <= s.options.rsi_sell_safety && s.period.trix >= 0) {
        color = 'yellow'
      } 
//prepping to buy (if rsi doesn't rise)
      if (s.period.rsi > s.options.oversold_rsi && s.period.rsi < (s.options.oversold_rsi + 5)) {
        color = 'cyan'
      } 
//buying
      if (s.period.rsi <= s.options.oversold_rsi && s.signal === 'buy') {
        color = 'green'
      } 
//prepping to sell (if rsi doesn't lower)
      if (s.period.rsi < s.options.overbought_rsi && s.period.rsi > (s.options.overbought_rsi - 5)) {
        color = 'magenta'
      } 
//selling
      if (s.period.rsi >= s.options.overbought_rsi && s.signal === 'sell') {
        color = 'red'
      }
      cols.push(z(4, n(s.period.rsi).format('0'), ' ')[color])
    }

//trix
    if (typeof s.period.trix === 'number') {
//default
      var color = 'grey'
//will not trade
      if (s.period.trix <= 0 && s.period.rsi >= s.options.rsi_buy_safety && s.period.rsi <= s.options.rsi_sell_safety || s.signal === 'null') {
        color = 'yellow'
      } 
//prepping to buy (if rsi doesn't rise)
      else if (s.period.trix <= 0) {
        color = 'cyan'
      } 
//buying
      if (s.period.trix >= s.lookback[0].trix && s.signal === 'buy') {
        color = 'green'
      }
//will not trade
      if (s.period.trix >= 0 && s.period.rsi >= s.options.rsi_buy_safety && s.period.rsi <= s.options.rsi_sell_safety || s.signal === 'null') {
        color = 'yellow'
      } 
//prepping to sell
      else if (s.period.trix >= 0) {
        color = 'magenta'
      } 
//selling
      if (s.period.trix <= s.lookback[0].trix && s.signal === 'sell') {
        color = 'red'
      }
      cols.push(z(8, n((s.period.trix * 100)).format('+0.0000'), ' ')[color])
    }

    return cols
  },

  phenotypes: {
    period_length: Phenotypes.RangePeriod(1, 120, 'm'),
    min_periods: Phenotypes.Range(1, 104),
    markdown_buy_pct: Phenotypes.RangeFloat(-1, 5),
    markup_sell_pct: Phenotypes.RangeFloat(-1, 5),
    order_type: Phenotypes.ListOption(['maker', 'taker']),
    sell_stop_pct: Phenotypes.Range0(1, 50),
    buy_stop_pct: Phenotypes.Range0(1, 50),
    profit_stop_enable_pct: Phenotypes.Range0(1, 20),
    profit_stop_pct: Phenotypes.Range(1, 20),

    timeperiod: Phenotypes.Range(1, 60),
    up_trend_threshold: Phenotypes.Range(0, 60),
    down_trend_threshold: Phenotypes.Range(0, 60),
    trix_drop: Phenotypes.Range(0, 60),
    trix_recover: Phenotypes.Range(0, 60),
    overbought_rsi_periods: Phenotypes.Range(1, 50),
    overbought_rsi: Phenotypes.Range(20, 100)
  }
}
