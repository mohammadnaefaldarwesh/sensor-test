/**
 * Vue component for sensor.
 */

fit20.components.sensor = {
  template: `
    <div class="sensor_panel pl-2 pb-1 mb-1 border-bottom"
      v-if="visible_sensor"
    >
      <sensorcontrols class="mb-1"
        v-if="panelMode === 'progress'"
        :member="member"
        :panelMode="panelMode"
        :visible_sensor="visible_sensor"
        :isCalibrated="isCalibrated"
        :isExerciseStarted="isExerciseReallyStarted"
        @close="closeSensorPanel"
        @retry="retryConnectSensor"
      ></sensorcontrols>
      <sensorprogress
        :count="count"
        :actual_position="actual_position"
        :reference_position="reference_position"
        :tracking="tracking"
        :repetition="repetition"
        :colorScheme="colorScheme"
        v-if="panelMode === 'progress'"
      ></sensorprogress>
      <sensorresults
        v-if="panelMode === 'results'"
        :member="member"
        :average="average"
        :tempo="tempo"
        :rhythm="rhythm"
        :range="range"
        :graphData="graphData"
        :reversalTimes="reversalTimes"
        :exercise="exercise"
        :sessions="sessions"
        @finish_exercise="finishExercise"
      ></sensorresults>
    </div>
  `,
  components: {
    sensorheader: fit20.components.sensorheader,
    sensorprogress: fit20.components.sensorprogress,
    sensorcontrols: fit20.components.sensorcontrols,
    sensorresults: fit20.components.sensorresults,
    sensorresultcontrols: fit20.components.sensorresultcontrols
  },
  props: ['machine', 'member', 'exercise', 'sessions', 'adjustableSettings', 'visible_sensor', 'panelId', 'isExerciseStarted'],
  data: function() {
    return {
      count: '',
      actual_position: 0,
      reference_position: 0,
      tracking: 0,
      repetition: 0, // 0 = start; >0 = moving, -1 = stationary
      colorScheme: [
        { tracking: 0.05, color: '#92D400' },
        { tracking: 0.07, color: '#DDDD00' },
        { tracking: 0.10, color: '#EECC00' },
        { tracking: 0.13, color: '#FF9900' },
        { tracking: 0.20, color: '#EE5500' } ],
      isSensorConnected: false,
      memberUsesMachineSensor: false,
      isCalibrated: [false, false],
      panelMode: 'none', // 'none', 'connecting', 'progress', 'results'
      average: 0,
      tempo: 0,
      rhythm: 0,
      range: 0,
      graphData: []
    }
  },

  methods: {

    errorHandler: function(type, description, callbackButtons) {
      if (!description) debugger;
      description = stringify(description);
      var memberName = scope.member.fullName;
      var machineName = scope.machine.longName;
      var message = `M0915: ${description}\n${memberName}, ${machineName}`;
      fit20.app.addAlert(type, message, callbackButtons);
      fit20.log(`!! Sensor errorHandler closes sensor panel ${this.displayMemberAndMachine} after error: ${description}`);
      fit20.logServer(message, "sensor errorHandler", 2);
      this.closeSensorPanel('error');
    },

    stateHandler: function(state) {
      if (isDefined(state.isCalibrated)) {
        Vue.set(this.isCalibrated, 0, state.isCalibrated[0]);
        Vue.set(this.isCalibrated, 1, state.isCalibrated[1]);
      }
      if (state.stopSensor) {
        this.closeSensorPanel('stateHandler(state.stopSensor)'); // Calls finishExercise on the sensor.
      }
    },

    dataHandler: function(data) {
        if (isUndefined(data)) data = {};
        if (this.panelMode != 'progress' && this.panelMode != 'results' && isDefined(data.count)) {
          fit20.log(`* Sensor dataHandler showing progress ${this.displayMemberAndMachine}.`);
          this.panelMode = 'progress';
        }
        this.count = data.count;
        this.actual_position = data.actual_position || 0;
        this.reference_position = data.reference_position || 0;
        this.tracking = data.tracking || 0;
        this.repetition = data.repetition || 0;
    },

    /** Display results from the exercise.
     * results : {average, tempo, rhythm, range,
     *            graphData: [[time, actual_position, reference_position], ...],
     *            reversalTimes: [time, ...]}
     *   Time is in seconds, counting from start of exercise. Positions are numeric.
     *   The reversalTimes are optional.
     *   If results is {}, the results are reset, but the result panel is shown.
     *   If results is undefined, the results are reset.
     */
    resultHandler: function(results) {
      // Setting panelmode early allows for a delay in the actual results (#382), closing the progress panel.
      if (isDefined(results)) this.panelMode = 'results';
      if (isDefined(results) && isDefined(results.average)) {
        fit20.log(`* Sensor resultHandler showing results ${this.displayMemberAndMachine}.`);
        if (results.average == 0 || results.tempo < 5 || results.rhythm < 5) {
          fit20.log(`! Incorrect sensor results: ${stringify(results)}`);
          fit20.logServer('Incorrect sensor results', 'sensor.js resultHandler', 2);
        }
        ['average', 'tempo', 'rhythm', 'range'].forEach(function(qs) {
          results[qs] = Math.round(results[qs]);
          this[qs] = results[qs];
        }, this);
        // Emit results to save in exercise data.
        this.$emit('sensor_results', results);
        this.graphData = results.graphData;
        this.reversalTimes = results.reversalTimes;
      } else {
        // reset the results
        fit20.log(`* Sensor resultHandler resetting results ${this.displayMemberAndMachine}.`);
        ['average', 'tempo', 'rhythm', 'range'].forEach(function(qs) {
          this[qs] = 0;
        }, this);
        this.graphData = [];
        this.reversalTimes = undefined;
      }
      // Initial situation must be set, next exercise may not have a sensor to send data.
      this.repetition = 0;
    },

    finishExercise: function() {
      fit20.log(`* Sensor: Finish exercise ${this.displayMemberAndMachine}.`);
      this.$emit('finish_exercise');
    },

    retryConnectSensor: function(retries){
      if (isUndefined(retries)) retries = 0;
      var scope = this;
      if (fit20.sensors && fit20.sensors.finishExercise) {
        // Only when there are sensors in the studio.
        fit20.log(`! Sensor: finish and retry to connect ${scope.displayMemberAndMachine}`);
        fit20.sensors.finishExercise(fit20.store.state.currentStudio.id, this.member.id).
        catch(() => {}).then(function(){
          fit20.log(`! Sensor: retry ${retries} to connect ${scope.displayMemberAndMachine}`);
          scope.connectSensor(retries);
        });
      }
    },

    connectSensor: function(retries) {
      if (isUndefined(retries)) retries = 0;
      var scope = this;
      var $panel = $('#'+this.panelId);
      fit20.app.startLoading(true, $panel); // Block UI
      fit20.log(`* Sensor: connectSensor ${this.displayMemberAndMachine} in panel ${this.panelId}`);
      var member = this.member;
      var machine = this.machine;
      this.panelMode = 'connecting';
      fit20.sensors.configureExercise(this.studioId, machine.id, member,
                                      this.errorHandler, this.stateHandler, this.dataHandler, this.resultHandler,
                                      {retries: retries, colorScheme: this.colorScheme}).
      then(function(result) {
        fit20.log(`* Sensor: configured ${scope.displayMemberAndMachine}: ${stringify(result || 'OK')}`);
        // Clear any left-over data.
        scope.dataHandler();
        scope.resultHandler();
        // If we can configureExercise, the machine has a sensor.
        scope.isSensorConnected = true;
        // Trigger action to hide/show member-info based on this result.
        scope.$emit('visibility_toggle', scope.showSensor);
        return result;
      }).
      then(function(result){
        fit20.log(`* Sensor: connectSensor connected ${scope.displayMemberAndMachine}.`);
        scope.panelMode = 'progress';
      }).
      catch(function(error) {
        fit20.log(`! Sensor: connectSensor cannot configure ${scope.displayMemberAndMachine}: ${stringify(error)}`);
        scope.panelMode = 'none';
        return fit20.app.addAlert('error', `M0915: ${error}\n${scope.displayMemberAndMachine}`,
            [ { callback: function(){scope.closeSensorPanel('configure error')} },
              { text: $t('M0041'), callback: function(){scope.retryConnectSensor(retries+1)} }
            ]);
      })
      .catch(() => {}).then(function(){
        fit20.app.stopLoading(true, $panel); // Unblock UI.
      });
    },

    closeSensorPanel: function(reason) {
      fit20.log(`* Sensor: closing panel ${this.displayMemberAndMachine} ${reason ? 'because '+reason : ''}`);
      var scope = this;
      var closingActions = function () {
        scope.$emit('visibility_toggle', false);
        scope.isSensorConnected = false; // Stop showing the sensor. Set when exercise is configured.
        // Initial situation must be set, next exercise may not have a sensor to send data.
        scope.repetition = 0;
      };
      if (fit20.sensors && fit20.sensors.finishExercise) {
        fit20.sensors.finishExercise(fit20.store.state.currentStudio.id, this.member.id).
        catch(function(error) {
          fit20.log(`! Sensor: closeSensorPanel cannot finishExercise, ${error}`)
        }).
        then(function(){
          closingActions()
        });
      } else {
        closingActions();
      }
    },

    // When the selected machine or a machine setting changes, call this to update the sensor panel.
    updateSensorAfterChange: function(why) {
      if (fit20.sensors.active) {
        this.panelMode = 'none'; // wait for data to arrive
        this.isSensorConnected = false; // set when exercise is configured
        if (this.machine && this.adjustableSettings && this.adjustableSettings[this.machine.id]) {
          this.memberUsesMachineSensor = this.adjustableSettings[this.machine.id]['^0081'] == 'M0030';
        } else {
          this.memberUsesMachineSensor = false;
        }
        fit20.log(`* Sensor: update after change in ${why}, ${this.displayMemberAndMachine}.`+
                  `  memberUsesMachineSensor=${this.memberUsesMachineSensor}`);
        this.isCalibrated = [false, false]; // This must be set by stateHandler.
        if (this.memberUsesMachineSensor) {
          this.connectSensor();
        } else {
          this.closeSensorPanel('Member does not use sensor');
        }
      } // fit20.sensors.active
    }

  }, // methods

  computed: {
    studioId: function() {
      return fit20.store.state.currentStudio.id;
    },
    displayMemberAndMachine: function() {
      return ' ' +
        (this.member ? `${this.member.fullName} (${this.member.id})` : '<no member>') + ' / ' +
        (this.machine ? `${this.machine.longName} (${this.machine.id})` : '<no selected machine>');
    },
    expectSensor: function() {
      var sensorExpected = fit20.sensors.active && this.memberUsesMachineSensor;
      if (!sensorExpected) {
        // sets isSensorConnected = false
        this.closeSensorPanel(`!sensorExpected, sensors.active=${fit20.sensors.active} && memberUsesMachineSensor=${this.memberUsesMachineSensor}`);
      }
      return sensorExpected;
    },
    showSensor: function() {
      return fit20.sensors.active && this.isSensorConnected && this.memberUsesMachineSensor;
    },
    isExerciseReallyStarted: function() {
      fit20.log(`* Sensor: isExerciseReallyStarted ${this.displayMemberAndMachine}. isExerciseStarted=${this.isExerciseStarted} && repetition=${this.repetition}`);
      return this.isExerciseStarted && this.repetition > 0;
    },
    isSensorActiveChangeAllowed: function(){
      // Do we accept a change in member-uses-sensor setting?
      return !this.isExerciseStarted && this.repetition == 0 && this.panelMode != 'results';
    }
  },

  watch: {
    machine: function(machine) {
      this.updateSensorAfterChange('machine');
    },
    adjustableSettings: { deep: true, handler: function(newAS, oldAS) {
      if ( this.isSensorActiveChangeAllowed && this.machine &&
           (newAS && newAS[this.machine.id] && newAS[this.machine.id]['^0081']) !=
           (oldAS && oldAS[this.machine.id] && oldAS[this.machine.id]['^0081'])
      ) {
        this.updateSensorAfterChange('adjustableSettings.sensor');
      }
    }}
  }

}
