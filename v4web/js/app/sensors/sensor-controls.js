/** ONLY FOR LOADING INDICATOR IN THE NEW LAYOUT
 * Top row for sensor panel, during exercise and results.
 */
fit20.components.sensorheader = {
  template: `
    <!-- Loading indicator and button to switch between sensor and member info. -->
    <div class="sensor_header mb-2" v-if="visible_sensor">
      <button v-if="panelMode == 'connecting'" type="button"
        class="btn btn-warning btn-icon mx-1"
        @click="$emit('retry')"
      >
        <span>{{ $t('M0041') }}</span>
        <i class="fa fa-rss fa-spin"></i>
      </button>
    </div>
  `,
  props: ['member', 'panelMode', 'visible_sensor', 'machine_has_sensor']
};


/**
 * Controls to use during exercise.
 */
fit20.components.sensorcontrols = {
  template: `
    <div class="sensor_controls">
      <button type="button" class="btn" :class="calibrationStartStyle" @click="calibrate(0)">
        <i class="fas fa-step-backward"></i>
      </button>
      <button type="button" class="btn" :class="calibrationEndStyle" @click="calibrate(1)">
        <i class="fas fa-step-forward"></i>
      </button>
      <span v-if="!isCalibrated[0] || !isCalibrated[1]"> {{ $t('M0920') }} </span>
      <button v-if="isExerciseStarted" type="button" class="btn btn-primary ml-4 px-4" @click="stationary">
        <span>10</span>
      </button>
      <button v-if="panelMode == 'connecting'" type="button"
        class="btn btn-warning btn-icon mx-1 float-right"
        @click="$emit('retry')"
      >
        <span v-if="visible_sensor">{{ $t('M0041') }}</span>
        <i class="fa fa-rss fa-spin"></i>
      </button>
      <button type="button"
        class="btn btn-warning btn-icon float-right"
        v-if="visible_sensor"
        @click="$emit('close')"
       >
        <i class="fas fa-times"></i>
      </button>
    </div>
  `,
  props: ['member', 'panelMode', 'visible_sensor', 'isCalibrated', 'isExerciseStarted'],
  methods: {
    // X can be 0 (start position) or 1 (end position)
    calibrate: function(x) {
      fit20.log(`* Sensor calibrate ${x ? 'end' : 'start'} for ${this.member.fullName}`);
      fit20.sensors.calibrate(fit20.store.state.currentStudio.id, this.member.id, x).
      then(function(){
        fit20.log('* Sensor calibrate succeeded.');
      }).
      catch(function(error){
        fit20.log(`! Sensor calibrate failed: ${JSON.stringify(error)}`);
        //return fit20.app.addAlert('error', $t(error.message)); // too many alerts
      })
    },
    restart: function(){
      // Restart does not work, and is not even well defined, do not use it.
      fit20.log(`! Sensor restart should not be used`);
      fit20.sensors.restartExercise(fit20.store.state.currentStudio.id, this.member.id).
      catch(function(error){
        fit20.log(`! restart failed: ${JSON.stringify(error)}`);
        //return fit20.app.addAlert('error', $t(error.message)); // too many alerts
      });
    },
    stationary: function() {
      fit20.sensors.stationaryExercise(fit20.store.state.currentStudio.id, this.member.id).
      catch(function(error){
        fit20.log(`! stationary failed: ${JSON.stringify(error)}`);
        // Just continue as if nothing happened.
      });
    }
  }, // methods
  computed: {
    calibrationStartStyle: function() {
      return this.isCalibrated[0] ? 'btn-primary' : 'btn-danger';
    },
    calibrationEndStyle: function() {
      return this.isCalibrated[1] ? 'btn-primary' : 'btn-danger';
    }
  }
};
