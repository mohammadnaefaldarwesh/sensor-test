/* Trainer controls for the active session. */
fit20.components.sessioncontrols = {
  // For minutes and seconds use input[type=tel] which is like a number with leading zeroes.
  template: `
    <div v-show="isShown" class="session-controls pr-2 pl-1">
      <div class="session-controls-ui">
        <div class="header" @click="editMMSettings" :class="{'bg-emphasis' : !exerciseOKforMember}">
          <h5 class="machine-name text-white m-0">
            <div class="mb-2">{{ machine ? machine.name : '' }}</div>
          </h5>
          <div class="machine-settings text-white">
            <membermachinesettings :memberId="memberId" :machine="machine"
                :adjustableSettings="adjustableSettings"
                :classes="['text-white', 'text-white', 'text-danger']">
            </membermachinesettings>
          </div>
          <div class="membermachine-remark text-white" v-if="settings.remark">
            {{ settings.remark || "\u00A0" }}
          </div>
        </div>
        <div class="control text-white">
            <div class="name">
              <i class="fas fa-balance-scale"></i><!-- M0811 -->
            </div>
            <div class="select">
              <select v-model="exercise.weight" style="min-width:70px;">
                <option v-for="weight in (machine ? machine.weightValues : [])">{{ weight }}</option>
              </select>
            </div>
            <div class="w-20 text-center weight-fz">{{ machine ? machine.weightUnit : '' }}</div>
            <div class="weight-up-down pl-2" v-show="exercise">
              <button @click="setWeight(+1)" class="btn btn-primary py-0 mb-1"><i class="fas fa-sort-up"></i></button>
              <button @click="setWeight(-1)" class="btn btn-primary py-0"><i class="fas fa-sort-down"></i></button>
            </div>
        </div>
        <div class="control text-white">
          <div class="name">
            <i class="fas fa-stopwatch"></i><!-- M0812 -->
          </div>
          <div class="select">
            <select class="min" v-model="setMinutes" @change="setDuration">
              <option v-for="min in minutes" :value="min" :selected="min == setMinutes ? 'selected': ''">{{ min }}</option>
            </select>
            <span>:</span>
            <select class="sec" v-model="setSeconds" @change="setDuration">
              <option v-for="sec in seconds" :value="sec" :selected="sec == setSeconds ? 'selected': ''">{{ sec }}</option>
            </select>
          </div>
          <div class="w-20">
            <button type="button" class="btn" :class="stopButtonClass" @click="stopExercise">
              <i class="fa fa-stop" aria-hidden="true"></i>
            </button>
          </div>
        </div>
        <div class="control text-white">
          <label v-for="val in ['NONE', 'MORE', 'SAME', 'LESS']"
                 :for="buttonId(val)"
                 class="btn m-1"
                 :class="{ 'btn-primary': val == exercise.weightChange, 'btn-secondary': val != exercise.weightChange }"
          >
            <input :id="buttonId(val)" :name="buttonId('weightChange')" type="radio" v-model="exercise.weightChange" :value="val">
            {{ val | weightChange }}
          </label>
        </div>
        <div class="control text-white bottom flex-column">
          <div class="name w-100 pb-1">
            {{ $t('M0326') }}
          </div>
          <div class="select w-100">
            <textarea v-model="exercise.remark"></textarea>
          </div>
        </div>
        <editmembermachinesettings :member="member" :machine="machine"
          :id="memberMachineSettingsEditId" :ref="memberMachineSettingsEditId" @settingsChanged="settingsChanged">
        </editmembermachinesettings>
      </div>
    </div>
  `,
  components: {
    membermachinesettings: fit20.components.membermachinesettings,
    editmembermachinesettings: fit20.components.editmembermachinesettings
  },
  props: ['member', 'session', 'selectedExercise', 'isExerciseStarted', 'isExerciseActive', 'adjustableSettings'],
  data: function() {
    return {
      exercise: {}, // The exercise data as it is displayed. This corresponds to the selectedExercise prop which is read-only.
      setMinutes: undefined,
      setSeconds: undefined
    }
  },
  computed: {
    minutes: function() {return [ 0,1,2,3,4 ]},
    seconds: function() {return Array.apply(0, Array(60)).map(function(x, i) {return "0".substring(i >= 10) + i})},
    memberId: function() {
      return this.member && this.member.id;
    },
    machine: function() { // The machine used for the displayed exercise.
      return this.exercise && fit20.store.state.machines[this.exercise.machineId] || {};
    },
    machineId: function() {
      return this.machine && this.machine.id;
    },
    isShown: function() {
      return isDefined(this.exercise);
    },
    memberMachineSettingsEditId: function() {
      return "member-machine-settings-edit-"+(this.memberId)
    },
    // Settings for current machine and current member.
    settings: function() {
      var settings =
        fit20.store.state.memberMachineSettings && fit20.store.state.memberMachineSettings[this.memberId]
        ? fit20.store.state.memberMachineSettings[this.memberId][this.machineId]
        : undefined;
      return settings || {values: [], remark:""};
    },
    // Return boolean indicating if the exercise can be done.
    exerciseOKforMember: function() {
      return isUndefined(this.adjustableSettings[this.machineId]) ||
             isEmpty(this.adjustableSettings[this.machineId]['^0001']);
    },
    stopButtonClass: function(){
      return this.selectedExercise ? (this.isExerciseStarted ? 'btn-primary' : (this.isExerciseActive ? 'btn-emphasis flashopq' : 'btn-emphasis')) : 'btn-secondary';
    }
  }, // computed
  methods: {
    editMMSettings: function() {
      if (this.machine) {
        fit20.app.modal(this.memberMachineSettingsEditId);
      }
    },
    buttonId: function(suffix) {
      return this.member ? this.memberId+suffix : Date.now()+suffix;
    },
    settingsChanged: function(){
      this.$emit('settingsChanged');
    },
    // Pressing the stop button calls stopExercise().
    stopExercise: function() {
      if (this.selectedExercise) {
        if (this.isExerciseStarted) {
          var duration = this.$parent.getStopwatchDuration();
          fit20.log(`* sessioncontrols stopExercise for ${this.member && this.member.fullName} at ${duration} sec.`);
          // If the stopwatch  is running, use its duration. Otherwise keep the duration from this exercise.
          if (!isNaN(duration)) {
            this.$set(this.exercise, 'duration', (duration >= 0) ? duration : 0);
          } else {
            duration = this.exercise.duration;
          }
          if (isUndefined(this.exercise.weight)) {
            this.$set(this.exercise, 'weight', 0.0);
          }
          this.setOrder();
          // Update minutes / seconds fields.
          this.setMinutesSeconds(duration);
          this.$emit('stopExercise'); // handled in member_panel component
        } else {
          // Exercise is already stopped.
          this.$emit('finishExercise'); // handled in member_panel component
        }
      }
    },
    setDuration: function() {
      var duration = 60 * parseInt(this.setMinutes) + parseInt(this.setSeconds);
      this.$set(this.exercise, 'duration', (duration >= 0) ? duration : 0);
      this.setOrder();
    },
    setMinutesSeconds: function(duration) {
      this.setMinutes = "" + Math.floor(duration / 60);
      var seconds = Math.abs(duration % 60);
      this.setSeconds = "0".substring(seconds >= 10) + seconds;
    },
    setOrder: function() {
      if (!this.exercise.order && this.exercise.duration > 0) {
        this.exercise.order = this.session.exercises.filter(function(xrc){return xrc.order > 0}).length + 1;
      }
    },
    setWeight: function(delta) { // delta can be -1, +1.
      if (this.machine && this.machine.weightValues) {
        var currentIndex = this.machine.weightValues.indexOf(String(this.exercise.weight));
        var nextIndex = currentIndex + delta;
        if (nextIndex >= 0 && nextIndex < this.machine.weightValues.length) {
          this.exercise.weight = this.machine.weightValues[nextIndex];
        }
      }
    },
  }, // methods
  watch: {
    selectedExercise: function (selectedExercise) {
      // The exercise data as it is displayed. This corresponds to the selectedExercise prop which is read-only.
      // Copy exercise data to local data.
      if (isDefined(selectedExercise)) {
        this.exercise = selectedExercise;
        this.setMinutesSeconds(this.exercise.duration);
      } else if (isUndefined(this.exercise)) {
        // Do not unselect the copy of the exercise, so that the trainer can still change it after [stop].
        this.exercise = {};
        this.setMinutesSeconds(0.0);
      }
    }
  } // watch
}; // fit20.components.sessioncontrols
