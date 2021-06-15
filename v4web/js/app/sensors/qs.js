/**
 * Quality scores.
 * Usage:
 *        var reversalIndexes = qs.calculateReversalIndexes(measurements);
 *        var tempoScore = Math.round(qs.calculateTempoScore(3001, measurements, reversalIndexes));
 *        var rangeScore = Math.round(qs.calculateRangeScore(3001, measurements, reversalIndexes));
 *        var rhythmScore = Math.round(qs.calculateRhythmScore(3001, measurements, reversalIndexes));
 *        var totalQualityScore = Math.round(qs.calculateTotalQualityScore({tempo:tempoScore, range: rangeScore, rhythm: rhythmScore}));
 * I tried to move to more modern javascript (let instead of var), but iOS 10 gets it wrong after js-minification
 */

const qs = {
    /**
     * Tolerance of reference position reversal w.r.t. the actual reversal.
     * A tolerance of 0.0 means that the actual reversal has to occur exactly at the point of the reference reversal.
     * A tolerance of 0.5 means that the ranges in which actual reversals should occur are half the interval between
     * reference reversals; the ranges for actual reversals are consecutive.
     */
    reversalTolerance: 0.4,
    /**
     * Find the reversal points in the actual positions.
     * At these points, the trend of the actual position changes from increasing to decreasing (maximum)
     * or decreasing to increasing (minimum). The trend ignores noise and trembling.
     * Parameters:
     * `measurements`: array of {time: Number(seconds), hr: {undefined, 0, 1, 2}, ref: Number(0.0 .. 1.0), act: Number(0.0 .. 1.0)}
     *   `ref` and `act` are the reference and actual position, where 0.0 ~ min.calibration and 1.0 ~ max.calibration.
     * Returns: indexes of the reversal points in `measurements`
     * We assume that `measurements` starts when time = 0 (beginning of first half-rep);
     * a maximum reversal takes place around 10, 30, 50, ... seconds, when `ref > 0.50`;
     * and a minimum reversal takes place around 20, 40, 60, ... seconds, when `ref < 0.50`.
     * All reversals (every ~ 10 sec.) must be present in the result.
     */
    calculateReversalIndexes : function(measurements) {
      const reversalTolerance = qs.reversalTolerance;
      const reversalTolerance1 = 1 - reversalTolerance;
      var reversalIndexes = [];
      // The start-index of the range of the next reversal.
      var hrStart = 0;
      // Start looping at i = 1, so there is a measurement at i-1.
      for (var i = 1; i < measurements.length; ++i) {
        var p = measurements[i-1]; // previous
        var m = measurements[i]; // current measurement
        // Use atEnd to find the last reversal, before an unfinished half-repetition.
        var atEnd = i == measurements.length-1;
        // Find the boundaries for ranges that contain a reversal, using the tolerance, stopping at the last measurement.
        if (p.ref <= reversalTolerance && (m.ref > reversalTolerance || atEnd && qs.trendAtEnd(measurements) == 1)) {
          // Lower end of upward slope of reference position.
          // Look for a minimum reversal in the previous range, unless this is the first range.
          if (hrStart > 0) {
            var revIndex = qs.findReversal(-1, measurements.map(m => m.act), hrStart, i)
            reversalIndexes.push(revIndex);
          }
        } else if (p.ref <= reversalTolerance1 && (m.ref > reversalTolerance1 || atEnd && qs.trendAtEnd(measurements) == 1)) {
          // Higher end of upward slope of reference position.
          // Start looking for the next reversal from here.
          hrStart = i;
        } else if (p.ref >= reversalTolerance1 && (m.ref < reversalTolerance1 || atEnd && qs.trendAtEnd(measurements) == -1)) {
          // Higher end of downward slope of reference position.
          // Look for a maximum reversal in the previous range.
          var revIndex = qs.findReversal(1, measurements.map(m => m.act), hrStart, i);
          reversalIndexes.push(revIndex);
        } else if (p.ref >= reversalTolerance && (m.ref < reversalTolerance || atEnd && qs.trendAtEnd(measurements) == -1)) {
          // Lower end of downward slope of reference position.
          // Start looking for the next reversal from here.
          hrStart = i;
        }
      }
      return reversalIndexes;
    },

    /**
     * Determine the trend of the actual at the end of the measurements.
     * `measurements`: array of {time: Number(seconds), hr: {undefined, 0, 1, 2}, ref: Number(0.0 .. 1.0), act: Number(0.0 .. 1.0)}
     *   `ref` and `act` are the reference and actual position, where 0.0 ~ min.calibration and 1.0 ~ max.calibration.
     * Returns: -1 if trend is decreasing, +1 if trend is increasing, 0 if undetermined.
     */
    trendAtEnd : function(measurements) {
      var lastAct = measurements[measurements.length - 1].act;
      for (i = measurements.length - 2; i >= 0; --i) {
        var previousAct = measurements[i].act;
        if (previousAct > lastAct) {
          return -1;
        } else if (previousAct < lastAct) {
          return 1;
        }
      }
      return 0;
    },

    /**
     * Find a local reversal (minimum or maximum) in a range within series of numbers.
     * Parameters:
     * `minMax`: -1 to find a minimum reversal, +1 to find a maximum reversal
     * `series`: array of numbers
     * `iStart`: first index of range to search
     * `iEnd`: last index of range to search
     * Returns an index between `iStart` and `iEnd`
     * This function does a binary search for an averaged minimum or maximum.
     * Thus it should ignore noise and trembling when looking for a reversal, by 'zooming in'.
     */
    findReversal : function(minMax, series, iStart, iEnd) {
      // Zoom in on one point, reached when iStart is equal to iEnd.
      while (iStart < iEnd) {
        var iMid = Math.floor((iStart + iEnd) / 2);
        // Compute the averages of the two halved ranges.
        var average0 = 0;
        var average1 = 0;
        // A loop is not elegant, but more efficient than Array.slice().
        for (var i = iStart; i <= iMid; ++i) {
          average0 += series[i];
        }
        for (var i = iMid+1; i <= iEnd; ++i) {
          average1 += series[i];
        }
        average0 = average0 / (iMid+1 - iStart);
        average1 = average1 / (iEnd - iMid);
        // Compare the averages, and choose the halved range to continue searching.
        if ((minMax > 0) ? (average0 > average1) : (average0 < average1)) {
          // Look for maximum reversal.
          iEnd = iMid;
        } else {
          // Look for minimum reversal.
          iStart = iMid+1;
        }
      }
      return iStart;
    },

    /**
     * Penalty table for tempo,
     * mapping time difference (seconds) between reference reversal and actual reversal to score penalty.
     */
    tempoPenaltyTable : [
      [0.1 , 0],
      [0.2 , 5],
      [0.3 , 10],
      [0.5 , 15],
      [0.7 , 20],
      [1.0 , 30],
      [1.5 , 40],
      [2.0 , 50],
      [2.5 , 60],
      [3.0 , 70],
      [4.0 , 80],
      [5.0 , 90],
      [Number.POSITIVE_INFINITY , 100] // everything over 5.0
    ],

    /**
     * Calculate the tempo score of a whole exercise.
     * Parameters:
     * `machineGroupId`: The id of the machine group used in the exercise
     * `measurements`: array of {time: Number(seconds), hr: {undefined, 0, 1, 2}, ref: Number(0.0 .. 1.0), act: Number(0.0 .. 1.0)}
     *   `ref` and `act` are the reference and actual position, where 0.0 ~ min.calibration and 1.0 ~ max.calibration.
     * `reversalIndexes`: indexes of the reversal points in `measurements`
     * Returns: a score between 0 and 100
     */
    calculateTempoScore : function(machineGroupId, measurements, reversalIndexes) {
      var hrScores = []; // scores for half reps.
      for (var hr = 0; hr < reversalIndexes.length; ++hr) {
        var refReversalTime = (hr + 1) * 10.0; // Reference reverses every 10 seconds.
        var actReversalTime = measurements[reversalIndexes[hr]].time;
        var timeDiff = Math.abs(refReversalTime - actReversalTime); // seconds
        var penalty = qs.tempoPenaltyTable.find(pt => pt[0] >= timeDiff)[1];
        hrScores.push(100 - penalty);
        console.info(`tempo ${hr}: timeDiff=${Math.round(10*timeDiff)/10}sec, penalty=${penalty}`);
      }
      console.info(`tempo HR scores: ${hrScores.join(', ')}`);
      if (hrScores.length == 0) return 0; // no reversals during exercise
      return hrScores.reduce((total, score) => total + score) / hrScores.length; // compute average score
    },

    /**
     * Penalty table for range,
     * mapping machineGroupId to a table
     *   mapping extension difference (as percentage of calibrated range, under-extension < 0, over-extension > 0) to score penalty.
     */
    rangePenaltyTable : {
      mg0: [
        [-30, 100],
        [-25, 90],
        [-22, 80],
        [-19, 70],
        [-16, 60],
        [-13, 50],
        [-10, 40],
        [-07, 30],
        [-03, 15],
        [-02, 10],
        [-01, 5],
        [ 01, 0],
        [ 02, 5],
        [ 03, 10],
        [ 05, 15],
        [ 07, 20],
        [ 10, 30],
        [ 13, 40],
        [ 16, 50],
        [ 19, 60],
        [ 22, 70],
        [ 25, 80],
        [ 30, 90],
        [ Number.POSITIVE_INFINITY, 100] // everything over 30
      ],
      mg1: [
        [-30, 100],
        [-25, 90],
        [-22, 80],
        [-19, 70],
        [-16, 60],
        [-13, 50],
        [-10, 40],
        [-07, 30],
        [-03, 15],
        [-02, 10],
        [-01, 5],
        [ 01, 0],
        [ 02, 5],
        [ 03, 10],
        [ 05, 15],
        [ 07, 20],
        [ 10, 30],
        [ 13, 40],
        [ 16, 50],
        [ 19, 60],
        [ 22, 70],
        [ 25, 80],
        [ 30, 90],
        [ Number.POSITIVE_INFINITY, 100] // everything over 30
      ]
    },

    /**
     * Weight table for half-rep scores for range,
     * mapping machineGroupId to a table
     *   mapping hr-number (starting at 0) to a weight (any number).
     * The absolute values of weights do not matter, only the relative differences used for weighted average.
     * The last value in a hr-to-weight table is used for everything after that.
     */
    rangeHrScoreWeight : {
      mg0: [100],
      mg1: [100, 100, 100, 100, 75, 75, 50, 50, 0]
    },

    /**
     * Calculate the range score of a whole exercise.
     * Parameters:
     * `machineGroupId`: The id of the machine group used in the exercise
     * `measurements`: array of {time: Number(seconds), hr: {undefined, 0, 1, 2}, ref: Number(0.0 .. 1.0), act: Number(0.0 .. 1.0)}
     *   `ref` and `act` are the reference and actual position, where 0.0 ~ min.calibration and 1.0 ~ max.calibration.
     * `reversalIndexes`: indexes of the reversal points in `measurements`
     * Returns: a score between 0 and 100
     */
    calculateRangeScore : function(machineGroupId, measurements, reversalIndexes) {
      var hrScores = []; // scores for half reps.
      for (var hr = 0; hr < reversalIndexes.length; ++hr) {
        var refReversalPosition = (hr + 1) % 2; // 1.0, 0.0, 1.0, 0.0, ....
        var actReversalPosition = measurements[reversalIndexes[hr]].act;
        // The meaning of over- and under-extension switches every HR.
        // Note that positionDiff is a percentage (0..100) of calibrated range.
        var positionDiff = 100 * (hr % 2 ? actReversalPosition - refReversalPosition : refReversalPosition - actReversalPosition);
        var penalty = qs.rangePenaltyTable[machineGroupId].find(pt => pt[0] >= positionDiff)[1];
        hrScores.push(100 - penalty);
        console.info(`range ${hr}: positionDiff=${Math.round(positionDiff*10)/10}%, penalty=${penalty}`);
      }
      console.info(`range HR scores: ${hrScores.join(', ')}`);
      if (hrScores.length == 0) return 0; // panic!
      // Compute the weighted average score.
      var total_weight = hrScores.reduce((t_w, score, hr) => {
          var weightTable = qs.rangeHrScoreWeight[machineGroupId];
          var weight = weightTable[Math.min(hr, weightTable.length-1)];
          return [t_w[0] + score * weight, t_w[1] + weight]
        }, [0, 0]);
      return total_weight[0] / total_weight[1];
    },

    /**
     * Penalty table for rhythm,
     * mapping machineGroupId to a table
     *   mapping position divergence (as percentage of calibrated range) to score penalty.
     */
    rhythmPenaltyTable : {
      mg0: [
        [01, 0],
        [02, 5],
        [03, 10],
        [05, 15],
        [07, 20],
        [10, 30],
        [13, 40],
        [16, 50],
        [19, 60],
        [22, 70],
        [25, 80],
        [30, 90],
        [Number.POSITIVE_INFINITY, 100] // everything above 30
      ],
      mg1: [
        [01, 0],
        [02, 5],
        [03, 10],
        [05, 15],
        [07, 20],
        [10, 30],
        [13, 40],
        [16, 50],
        [19, 60],
        [22, 70],
        [25, 80],
        [30, 90],
        [Number.POSITIVE_INFINITY, 100] // everything above 30
      ]
    },

    /**
     * Weight table for half-rep scores for rhythm,
     * mapping machineGroupId to a table
     *   mapping hr-number (starting at 0) to a weight (any number).
     * The absolute values of weights do not matter, only the relative differences used for weighted average.
     * The last value is used for everything after that.
     */
    rhythmHrScoreWeight : {
      mg0: [100],
      mg1: [100, 100, 100, 100, 75, 75, 50, 50, 0]
    },

    /**
     * Calculate the rhythm score of a whole exercise.
     * Parameters:
     * `machineGroupId`: The id of the machine group used in the exercise
     *   Machine groups at this moment are mg0: Everything except abduction, adduction; mg1: abduction, adduction.
     * `measurements`: array of {time: Number(seconds), hr: {undefined, 0, 1, 2}, ref: Number(0.0 .. 1.0), act: Number(0.0 .. 1.0)}
     *   `ref` and `act` are the reference and actual position, where 0.0 ~ min.calibration and 1.0 ~ max.calibration.
     * `reversalIndexes`: indexes of the reversal points in `measurements`
     * Returns: a score between 0 and 100
     */
    calculateRhythmScore : function(machineGroupId, measurements, reversalIndexes) {
      var maxDivergences = []; // max. divergences for all half reps, 0 .. 100.
      var lastReversalIndex = reversalIndexes[reversalIndexes.length - 1];
      for (var i = 0; i < lastReversalIndex; ++ i) {
        var m = measurements[i];
        var hrTime = m.time % 10; // time within half-rep
        if (hrTime > 2 && hrTime < 8) {
          var hr = Math.floor(m.time / 10); // half rep, starting at 0
          var divergence = 100 * Math.abs(m.ref - m.act); // 0 .. 100
          if (divergence > (maxDivergences[hr] || 0)) {
            maxDivergences[hr] = divergence;
          }
        }
      }
      var hrScores = maxDivergences.map((divergence, hr) => {
        var penalty = qs.rhythmPenaltyTable[machineGroupId].find(pt => pt[0] >= divergence)[1];
        console.info(`rhythm ${hr}: maxDivergence=${Math.round(divergence*10)/10}%, penalty=${penalty}`);
        return 100 - penalty;
      }); // scores for half reps.
      console.info(`rhythm HR scores: ${hrScores.join(', ')}`);
      if (hrScores.length == 0) return 0; // panic!
      // Compute the weighted average score.
      var total_weight = hrScores.reduce((t_w, score, hr) => {
          var weightTable = qs.rhythmHrScoreWeight[machineGroupId];
          var weight = weightTable[Math.min(hr, weightTable.length-1)];
          return [t_w[0] + score * weight, t_w[1] + weight]
        }, [0, 0]);
      return total_weight[0] / total_weight[1];
    },

    /**
     * Compute the total quality score of an exercise.
     * Parameters:
     * `scores`: {tempo: Number(0.0 .. 1.0), range: Number(0.0 .. 1.0), rhythm: Number(0.0 .. 1.0)}
     * Returns one total quality score between 0 and 100
     */
    calculateTotalQualityScore : function(scores) {
      return (30 * scores.tempo + 40 * scores.range + 30 * scores.rhythm) / 100;
    },

    /**
     * Get a subset of the measurements, with a specified interval between selected measurements.
     * Parameters:
     * `measurements`: array of {time: Number(seconds), hr: {undefined, 0, 1, 2}, ref: Number(0.0 .. 1.0), act: Number(0.0 .. 1.0)}
     * `interval`: interval in seconds (usually fractional, like 0.2)
     * Returns: a subset of `measurements`, with elements like [time, actual, reference].
     */
    graphData : function(measurements, interval) {
      var graphData = [];
      // Use the first measurement to set the time.
      if (measurements.length > 0) {
        var nextTime = measurements[0].time;
        for (var i = 0; i < measurements.length; ++i) {
          if (measurements[i].time >= nextTime) {
            graphData.push([measurements[i].time, measurements[i].act, measurements[i].ref]);
            nextTime += interval;
          }
        }
      }
      return graphData;
    },

    /**
     * Get the actual times at which the exercise reverses.
     * Parameters:
     * `measurements`: array of {time: Number(seconds), hr: {undefined, 0, 1, 2}, ref: Number(0.0 .. 1.0), act: Number(0.0 .. 1.0)}
     * `reversalIndexes`: indexes of the reversal points in `measurements`
     * Returns: a list of times in seconds
     */
    reversalTimes : function(measurements, reversalIndexes) {
      return reversalIndexes.map(ridx => measurements[ridx].time);
    }
};
