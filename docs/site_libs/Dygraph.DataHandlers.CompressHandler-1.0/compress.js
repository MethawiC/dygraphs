(function() {
  "use strict";

  /**
   * Get week number for date
   */
  var getWeek = function(d) {
    var d = new Date(+d);
    d.setHours(0,0,0);
    d.setDate(d.getDate()+4-(d.getDay()||7));
    return Math.ceil((((d-new Date(d.getFullYear(),0,1))/8.64e7)+1)/7);
  };
  /**
   * Get week endpoints (i.e. start of the week and end of the week dates) for date
   */
  var getWeekEndPoints = function(d) {
    var d = new Date(+d);
    var today = new Date(d.setHours(0, 0, 0, 0));
    var day = today.getDay();
    var date = today.getDate() - day;

    var StartDate = new Date(today.setDate(date));
    var EndDate = new Date(today.setDate(date + 7));

    return [StartDate, EndDate];
  };
  /**
   * Get quarter for date
   */
  var getQuarter = function(d) {
    var d = new Date(+d);
    var m = Math.floor(d.getMonth()/3) + 2;
    return m > 4 ? m - 5 : m;
  };
  Dygraph.DataHandlers.CompressHandler = function() {};
  var CompressHandler = Dygraph.DataHandlers.CompressHandler;
  CompressHandler.prototype = new Dygraph.DataHandlers.DefaultHandler();
  CompressHandler.prototype.seriesToPoints = function(series, setName, boundaryIdStart) {
    var compress = {
      titles: [
        "annually",
        "quarterly",
        "monthly",
        "weekly",
        "daily"
      ],
      days: [
        365,
        90,
        30,
        7,
        1
      ],
      bars: [],
      barsRange: [20, 50]
    };
    var firstItem = series[0];
    var lastItem = series[series.length - 1];
    var dateDiff = lastItem[0] - firstItem[0];
    var dayMs = 1000 * 60 * 60 * 24;
    var compressedSeries = [];
    var ratio = 1;
    var points = [];
    var bounds = [];
    var idx;
    var compressTitle;

    for (var i = 0; i < compress.days.length; i++) {
      ratio = compress.days[i] * dayMs;
      var bars = Math.round(dateDiff / ratio);
      compress.bars.push(bars);
    }

    idx = compress.bars.reduce(function(previous, current, index) {
      if (current < compress.barsRange[1]) {
        return index;
      }
      return previous;
    }, 0);
    bounds.push(idx);

    idx = compress.bars.reduceRight(function(previous, current, index) {
      if (current > compress.barsRange[0]) {
        return index;
      }
      return previous;
    }, compress.bars.length - 1);
    bounds.push(idx);

    if (bounds[0] === bounds[1]) {
      compressTitle = compress.titles[bounds[0]];
    } else {
      var lower_idx = bounds[0];
      var lower = Math.abs(compress.bars[idx] - compress.barsRange[0]);
      var higher_idx = bounds[1];
      var higher = Math.abs(compress.bars[idx] - compress.barsRange[1]);
      var min = Math.min(lower, higher);
      idx = (min === lower) ? lower_idx : higher_idx;
      compressTitle = compress.titles[idx];
    }

    var doCompress = function(title) {
      var period;
      var currentPeriod;
      var buffer = [];
      var compressed = [];
      var getPeriodEndPoints = function(period, date) {
        var endpoints = [];
        var currentYear = new Date(date).getFullYear();
        var currentPeriod;
        switch (period) {
          case "annually":
            endpoints.push(new Date(currentYear, 0, 1));
          endpoints.push(new Date(currentYear, 11, 31));
          break;
          case "quarterly":
            currentPeriod = getQuarter(new Date(item[0]));
          if (currentPeriod === 0) {
            endpoints.push(new Date(currentYear, 0, 1));
            endpoints.push(new Date(currentYear, 2, 31));
          } else if (currentPeriod === 1) {
            endpoints.push(new Date(currentYear, 3, 1));
            endpoints.push(new Date(currentYear, 5, 30));
          } else if (currentPeriod === 2) {
            endpoints.push(new Date(currentYear, 6, 1));
            endpoints.push(new Date(currentYear, 8, 30));
          } else {
            endpoints.push(new Date(currentYear, 9, 1));
            endpoints.push(new Date(currentYear, 11, 31));
          }
          break;
          case "monthly":
            currentPeriod = new Date(item[0]).getMonth();
          endpoints.push(new Date(currentYear, currentPeriod, 1));
          endpoints.push(new Date(currentYear, currentPeriod + 1, 0));
          break;
          case "weekly":
            endpoints = getWeekEndPoints(new Date(item[0]));
          break;
          case "daily":
            endpoints = [new Date(item[0]), new Date(item[0])];
          break;
        }
        return endpoints;
      };
      for (var i = 0; i < series.length; i++) {
        var item = series[i];
        switch (title) {
          case "annually":
            currentPeriod = new Date(item[0]).getFullYear();
          break;
          case "quarterly":
            currentPeriod = getQuarter(new Date(item[0]));
          break;
          case "monthly":
            currentPeriod = new Date(item[0]).getMonth();
          break;
          case "weekly":
            currentPeriod = getWeek(new Date(item[0]));
          break;
          case "daily":
            currentPeriod = new Date(item[0]).getDay();
          break;
        }
        if (period === undefined) {
          period = currentPeriod;
        }
        if (period === currentPeriod) {
          buffer.push(item);
        } else {
          compressed.push(buffer);
          buffer = [];
          buffer.push(item);
          period = currentPeriod;
        }
      }
      return compressed.reduce(function(prev, curr, index) {
        var date = curr[curr.length - 1][0];
        var value;

        // Check if we have more or less full period for the first bar
        if (index === 0) {
          var endpoints = getPeriodEndPoints(title, curr[0][0]);
          var range = [];
          range.push(curr[0][0]); // first date
          range.push(date); // last date

          if (endpoints[0] !== range[0] || endpoints[1] !== range[1]) {
            return prev;
          }
        }

        switch (setName.toLowerCase()) {
          case "open":
            value = curr[0][1]; // Open of the first day
          break;
          case "high":
            // Highest High of all the daily Highs
            value = Math.max.apply(null, curr.reduce(function(p, c) {
            p.push(c[1]);
            return p;
          }, []));
          break;
          case "low":
            // Lowest Low of all the daily Lows
            value = Math.min.apply(null, curr.reduce(function(p, c) {
            p.push(c[1]);
            return p;
          }, []));
          break;
          case "close":
            value = curr[curr.length - 1][1]; // Close of the last day
          break;
        }
        prev.push([date, value]);

        return prev;
      }, []);
    };

    compressedSeries = doCompress(compressTitle);

    this.compressTitle = compressTitle;

    for (i = 0; i < compressedSeries.length; ++i) {
      var item = compressedSeries[i];
      var point = {
        x : NaN,
        y : NaN,
        xval : item[0],
        yval : item[1],
        name : setName,
        idx : i + boundaryIdStart
      };
      points.push(point);
    }
    this.onPointsCreated_(compressedSeries, points);
    return points;
  };

})();
