/**
 * The graph of the sensor-movement.
 */
fit20.components.sensorresults_graph = {
  template: `
    <div class="sensorGraph" :id="graphId">
    </div>
  `,
  // graphData: [[time, actual_position, reference_position], ...]
  props: ['graphData', 'reversalTimes', 'member'],
  computed: {
    graphId : function() {
      // In the trainers-app, two graphs may be displayed for a duo training, so we need different id's.
      return 'sensor-graph-'+(this.member && this.member.id);
    }
  },
  methods: {
    drawChart: function() {
      if (this.graphData.length < 2) return; // Empty graph, quit immediately.
      fit20.log(`* Sensor-results: drawing chart of ${this.graphData.length} points for member ${this.member && this.member.fullName}`);
      // Get the dimensions of the graph canvas.
      var chartBox = d3.select(`#${this.graphId}`).node().getBoundingClientRect();
      var chart = {
        width: chartBox.width,
        height: chartBox.height,
        overextendFactor: 0.2
      };
      chart.overextend = chart.height * chart.overextendFactor;
      var data = this.graphData || [];
      // chart.timeExtent: [min.tine, max.time]
      chart.timeExtent = d3.extent(data.map(function(d){return d[0]}));
      // chart.extent: [[min.actual, max.actual], [min.reference, max.reference]]
      chart.extent = [ d3.extent(data.map(function(d){return d[1]})),
                       d3.extent(data.map(function(d){return d[2]})) ];
      // Create an SVG canvas.
      chart.svg = d3.select(`#${this.graphId}`)
        .append('svg')
        .attr('width', chart.width)
        .attr('height', chart.height);
      chart.container = chart.svg.append('g');
      // The x-scale depends on the extent of the time data.
      chart.xScale = d3.scaleLinear()
        .domain(chart.timeExtent)
        .range([0, chart.width]);
      // The y-scale accommodates the reference plus overextend.
      // To accommodate actual data use: .domain([d3.min([chart.extent[0][0], chart.extent[1][0]]), d3.max([chart.extent[0][1], chart.extent[1][1]])])
      chart.yScale = d3.scaleLinear()
        .domain([chart.extent[1][0], chart.extent[1][1]])
        .range([chart.height - chart.overextend, chart.overextend]);
      // Get the data for the actual graph and the reference graph.
      chart.graphDataActual = d3.range(0, data.length)
        .map(x => [data[x][0], data[x][1]]);
      chart.graphDataReference = d3.range(0, data.length)
        .map(x => [data[x][0], data[x][2]]);
      // Draw scaled lines.
      chart.graphLine = d3.line()
        .x(function(d){return chart.xScale(d[0])})
        .y(function(d){return chart.yScale(d[1])});
      chart.container.append('path')
        .datum(chart.graphDataReference)
        .attr('d', chart.graphLine)
        .attr('stroke', 'lightgrey')
        .attr('stroke-width', 15)
        .attr('fill', 'none');
      chart.container.append('path')
        .datum(chart.graphDataActual)
        .attr('d', chart.graphLine)
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 5)
        .attr('fill', 'none');
      if (this.reversalTimes) {
        [chart.timeExtent[0]].concat(this.reversalTimes).forEach(t => {
          var scaleT = chart.xScale(t);
          var scaleY0 = chart.yScale(chart.extent[1][0]);
          var scaleY1 = chart.yScale(chart.extent[1][1]);
          chart.container.append('path')
            .attr('d', d3.line()([[scaleT, scaleY0], [scaleT, scaleY1]]))
            .attr('stroke', 'steelblue')
            .attr('stroke-dasharray', '1 5')
            .attr('stroke-width', 1)
            .attr('fill', 'none');
        });
      }
    }
  },
  // Use mounted, because a watch on graphData does not work when the component is not shown due to v-if.
  mounted: function() {
    this.$nextTick(function () {
      this.drawChart();
    })
  },
  watch: {
    graphData: function() {
      this.$nextTick(function () {
        this.drawChart();
      })
    }
  }
};


/**
 * The panel with the sensor results.
 */
fit20.components.sensorresults = {
  template: `
  <div>
    <div class="sensorResults">
        <table class="w-100">
          <thead>
            <tr>
              <th rowspan="2">
                <button type="button" class="btn btn-warning btn-icon" @click="finish">
                  <i class="fas fa-times"></i>
                </button>
              </th>
              <th class="border-0"></th>
              <th class="border-0"></th>
              <th colspan="3" class="border-bottom border-secondary">{{ $t('M0930') }}</th>
            </tr>
            <tr>
              <th colspan="2"></th>
              <th>{{ $t('M0931') }}</th>
              <th>{{ $t('M0932') }}</th>
              <th>{{ $t('M0933', {nr: 5}) }}</th>
            </tr>
          </thead>
          <tr v-for="stats, index in exerciseStats" :class="stats.css_classes" class="font-weight-bold">
            <td><img :src="stats.img_src" :alt="index"></td>
            <td class="text-left score"><span :class="stats.css_classes">{{ $t(stats.label) }}</span></td>
            <td><span class="score">{{ stats.score }}</span></td>
            <td>
              <span :class="max_score_class(stats.score, stats.all_weights)">
              {{ newHighest(stats.all_weights, stats.score) }}
              </span>
            </td>
            <td>
              <span :class="max_score_class(stats.score, stats.same_weight)">
              {{ newHighest(stats.same_weight, stats.score) }}
              </span>
            </td>
            <td>
              <span :class="max_score_class(stats.score, stats.last_5_weeks)">
              {{ newHighest(stats.last_5_weeks, stats.score) }}
              </span>
            </td>
          </tr>
        </table>
    </div>
    <sensorresults_graph
      :graphData="graphData"
      :reversalTimes="reversalTimes"
      :member="member"
    ></sensorresults_graph>
  </div>
  `,
  components: {
    sensorresults_graph: fit20.components.sensorresults_graph
  },
  /**
   * member: An object with at least an 'id' property. In the future, The member's name might be displayed.
   * average, tempo, rhythm, range: Quality scores, usually 0..100, but can be anything.
   * graphData: Array of [time, actual_position, reference_position].
   */
  props: ['member', 'average', 'tempo', 'rhythm', 'range', 'graphData', 'reversalTimes', 'exercise', 'sessions'],
  methods: {
    newHighest: function(oldScore, newScore) {
      if (oldScore) {
        if (newScore > oldScore) {
          return newScore;
        } else {
          return oldScore;
        }
      } else {
        return newScore || 0;
      }
    },
    max_score_class: function(current, best) {
      if (current > best) { //  && best > 0  //  score is also a record if no data is available
        return "new_personal_best";
      } else if (current == best) { //  && best > 0
        return "personal_best";
      } else {
        return "";
      }
    },
    finish: function() {
      fit20.log(`* clicked finishExercise for ${this.member.fullName}`);
      var scope = this;
      fit20.sensors.finishExercise(fit20.store.state.currentStudio.id, scope.member.id).
      catch(function(message){
        //fit20.app.addAlert('error', $t(message)); // too many alerts
      }).
      then(function(){
        scope.$emit('finish_exercise'); // handled in sensor / member_panel component
      });
    }
  }, // methods
  computed: {
    /* return statistics in the form
         {
           average: {'css_classes', 'img_src', 'label', 'all_weights', 'same_weight', 'last_5_weeks', 'score'},
           tempo:   {'css_classes', 'img_src', 'label', 'all_weights', 'same_weight', 'last_5_weeks', 'score'},
           rhythm:  {'css_classes', 'img_src', 'label', 'all_weights', 'same_weight', 'last_5_weeks', 'score'},
           range:   {'css_classes', 'img_src', 'label', 'all_weights', 'same_weight', 'last_5_weeks', 'score'}
         }
     */
    exerciseStats: function() {
      if (this.exercise && this.sessions) {
        var machineId = this.exercise.machineId;
        var exerciseWeight = this.exercise.weight;
        var sessions = this.sessions;
        // Helper functions:
        // Get highest scoreProperty from an array with objects.
        var getHighestScore = function(items, scoreProperty) {
          if (isEmpty(items)) {
            return 0;
          } else {
            return Math.round(Math.max.apply(Math,
              items.map(function(item) {
                return item && item[scoreProperty];
              }).filter(function(item){
                return isDefined(item);
              })
            ));
          }
        };
        // Find the exercise specified by machineId in a session or undefined.
        var getExerciseFor = function(machineId, session) {
          return session.exercises.find(function(exercise) {
            return isDefined(exercise) && exercise.machineId == machineId;
          });
        };
        // Computations:
        // Exercises for this machine in previous sessions. This may not contain all sessions.
        var exercisesForMachine = sessions.
          filter(function(session) {
            return isDefined(session.exercises)
          }).
          map(function(session) {return getExerciseFor(machineId, session)}).
          filter(isDefined);
        // Exercises on same weight.
        var exercisesSameWeight = exercisesForMachine.
          filter(function(exercise) {
            return exercise.weight == exerciseWeight
          });
        // Exercises from the last 5 weeks
        var recently = new Date().getTime() - (35 * 24 * 60 * 60 * 1000); // Timestamp 5 weeks back
        var exerciseLastWeeks = sessions.
          filter(function(session) { // can be made more efficient, sessions are ordered
            return isDefined(session.exercises) && Date.parse(session.date) > recently
          }).
          map(function(session) {return getExerciseFor(machineId, session)}).
          filter(isDefined);
        return {
          'average' : {
            'css_classes': 'average',
            'img_src': "images/icon-award.svg",
            'label': 'M0901',
            'all_weights': getHighestScore(exercisesForMachine, 'qs_average'),
            'same_weight': getHighestScore(exercisesSameWeight, 'qs_average'),
            'last_5_weeks': getHighestScore(exerciseLastWeeks, 'qs_average'),
            'score': this.average
          },
          'tempo' : {
            'css_classes': 'tempo',
            'img_src': "images/icon-tempo.svg",
            'label': 'M0902', // tempo
            'all_weights': getHighestScore(exercisesForMachine, 'qs_tempo'),
            'same_weight': getHighestScore(exercisesSameWeight, 'qs_tempo'),
            'last_5_weeks': getHighestScore(exerciseLastWeeks, 'qs_tempo'),
            'score': this.tempo
          },
          'rhythm' : {
            'css_classes': 'rhythm',
            'img_src': "images/icon-rhythm.svg",
            'label': 'M0903',
            'all_weights': getHighestScore(exercisesForMachine, 'qs_rhythm'),
            'same_weight': getHighestScore(exercisesSameWeight, 'qs_rhythm'),
            'last_5_weeks': getHighestScore(exerciseLastWeeks, 'qs_rhythm'),
            'score': this.rhythm
          },
          'range' : {
            'css_classes': 'range',
            'img_src': "images/icon-range.svg",
            'label': 'M0904',
            'all_weights': getHighestScore(exercisesForMachine, 'qs_range'),
            'same_weight': getHighestScore(exercisesSameWeight, 'qs_range'),
            'last_5_weeks': getHighestScore(exerciseLastWeeks, 'qs_range'),
            'score': this.range
          }
        };
      } else { // no selected exercise
        return {
          average: {'all_weights': '-', 'same_weight': '-', 'last_5_weeks': '-', 'newScore': '-'},
          tempo: {'all_weights': '-', 'same_weight': '-', 'last_5_weeks': '-', 'newScore': '-'},
          rhythm: {'all_weights': '-', 'same_weight': '-', 'last_5_weeks': '-', 'newScore': '-'},
          range: {'all_weights': '-', 'same_weight': '-', 'last_5_weeks': '-', 'newScore': '-'}
        };
      }
    } // exerciseStats
  } // computed
};
