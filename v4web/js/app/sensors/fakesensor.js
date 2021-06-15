/**
 * A simulated sensor, which always works and does everything automatically.
 */

fit20.sensors_fake = {
  // Data to be monitored by Vue components.
  active: undefined,
  leadInSeconds: -3,
  /* The currently registered exercises that use sensors.
   * This is a map from memberId to {studioId, machineId, stateHandler?}; // Everything with ? is optional.
   * There may be one or two members.
   */
  currentExercises: {},
  getCurrentExercise: function(memberId){
    return fit20.sensors_fake.currentExercises[memberId] ||
      {studioId: undefined, machineId: undefined, stateHandler: undefined, measurements: undefined};
  },
  /* Private to fake sensors. */
  /* The simulated gateway can be activated by setting fit20.sensors_fake._state[memberId] to 1 - 9, corresponding to a sensor in various stages.
   * You can set `fit20.sensors_fake._state[memberId] =  -1` to have a sensor error for that member.
   */
  _states : {ERROR: -1, CONFIGURED: 1, STARTED: 2, STATIONARY: 3, STOPPED: 4, CALIBRATED: 10},
  _state: undefined,
  _timeoutId: {}
};

/* Set ourselves as the sensor interface. */
fit20.sensors = fit20.sensors_fake;

/** Not in standard sensor API.
 * Get the calibration from the member-machine settings.
 * Returns {studioId, start, end} or {studioId} if no calibration has been set.
 */
fit20.sensors_fake.getCalibrationFromMMSettings = function(memberId, machineId, studioId) {
  // make sure that fit20.store.state.memberMachineSettings[memberId][machineId].sensorCalibrations exists
  if (isUndefined(fit20.store.state.memberMachineSettings[memberId])) {
    fit20.store.state.memberMachineSettings[memberId] = {};
  }
  var mSettings = fit20.store.state.memberMachineSettings[memberId];
  if (isUndefined(mSettings[machineId])) {
    mSettings[machineId] = {};
  }
  var mmSettings = mSettings[machineId];
  if (isUndefined(mmSettings.sensorCalibrations)) {
    mmSettings.sensorCalibrations = [];
  }
  var calibrations = mmSettings.sensorCalibrations;
  // find calibrations for the right studio
  var index = calibrations.findIndex(function(calib){return calib.inStudioId == studioId});
  if (index < 0) {
    calibrations.push({inStudioId: studioId});
  }
  var calibration = calibrations.find(function(calib){return calib.inStudioId == studioId});
  return calibration;
};

/** Not in standard sensor API.
 * Set the calibration in the member-machine settings.
 */
fit20.sensors_fake.setCalibration = function(memberId, machineId, studioId, startOrEnd, position) {
  var calibration = fit20.sensors_fake.getCalibrationFromMMSettings(memberId, machineId, studioId);
  Vue.set(calibration, startOrEnd, position);
  //console.warn(`set ${startOrEnd} = {position}; calibration(${memberId}, ${machineId}, ${studioId}) = ${JSON.stringify(calibration)}`);
}

/**
 * Connect to the sensors in a studio.
 * This must be done when a current studio is selected, and when something about the sensors changes (e.g., the IP address).
 * Returns a promise. When the promise resolves or rejects, the fit20.sensors.active property has been set.
 * This operation may be called when the sensor is already connected, and in that case must not do anything.
 */
fit20.sensors_fake.connect = function(studio) {
  if (isUndefined(fit20.sensors_fake._state)) {
    fit20.log("* Fake sensor connect init called");
    fit20.sensors_fake._state = {};
    if (isDefined(studio.gatewayIPAddress)) {
      fit20.sensors_fake.active = true;
      return Promise.resolve("M0910: "+studio.gatewayIPAddress);
    } else {
      fit20.sensors_fake.active = false;
      return Promise.reject("M0911");
    }
  } else {
    fit20.log("* Fake sensor connect init not needed");
  }
};

/**
 * Configure an exercise for a member.
 * From this point onwards, until exerciseFinish, the machine is associated with the member.
 * This also opens the data stream from the sensor connected to the machine.
 * Configure may be called for the same exercise multiple times, which should not reset the exercise.
 * When this is called via updateSensorAfterChange, isCalibrated has been reset. Therefore, the stateHandler must always be called.
 *   studioId: The id of the current studio.
 *   machineId: the id of the machine used in the exercise.
 *   member: The current member.
 *   errorHandler: An error handling function, with parameters (level, description, callbackButtons?).
 *   stateHandler: A function that is called when the sensor state changes,
 *     with parameter { isCalibrated? : [boolean, boolean], // two booleans, 0 (start position) and 1 (end position)
 *                      stopSensor? : boolean // if true, the sensor has stopped, and the sensor panel must be removed.
 *                    } (The ? means that this property may be undefined when unchanged.)
 *   dataHandler: A function that is called when new data arrives,
 *     with parameter ({count, actual_position, reference_position, repetition, tracking}).
 *       repetition: 0 = start; >0 = moving, -1 = stationary
 *   resultHandler: A function that is called to show results,
 *     with parameter ({average, tempo, rhythm, range, graphData, reversalTimes}).
 * Returns a promise.
 */
fit20.sensors_fake.configureExercise = function(studioId, machineId, member, errorHandler, stateHandler, dataHandler, resultHandler) {
  if (isUndefined(resultHandler)) {
    debugger;
  }
  var machineName = fit20.store.state.machines[machineId].longName+" ("+machineId+")";
  fit20.log(`* Fake sensor configureExercise, memberId=${member.id} machineId=${machineId} (${machineName})`);
  if (fit20.sensors_fake.getCurrentExercise(member.id).machineId == machineId) {
    fit20.sensors_fake.checkCalibration(studioId, member.id);
    return Promise.resolve("configureExercise: no change in exercise");
  }
  // Check if sensor fails for this member.
  if (fit20.sensors_fake._state[member.id] == fit20.sensors_fake._states.ERROR) {
    return Promise.reject(`Sensor fails for member ${member.fullName}`);
  }
  fit20.sensors_fake._state[member.id] = fit20.sensors_fake._states.CONFIGURED;
  fit20.sensors_fake.currentExercises[member.id] =
    {studioId: studioId, machineId: machineId, stateHandler: stateHandler, resultHandler: resultHandler, measurements: undefined};
  fit20.sensors_fake.checkCalibration(studioId, member.id);
  fit20.sensors_fake.openFakeDataStream(studioId, member.id, machineId, errorHandler, dataHandler, resultHandler);
  // Resolve after a timeout.
  return new Promise(function(resolve) {
    setTimeout(function() {resolve({"status": "success", "message": "exercise exists"})}, 1000)
  });
};

/**
 * Find out if the sensor for this member/machine is calibrated, and call the stateHandler to make it known.
 */
fit20.sensors_fake.checkCalibration = function(studioId, memberId) {
  fit20.log("* Fake sensor isCalibrated");
  var machineId = fit20.sensors_fake.getCurrentExercise(memberId).machineId;
  if (isUndefined(machineId)) {
    return Promise.reject("M0914");
  }
  var stateHandler = fit20.sensors_fake.getCurrentExercise(memberId).stateHandler;
  if (isUndefined(stateHandler)) {
    return Promise.reject("M0915 (no stateHandler)");
  }
  var sensorCalibration = fit20.sensors_fake.getCalibrationFromMMSettings(memberId, machineId, studioId);
  stateHandler({isCalibrated: [sensorCalibration && isDefined(sensorCalibration.start) ,
                               sensorCalibration && isDefined(sensorCalibration.end)]});
  return Promise.resolve({});
};

/**
 * Calibrate for a specific machine and member.
 *   studioId: The id of the current studio.
 *   memberId: The id of the current member
 *   calibratePosition can be 0 (start position) or 1 (end position)
 * Returns a promise.
 */
fit20.sensors_fake.calibrate = function(studioId, memberId, calibratePosition) {
  var action = calibratePosition == 0 ? 'start' : 'end';
  var currentExercise = fit20.sensors_fake.getCurrentExercise(memberId);
  var machineId = currentExercise.machineId;
  var member = fit20.store.state.members[memberId];
  if (isUndefined(machineId)) {
    return Promise.reject("M0914");
  }
  // Store the calibration.
  var position = calibratePosition == 0 ? 0 : 1;
  fit20.sensors_fake.setCalibration(memberId, machineId, studioId, action, position);
  var sensorCalibration = fit20.sensors_fake.getCalibrationFromMMSettings(memberId, machineId, studioId);
  fit20.put('sensorCalibration', Object.assign({machineId: machineId, memberId: memberId}, sensorCalibration));
  fit20.log(`* Fake sensor calibrate ${action} = ${JSON.stringify(sensorCalibration)}`);
  // Setting the state does the actual calibration.
  fit20.sensors_fake._state[memberId] = fit20.sensors_fake._states.CALIBRATED + calibratePosition;
  return fit20.sensors_fake.checkCalibration(studioId, memberId);
};

/**
 * Start the exercise.
 * This will resolve when the sensor is not active for the selected member and machine.
 *   studioId: The id of the current studio.
 *   memberId: The id of current member.
 * Returns a promise.
 */
fit20.sensors_fake.startExercise = function(studioId, memberId) {
  var machineId = fit20.sensors_fake.getCurrentExercise(memberId).machineId;
  if (isUndefined(machineId)) {
    return Promise.resolve("M0914");
  }
  fit20.log(`* Fake sensor startExercise memberId=${memberId} machineId=${machineId}`);
  fit20.sensors_fake._state[memberId] = fit20.sensors_fake._states.STARTED;
  return Promise.resolve({"status": "success"});
};

/**
 * Re-start the exercise. This is NOT USED at the moment.
 * This will resolve when the sensor is not active for the selected member and machine.
 *   studioId: The id of the current studio.
 *   memberId: The id of current member.
 * Returns a promise.
 */
fit20.sensors_fake.restartExercise = function(studioId, memberId) {
  var machineId = fit20.sensors_fake.getCurrentExercise(memberId).machineId;
  if (isUndefined(machineId)) {
    return Promise.resolve("M0914");
  }
  fit20.log("* Fake sensor restartExercise memberId="+memberId);
  fit20.sensors_fake._state[memberId] = fit20.sensors_fake._states.STARTED;
  return Promise.resolve({"status": "success"});
};

/**
 * Put the exercise in the stationary state.
 *   studioId: The id of the current studio.
 *   memberId: The id of current member.
 * Returns a promise.
 */
fit20.sensors_fake.stationaryExercise = function(studioId, memberId) {
  fit20.log("* Fake sensor stationaryExercise memberId="+memberId);
  var machineId = fit20.sensors_fake.getCurrentExercise(memberId).machineId;
  if (isUndefined(machineId)) {
    return Promise.reject("M0914");
  }
  fit20.sensors_fake._state[memberId] = fit20.sensors_fake._states.STATIONARY;
  return Promise.resolve({"status": "success"});
};

/**
 * Stop the exercise. When it is stopped, show the results.
 * This will resolve when the sensor is not active for the selected member and machine.
 *   studioId: The id of the current studio.
 *   memberId: The id of current member.
 * Returns a promise.
 */
fit20.sensors_fake.stopExercise = function(studioId, memberId) {
  var currentExercise = fit20.sensors_fake.getCurrentExercise(memberId);
  var machineId = currentExercise.machineId;
  if (isUndefined(machineId)) {
    fit20.log("* Fake sensor ignore stopExercise memberId="+memberId+" for no machine.");
    return Promise.resolve("M0914"); // Resolve, it is okay to do this to nicely close a possibly running exercise.
  }
  var resultHandler = currentExercise.resultHandler;
  if (isDefined(resultHandler)) {
    //  Do this, because Isensit does it, which made the graph invisible.
    resultHandler({}); // Announce that results are coming, close progress panel.
  }
  var machineName = fit20.store.state.machines[machineId].longName+" ("+machineId+")";
  fit20.log("* Fake sensor stopExercise memberId="+memberId+" machine: "+machineName);
  fit20.sensors_fake._state[memberId] = fit20.sensors_fake._states.STOPPED;
  return Promise.resolve({"status": "success"});
};

/** Not in standard sensor API.
 * Compute the quality scores.
 *   currentExercise: The currentExercise object.
 * Returns {average, tempo, rhythm, range, graphData, reversalTimes}
 */
fit20.sensors_fake.computeQualityScores = function(currentExercise, machine){
  var machineGroupId = machine.longName.endsWith('duction') ? 'mg1' : 'mg0';
  var reversalIndexes = qs.calculateReversalIndexes(currentExercise.measurements);
  var tempoScore = Math.round(qs.calculateTempoScore(machineGroupId, currentExercise.measurements, reversalIndexes));
  var rangeScore = Math.round(qs.calculateRangeScore(machineGroupId, currentExercise.measurements, reversalIndexes));
  var rhythmScore = Math.round(qs.calculateRhythmScore(machineGroupId, currentExercise.measurements, reversalIndexes));
  var totalQualityScore = Math.round(qs.calculateTotalQualityScore({tempo:tempoScore, range: rangeScore, rhythm: rhythmScore}));
  var graphData = qs.graphData(currentExercise.measurements, 0.2);
  var reversalTimes = qs.reversalTimes(currentExercise.measurements, reversalIndexes);
  return {average: totalQualityScore, tempo: tempoScore, rhythm: rhythmScore, range: rangeScore, graphData: graphData, reversalTimes: reversalTimes};
};

/**
 * Finish the exercise.
 * This will resolve when the sensor is not active for the selected member and machine.
 * This will disconnect the machine from the member.
 * It can be called to make sure that there is no active exercise for a member, even if there was not one.
 *   studioId: The id of the current studio.
 *   memberId: The id of current member.
 * Returns a promise.
 */
fit20.sensors_fake.finishExercise = function(studioId, memberId) {
  if (fit20.sensors._timeoutId[memberId]) window.clearTimeout(fit20.sensors._timeoutId[memberId]);
  var machineId = fit20.sensors_fake.getCurrentExercise(memberId).machineId;
  delete fit20.sensors_fake.currentExercises[memberId];
  if (isUndefined(machineId)) {
    fit20.log("* Fake sensor ignore finishExercise memberId="+memberId+" for no machine.");
    return Promise.resolve({"status": "success", "message": "M0914"}); // Resolve, it is okay to do this when there is no running exercise.
  }
  var machineName = fit20.store.state.machines[machineId].longName+" ("+machineId+")";
  fit20.log("* Fake sensor finishExercise memberId="+memberId+" machine: "+machineName);
  fit20.sensors_fake._state[memberId] = undefined;
  return Promise.resolve({"status": "success"});
};

/**
 * Open a data stream listening to the sensor of a specific machine.
 *   studioId: The id of the current studio.
 *   memberId: The id of the current member
 *   machineId: The id of the machine from which data is received.
 *   errorHandler: An error handling function, with parameters (type, description).
 *   dataHandler: A function that is called when new data arrives,
 *     with parameter ({count, actual_position, reference_position, repetition, tracking}).
 *   resultHandler: A function that is called to show results,
 *     with parameter ({average, tempo, rhythm, range}).
 */
fit20.sensors_fake.openFakeDataStream = function(studioId, memberId, machineId, errorHandler, dataHandler, resultHandler) {
  if (fit20.sensors._timeoutId[memberId]) window.clearTimeout(fit20.sensors._timeoutId[memberId]);
  fit20.log(`* Fake sensor openFakeDataStream for memberId=${memberId}, machineId=${machineId}`);
  var currentExercise = fit20.sensors_fake.currentExercises[memberId];
  var machine = fit20.store.state.machines[machineId];
  var ticksPerSecond = 10;
  var tick = 0;
  var startTimeMillis;
  var ease = 1.5;
  var trackingFactor = 1;
  var data = {count: 0, actual_position: -0.12, reference_position: 0.0, repetition: 0, tracking: 0};
  // When the sensor has been calibrated, adjust the position.
  var checkCalibration = function(nextState) {
    if (fit20.sensors_fake._state[memberId] >= fit20.sensors_fake._states.CALIBRATED) {
      if (fit20.sensors_fake._state[memberId] == fit20.sensors_fake._states.CALIBRATED) {
        data.actual_position = 0.0; // start calibration
      } else {
        data.actual_position = 1.0; // end calibration
      }
      fit20.sensors_fake._state[memberId] = nextState;
    }
  };
  // This is done when the data stream is opened.
  var preStart = function() {
    checkCalibration(fit20.sensors_fake._states.CONFIGURED);
    dataHandler(data);
    if (fit20.sensors_fake._state[memberId] == fit20.sensors_fake._states.CONFIGURED) {
      // When the exercise is configured, check again later.
      if (fit20.sensors._timeoutId) {
        window.clearTimeout(fit20.sensors._timeoutId[memberId]);
        fit20.sensors._timeoutId[memberId] = window.setTimeout(preStart, 100);
      } else {
        debugger; // bug
      }
    } else {
      // We are out of the configured state, start the countdown.
      data.count = 3;
      fit20.sensors._timeoutId[memberId] = window.setInterval(countDown, 1000);
      dataHandler(data);
    }
  };
  // Do the countdown, triggered by the interval timer.
  var countDown = function() {
    data.actual_position = data.actual_position / 2 + (Math.random() - 0.5) / 20;
    data.count -= 1;
    dataHandler(data);
    checkCalibration(fit20.sensors_fake._states.STARTED);
    if (data.count == 0) {
      startTimeMillis = Date.now();
      currentExercise.measurements = [];
      fit20.log(`* Fake sensor start exercise at ${startTimeMillis}`);
      window.clearTimeout(fit20.sensors._timeoutId[memberId]);
      // Call nextData every tick.
      fit20.sensors._timeoutId[memberId] = window.setInterval(nextData, 1000 / ticksPerSecond);
    }
  };
  // During the exercise, this is called every tick.
  var nextData = function() {
    ++tick;
    if (isUndefined(fit20.sensors_fake._state[memberId])) {
      window.clearTimeout(fit20.sensors._timeoutId[memberId]);
      fit20.log(`* Fake sensor openFakeDataStream undefined state in nextData, finish exercise`);
      return; // Stop when exercise is finished.
    } else if (fit20.sensors_fake._state[memberId] == fit20.sensors_fake._states.STATIONARY && data.repetition > 0) {
      // Stationary has been pressed.
      window.clearTimeout(fit20.sensors._timeoutId[memberId]);
      fit20.sensors._timeoutId[memberId] = window.setInterval(stationary, 1000 / ticksPerSecond);
      data.count = 10;
      data.repetition = -1;
      dataHandler(data);
    } else if (fit20.sensors_fake._state[memberId] == fit20.sensors_fake._states.STOPPED) {
      window.clearTimeout(fit20.sensors._timeoutId[memberId]);
      fit20.log(`* Fake sensor openFakeDataStream stopped immediately, showing results`);
      showResults();
    } else {
      // We are doing the exercise.
      checkCalibration(fit20.sensors_fake._states.STARTED);
      var duration = (Date.now() - startTimeMillis) / 1000; // seconds
      var countUp = duration % 20 < 10;
      var halfRepetition = Math.floor(duration / 10) + 1;
      var durHalfRep = countUp ? duration % 10 : 20 - (duration % 20);
      // Reference position in [0.0 .. 1.0]
      if (durHalfRep < ease) {
        data.reference_position = (0.5 * durHalfRep*durHalfRep) / ((10 - ease) * ease);
      } else if (durHalfRep <= 10 - ease) {
        data.reference_position = ease * (durHalfRep - 0.5*ease) / ((10 - ease) * ease);
      } else {
        data.reference_position = (ease * (10 - ease) - 0.5 * (10 - durHalfRep) * (10 - durHalfRep)) / ((10 - ease) * ease);
      }
      // The count is 10 between 10 and 11 seconds, between 20 and 21 seconds, etcetera.
      data.count = duration < 1 ? 0 : Math.floor((duration - 1) % 10) + 1;
      // Actual position increment is random, up or down, *2 to average 1, scaled to ticks per second, goes from 0 to 1 in 10 seconds.
      var tremble = Math.abs(data.reference_position - 0.5) / 5; // largest around turning points
      data.actual_position += (Math.random() * (1 + 2*tremble) - tremble) * (countUp ? 1 : -1) * 2 / ticksPerSecond / 10;
      var delta = data.actual_position - data.reference_position;
      data.tracking = delta * trackingFactor;
      data.repetition = Math.floor(duration / 20) + 1;
      dataHandler(data);
      currentExercise.measurements.push({time: duration, hr: halfRepetition, ref: data.reference_position, act: data.actual_position});
    }
  };
  // During stationary, this is called every tick.
  var stationary = function() {
    ++tick;
    if (isUndefined(fit20.sensors_fake._state[memberId])) {
      window.clearTimeout(fit20.sensors._timeoutId[memberId]);
      fit20.log(`* Fake sensor openFakeDataStream undefined state in stationary, finish exercise`);
      return; // Stop when exercise is finished.
    } else if (fit20.sensors_fake._state[memberId] == fit20.sensors_fake._states.STOPPED) {
      window.clearTimeout(fit20.sensors._timeoutId[memberId]);
      showResults();
    }
    checkCalibration(fit20.sensors_fake._states.STATIONARY);
    if (tick % ticksPerSecond == 0 && data.count > 0) {
      data.count -= 1;
      data.actual_position = data.actual_position + (Math.random() - 0.5) / 12;
      var delta = data.actual_position - data.reference_position;
      data.tracking = delta * trackingFactor;
      data.repetition = -1;
      dataHandler(data);
    }
  };
  // When stopped, show results.
  var showResults = function() {
    var results = fit20.sensors.computeQualityScores(currentExercise, machine);
    fit20.log(`* Fake sensor openFakeDataStream show results (${isDefined(results)} ${isDefined(resultHandler)}).`);
    resultHandler(results);
  };
  // Begin with preStart();
  preStart();
};


/**
 * Vue component for a modal, used to connect to sensors from the trainers app.
 */
fit20.sensors_fake.sensorconnect = {
  template: `
    <div class="modal fade">
      <div class="modal-dialog modal-md" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Sensor-simulator</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div><!-- modal-header -->
          <div class="modal-body">
            {{ $t('M0910') }}
          </div><!-- modal-body -->
          <div class="modal-footer">
          </div>
        </div><!-- modal-content -->
      </div>
    </div>
  `,
  props: ['studio'],
  methods: {}
}
