/* member_panel is a sub-component that is instantiated for both the member and its duo-partner. */

fit20.components.member_panel = {
  template: `
    <div class="member-panel" :id="panelId">
      <div class="memberinfocolumn">
        <sensor
          v-if="activeSession"
          :machine="selectedMachine"
          :member="member"
          :exercise="selectedExercise"
          :sessions="sessions"
          :adjustableSettings="adjustableSettings"
          :visible_sensor="visible_sensor"
          :panelId="panelId"
          :isExerciseStarted="isExerciseStarted"
          @visibility_toggle="sensorVisibilityToggle"
          @sensor_results="sensorResults"
          @finish_exercise="finishExercise"
        ></sensor>
        <div class="d-flex flex-row">
          <memberinfo class="w-50"
            :member="member"
            :sessions="sessions || []"
            :activeSession="activeSession"
          ></memberinfo>
          <membermessages class="w-50"
            :member="member"
            :activeSession="activeSession"
          ></membermessages>
        </div>
      </div>
      <membersessions
        :member="member"
        :sessions="sessions || []"
        :activeSession="activeSession"
        :selectedMachine="selectedMachine"
        :duoPartnerSelectedMachine="duoPartnerSelectedMachine"
        :isExerciseStarted="isExerciseStarted"
        :adjustableSettings="adjustableSettings"
        :machineRemarks="machineRemarks"
        @selectMachine="selectMachine"
      ></membersessions>
      <sessioncontrols
        v-if="activeSession"
        :member="member"
        :session="activeSession"
        :selectedExercise="selectedExercise"
        :isExerciseStarted="isExerciseStarted"
        :isExerciseActive="isExerciseActive"
        :adjustableSettings="adjustableSettings"
        @stopExercise="stopExercise"
        @finishExercise="finishExercise"
        @settingsChanged="settingsChanged"
      ></sessioncontrols>
      <editmembermachinesettings
        :member="member" :machine="focusedMachine"
        :id="memberMachineSettingsViewId" :ref="memberMachineSettingsViewId" @settingsChanged="settingsChanged">
      </editmembermachinesettings>
    </div>
  `,
  components: {
    'memberinfo': fit20.components.memberinfo,
    'membermessages': fit20.components.membermessages,
    'membersessions': fit20.components.membersessions,
    'editmembermachinesettings': fit20.components.editmembermachinesettings,
    'sessioncontrols': fit20.components.sessioncontrols,
    'sensor': fit20.components.sensor
  },
  props: ['member', 'sessions', 'activeSession', 'duoPanel'],
  /* defined / true       select  start  stationary  stop  finish
   * selectedMachine    ....*********************************......
   * selectedExercise   ....*********************************......
   * isExerciseStarted  ............*******************............
   * isExerciseActive   ............*************************......
   */
  data: function() {
    return {
      focusedMachine: undefined, // Machine that user clicks on, when not in a session.
      selectedMachine: undefined, // Machine that is selected for an exercise.
      selectedExercise: undefined,
      isExerciseStarted: false,
      isExerciseActive: false,
      visible_sensor: false
    }
  },
  methods: {

    // Toggle sensor visibility.
    sensorVisibilityToggle: function(sensorOn) {
      if (isUndefined(sensorOn)) {
        sensorOn = !this.visible_sensor;
      }
      this.visible_sensor = sensorOn;
      fit20.log(`* member_panel: Sensor visibility toggled to ${sensorOn} for member ${this.memberDisplay})`);
    },

    settingsChanged: function() {
      // OK, update moet vanzelf gaan.
    },

    // selectMachine handles the selection of a machine to start an exercise or to view and change settings.
    // If machineId is null or undefined, no machine is selected, and any selected machine must be unselected.
    selectMachine: function(machineId) {
      var scope = this;
      if (!isDefined(machineId)) {
        // machineId is not defined
        fit20.log(`* member_panel: De-selecting machine for ${scope.memberDisplay}`);
        scope.finishExercise();
        return;
      }
      var session = scope.activeSession;
      var selectedMachine = fit20.store.state.machines[machineId] || {};
      // Selection of a machine / exercise is only meaningful when there is an active session and no exercise is running,
      // and the machine is not already selected,
      // and the machine is not already selected for the duo partner.
      // If selection is not possible, show the machine settings.
      var canSelectMachine = isDefined(session) && !this.isExerciseStarted &&
                             !( isDefined(this.selectedExercise) && this.selectedExercise.machineId == machineId ) &&
                             !( isDefined(this.duoPartnerSelectedMachine) && this.duoPartnerSelectedMachine.id == machineId );
      if (canSelectMachine) {
        fit20.log(`* member_panel: Selecting machine ${selectedMachine.longName} (${selectedMachine.id}) for ${scope.memberDisplay}`);
        // First stop the running exercise if one is selected, then continue.
        // If none is selected, just resolve and continue.
        (isDefined(scope.selectedExercise) ?
          scope.stopExercise({terminate: true, cause: `selectMachine change to ${machineId} for ${this.memberDisplay}`}) :
          Promise.resolve(`member_panel selectMachine: no previous machine selected for ${this.memberDisplay}`)
        ).
        then(function(result){
          // Finish the previous exercise, take time for that to propagate by waiting for the promise.
          return scope.finishExercise();
        }).
        then(function(result){
          // Select the machine.
          scope.selectedMachine = selectedMachine;
          // Exercises might not be defined yet.
          if (isUndefined(session.exercises)) session.exercises = [];
          // Find the exercise for the selected machine.
          var exerciseIndex = session.exercises.findIndex(function(xrc){return xrc.machineId == machineId});
          if (exerciseIndex < 0) {
            // If the exercise for this machine does not yet exist, create it.
            scope.selectedExercise = scope._makeNewExercise(scope.selectedMachine, session);
            // Add the new exercise to the session.
            session.exercises.push(scope.selectedExercise);
          } else {
            // If an existing exercise is selected, reactively change the exercises.
            scope.selectedExercise = session.exercises[exerciseIndex];
            // Update the exercise in the session.
            Vue.set(session.exercises, exerciseIndex, scope.selectedExercise);
          }
          // Too much logging below, needed to find a nasty bug.
          var activeSessionExerciseMachineIds = (session.exercises || []).map(function(xrc){return xrc && xrc.machineId}).join(', ');
          fit20.log(`* member_panel.selectMachine Exercise for ${scope.memberDisplay} is `+
              `${scope.selectedExercise ? scope.selectedMachineDisplay : 'NOT selected'}, `+
              `activeSessionExerciseMachineIds are [${activeSessionExerciseMachineIds}]`);
        }).
        catch(function(error){
          fit20.log(`!! member_panel: Problem in member.selectMachine: ${error}`)
        });
      } else { // if canSelectMachine
        // show machine settings when selecting the machine is not meaningful
        this.focusedMachine = selectedMachine;
        this.$nextTick(function(){fit20.app.modal(this.memberMachineSettingsViewId)});
      } // else canSelectMachine
    }, // selectMachine

    // Make a new exercise for a machine, with weight based on previous session data if possible.
    _makeNewExercise: function(machine, session) {
      var weight = -1;
      if (isDefined(this.sessions)) {
        for (var sessionIndex = this.sessions.length - 1; sessionIndex >= 0; -- sessionIndex) {
          if (this.sessions[sessionIndex].exercises) {
            var exercise = this.sessions[sessionIndex].exercises.find(function(xrc){return xrc.machineId == machine.id});
            if (isDefined(exercise) && isDefined(exercise.weight)) {
              weight = exercise.weight;
              break;
            }
          }
        }
      }
      // If there was no previous exercise for this machine, use a default weight.
      if (weight < 0) {
        if (isDefined(machine.defaultWeight)) {
          weight = machine.defaultWeight;
        } else if (!isEmpty(machine.weightValues)) {
          weight = machine.weightValues[Math.floor(machine.weightValues.length / 2)];
        } else {
          weight = 0;
        }
      }
      // Return the new exercise.
      return {
        machineId: machine.id,
        order: '',
        weight: weight,
        duration: 0,
        weightChange:"NONE",
        remark: ""
      };
    }, // _makeNewExercise

    // Pass on getStopwatchDuration to child components.
    getStopwatchDuration: function() {
      return this.$parent.getStopwatchDuration();
    }, // getStopwatchDuration

    // StartExercise is called when an exercise is started.
    // Returns a promise that resolves when the exercise is started, and rejects when the exercise cannot be started.
    startExercise: function() {
      var scope = this;
      // Only start an exercise if one is selected.
      if (isUndefined(scope.selectedExercise)) {
        return Promise.reject(`member_panel startExercise: no exercise selected for member ${scope.memberDisplay}`);
      }
      // Sanity check
      if (scope.selectedExercise.machineId != scope.selectedMachine.id) {
        throw("Application error in fit20.components.member_panel.startExercise: "+scope.selectedExercise.machineId+" != "+scope.selectedMachine.id);
      }
      fit20.log(`* member_panel: startExercise for member ${scope.memberDisplay}, machine ${scope.selectedMachineDisplay}`);
      scope.isExerciseStarted = true;
      scope.isExerciseActive = true;
      return Promise.resolve("startExercise: exercise started");
    }, // startExercise

    // StopExercise handles the `sessioncontrols.stopExercise` event which signals pressing the stop-button for one member.
    // It is also called when the trainer selects an exercise or saves or cancels the session.
    // The options may contain:
    //   terminate: After stopping the exercise, terminate it by deselecting the exercise and optionally closing the sensor connection.
    //   cause: What is stopping the exercise.
    // Returns a promise, that resolves when the exercise (including sensors) has stopped.
    // It resolves when the exercise is already stopped.
    // When the exercise is stopped, the 'stopExercise' event is emitted.
    stopExercise: function(options) {
      options = options || {};
      var scope = this;
      var exerciseDisplay = {member: `${scope.memberDisplay}`};
      fit20.log(`* member_panel: stopExercise for ${stringify(exerciseDisplay)} by `+
          (fit20.sensors.active ? (options.terminate ? "terrminate-with-sensor" : "stop-with-sensor") : "stop-without-sensor")+
          (options.cause ? ` (${options.cause})` : ''));
      // immediateStopActions: these actions must be executed immediately, like stopping the stopwatch.
      // This happens before possible sensor delays such as timeouts.
      // Returns a promise.
      var immediateStopActions = function(scope) {
        // Only stop an exercise if one is selected or started.
        if (isUndefined(scope.selectedExercise)) {
          var message = "* member_panel: stopExercise: no exercise selected for "+stringify(exerciseDisplay);
          fit20.log(message);
          return Promise.resolve(); // This is not a problem.
        }
        if (! scope.isExerciseStarted && ! options.terminate) {
          var message = " member_panel: stopExercise: exercise is not started for "+stringify(exerciseDisplay);
          fit20.log(message);
          return Promise.resolve(); // This is not a problem.
        }
        // Trigger reactive change of the exercises.
        scope.reactiveExerciseChange(); // uses `selectedExercise` and `selectedMachine`
        scope.isExerciseStarted = false; // This must happen here to have # running exercises in member.js correct.
        exerciseDisplay.machine = scope.selectedMachineDisplay;
        fit20.log(`* member_panel: stopExercise is stopped for ${stringify(exerciseDisplay)}, emit stopExercise event`);
        // Stop the exercise in the member component. This may stop or reset the stopwatch, so do this last.
        scope.$emit('stopExercise', scope.member, scope.selectedExercise);
        // The following resets `selectedExercise` and `selectedMachine`.
        if (options.terminate) {
          scope.finishExercise();
        }
        return Promise.resolve("stopExercise: exercise successfully stopped");
      }; // immediateStopActions
      // Deal with sensor, if present, otherwise just resolve and continue.
      var sensorStopActions = function(scope) {
        //if (fit20.sensors.active) {
        if (scope.visible_sensor) {
          fit20.log(`* member_panel: stopExercise stopping sensor for ${stringify(exerciseDisplay)}`);
          var memberId = scope.member && scope.member.id;
          if (options.terminate) {
            return fit20.sensors.finishExercise(fit20.store.state.currentStudio.id, memberId);
          } else {
            return fit20.sensors.stopExercise(fit20.store.state.currentStudio.id, memberId);
          }
        } else {
          fit20.log(`* member_panel: stopExercise finishing without sensor for ${stringify(exerciseDisplay)}`);
          return scope.finishExercise(); // Finish immediately if no sensor is used.
        }
      }; // sensorStopActions
      return immediateStopActions(scope).
        then(function(){sensorStopActions(scope)}).
        then(function(){
          fit20.log(`* member_panel: stopExercise completed for ${stringify(exerciseDisplay)}`);
          return Promise.resolve();
        }).
        catch(function(result){
          debugger; // find out why does this happen?
          fit20.log(`! member_panel: stopExercise: ${stringify(exerciseDisplay)} sensor stop or finish was rejected `+JSON.stringify(result));
        });
    }, // stopExercise

    // SensorResults receives sensor results from the sensor panel.
    sensorResults: function(results) {
      var exercise = this.selectedExercise;
      if (isUndefined(exercise)) return Promise.resolve("sensorResults: no exercise selected");
      Vue.set(exercise, 'qs_average', results.average);
      Vue.set(exercise, 'qs_tempo', results.tempo);
      Vue.set(exercise, 'qs_rhythm', results.rhythm);
      Vue.set(exercise, 'qs_range', results.range);
    }, // sensorResults

    // FinishExercise handles the sensor.finish_exercise event, but is also called from other places.
    // Since it is called from sensor.finishExercise via the 'finish_exercise' event, do not call that function again.
    // It makes sure that any running exercise is closed.
    // Returns a promise.
    finishExercise: function() {
      fit20.log(`* member_panel: unSelect / finishExercise for machine ${this.selectedMachineDisplay} for member ${this.memberDisplay}`);
      this.selectedMachine = undefined;
      this.selectedExercise = undefined;
      this.isExerciseStarted = false;
      this.isExerciseActive = false;
      this.visible_sensor = false;
      // Return a nextTick promise, for code that depends on the un-selection above.
      return Vue.nextTick();
    }, // finishExercise

    // Trigger a reactive exercise change.
    // This will set the exercise data in the active session's exercises array.
    // Beware: This uses `selectedExercise` and `selectedMachine`.
    reactiveExerciseChange: function() {
      try {
        var selectedMachineId = this.selectedExercise && this.selectedExercise.machineId;
        if (isDefined(this.activeSession) && isDefined(selectedMachineId)) {
          if (selectedMachineId != this.selectedMachine.id) {
            throw('Application error in fit20.components.member_panel.reactiveExerciseChange '+
                ` for machine ${this.selectedMachineDisplay} for member ${this.memberDisplay}" ${selectedMachineId} != ${this.selectedMachine.id}`);
          }
          fit20.log(`* Trigger reactive exercise change  for machine ${this.selectedMachineDisplay} for member ${this.memberDisplay}`);
          var activeSessionExercises = this.activeSession.exercises || [];
          var exerciseIndex = activeSessionExercises.findIndex(function(xrc){return xrc.machineId == selectedMachineId}, this);
          if (exerciseIndex < 0) {
            debugger; // Yes, I want to debug this. It is a bug.
            var activeSessionExerciseMachineIds = activeSessionExercises.map(function(xrc){return xrc && xrc.machineId}).join(', ');
            var message = '!! member_panel: Application error in fit20.components.member_panel.reactiveExerciseChange '+
                  `for machine ${this.selectedMachineDisplay} for member ${this.memberDisplay}: ` +
                  `selectedMachineId [${selectedMachineId}] cannot be found in activeSessionExerciseMachineIds [${activeSessionExerciseMachineIds}]`;
            fit20.log(message);
            fit20.logServer(message, 'member-panel.js fit20.components.member_panel/reactiveExerciseChange', 2);
          } else {
            // This triggers the reactive exercise change. It is the only line that should matter here.
            Vue.set(this.activeSession.exercises, exerciseIndex, this.activeSession.exercises[exerciseIndex]);
            var activeSessionExerciseMachineIds = (this.activeSession.exercises || []).map(function(xrc){return xrc && xrc.machineId}).join(', ');
            fit20.log(`* member_panel: reactiveExerciseChange, activeSessionExerciseMachineIds are [${activeSessionExerciseMachineIds}]`);
          }
        }
      } catch (ex) {
        debugger; // Yes, I want to debug this. It is a bug.
        fit20.logServer(`Really bad coding caused ${JSON.stringify(ex)}`, 'member-panel.js fit20.components.member_panel/reactiveExerciseChange', 2);
      }
    } // reactiveExerciseChange

  }, // methods
  computed: {
    panelId: function() {
      return 'memberPanel-'+(this.member ? this.member.id : Math.random().toString());
    },
    memberMachineSettingsViewId: function() {
      return "member-machine-settings-view-"+this.panelId
    },
    memberDisplay: function() {
      return this.member ? `${this.member.fullName} (${this.member.id})` : '<no member>';
    },
    selectedMachineDisplay: function(){
      return this.selectedMachine ? `${this.selectedMachine.longName} (${this.selectedMachine.id})` : '<no selected machine>';
    },
    // For the current member, adjustableSettings is a map { machineId to { adjustableInitial to adjustableValue } }.
    // The adjustableInitial is not translated, so it is a i18n code.
    adjustableSettings: function() {
      var adjustablesMap = {};
      if (this.member) {
        if (isUndefined(fit20.store.state.machines)) {
          fit20.addAlert('error', 'M9111');
        }
        var settings = fit20.store.state.memberMachineSettings[this.member.id];
        if (isDefined(settings)) {
          var machines = Object.keys(settings).map(function(machineId){return fit20.store.state.machines[machineId]});
          for (var mi = 0; mi < machines.length; ++mi) {
            var machine = machines[mi];
            adjustablesMap[machine.id] = {};
            for (var ii = 0; ii < machine.adjustableInitials.length; ++ii) {
              if (isUndefined(settings[machine.id])) {
                var message = `!! member_panel: ${new Date().toString()}: settings[machine.id] is undefined for machine ${machine.longName} (${machine.id}), member ${this.memberDisplay}`;
                fit20.log(message);
                fit20.logServer(message, 'member-panel.js fit20.components.member_panel/adjustableSettings', 2);
                debugger; // This has happened incidentally, but cannot be reproduced.
              } else if (isDefined(settings[machine.id].values)) {
                adjustablesMap[machine.id][machine.adjustableInitials[ii]] = settings[machine.id].values[ii];
              }
            }
          }
        }
      }
      return adjustablesMap;
    }, // adjustableSettings
    // For the current member, machineRemarks is a map { machineId to remark }.
    machineRemarks: function() {
      var machineToRemark = {};
      if (this.member) {
        var settings = fit20.store.state.memberMachineSettings[this.member.id];
        if (isDefined(settings)) {
          Object.entries(settings).forEach(function(setting) {
            machineToRemark[setting[0]] = setting[1].remark
          });
        }
      }
      return machineToRemark;
    }, // machineRemarks
    duoPartnerSelectedMachine: function() {
      return isDefined(this.duoPanel) && this.duoPanel.selectedMachine;
    }
  } // computed
}; // fit20.components.member_panel
