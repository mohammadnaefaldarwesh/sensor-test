/**
 * Core - Riseapps sensor interface.
 */

fit20.sensors_core_riseapps = {
  active: undefined, // True if sensors work, or 1 when they all work, -1 when some have a problem. False or 0 if sensors don't work.
  leadInSeconds: -3,
  trackingFactor: 1,
  easingFactor: 1.5, // Bram says: 1.5
  lowBrightness: 0.05,
  highBrightness: 0.7,
  /* The currently registered exercises that use sensors.
   * This is a map from memberId to {machineId, socket, errorHandler, stateHandler, dataHandler, resultHandler};
   * There may be one or two members.
   */
  currentExercises: {},
  getCurrentExercise: function(memberId){
    return fit20.sensors_core_riseapps.currentExercises[memberId] ||
      { machineId: undefined, socket: undefined, startTime: undefined, measurements: undefined,
        errorHandler: undefined, stateHandler: undefined, dataHandler: undefined, resultHandler: undefined
      };
  },
  // Data specific for Core-RiseApps sensors.
  httpPort: '1064',
  wsPort: '1064',
  connection: {}, // machineId => {state, message}; initialized in reset(); State: -1 = failed, 0 = unknown; 1 = connecting; 2 = connected.
  _LOCALHOST: location.host.startsWith('localhost') || location.host.startsWith('192.168')
}; // fit20.sensors_core_riseapps

/* Set ourselves as the sensor interface. */
fit20.sensors = fit20.sensors_core_riseapps;

/** Not in standard sensor API.
 * Calls a sensor service.
 *   path: The URL path.
 *   machineId: The machine id that identifies the machine screen server.
 *   memberId: The member id for the exercise. Only used in logging.
 *   settings: Additional settings for $.ajax(), e.g., method and data (parameters).
 *     Default method is GET when settings.data is a string or undefined, POST if data is an object.
 *     We also define additional settings:
 *       _sensorAddress: Use this IP address instead of the configured one.
 *       _acceptErrors: Don't alert when an error occurs if true.
 * Returns a ES6 promise.
 */
fit20.sensors_core_riseapps._call = function(path, machineId, memberId, settings) {
  // Merge settings with default settings, adjust data.
  // Note that the type of settings.data determines the request method.
  settings = settings || {};
  settings.data = settings.data || '';
  // The sensor IP address may be overridden.
  var sensorAddress = settings._sensorAddress || fit20.sensors_core_riseapps.getIPAddress(machineId);
  if (isUndefined(sensorAddress)) {
    fit20.log(`!! Core-RiseApps no IP address for sensor for machineId=${machineId}`);
    return Promise.reject("M0911");
  }
  // The type of settings.data determines the request method.
  var requestMethod = settings.method || settings.type || (typeof settings.data == 'string' ? "GET" : "POST");
  settings = $.extend({
    contentType: false,
    type: requestMethod, method: requestMethod,
    timeout: 5000,
    _acceptErrors: false
  }, settings);
  if (typeof settings.data == 'object') settings.data = JSON.stringify(settings.data);
  // URL of the service.
  var url = 'http://'+sensorAddress + ':' + fit20.sensors_core_riseapps.httpPort + ( path.startsWith('/') ? path : '/'+path );
  // Create a promise for the AJAX request.
  return new Promise(function(resolve, reject) {
    // Define success and failure functions.
    var onSuccess = function(result) {
      fit20.log(`< Core-RiseApps ${result.message || result.status || JSON.stringify(result)} on ${path} for memberId=${memberId}, machineId=${machineId}`);
      resolve(result);
    }; // onSuccess
    var onFailure = function(message, lenient) {
      if (lenient || settings._acceptErrors) {
        fit20.log("! Core-RiseApps ignore '"+message+"' on "+url+" ; "+JSON.stringify(settings.data));
        resolve(message);
      } else {
        fit20.log("!! Core-RiseApps reject '"+message+"' on "+url+" ; "+JSON.stringify(settings.data));
        reject(message);
      }
    }; // onfailure
    // First attempt to call service.
    fit20.log(`> Core-RiseApps ${url} for memberId=${memberId}, machineId=${machineId}`);
    $.ajax(url, settings).then(
      function(result, status, jqXHR) {
        onSuccess(result);
      },
      function(jqXHR, status, error) {
        // Second attempt to call service.
        fit20.log(`! Core-RiseApps retrying ${path} after ${status}: ${stringify(error)}; ${jqXHR.responseText}`);
        $.ajax(url, settings).then(
          function(result, status, jqXHR) {
            onSuccess(result);
          },
          function(jqXHR, status, error) {
            var message = `${status}: ${stringify(error)}; ${jqXHR.responseText}`;
            onFailure(message);
          }
        ); // then 2
      } // fail function
    ); // then 1
  }); // new Promise
}; // _call

/** Not in standard sensor API.
 * Get the IP address of the sensor-server for the specified machine id.
 */
fit20.sensors_core_riseapps.getIPAddress = function(machineId) {
  return fit20.store.state.studioMachineSettings[machineId].sensorAddress;
}

/** Not in standard sensor API.
 * Get the calibration from the member-machine settings.
 * Returns {studioId, start, end} or {studioId} if no calibration has been set.
 */
fit20.sensors_core_riseapps.getCalibrationFromMMSettings = function(memberId, machineId, studioId) {
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
fit20.sensors_core_riseapps.setCalibration = function(memberId, machineId, studioId, startOrEnd, position) {
  var calibration = fit20.sensors_core_riseapps.getCalibrationFromMMSettings(memberId, machineId, studioId);
  Vue.set(calibration, startOrEnd, position);
  //console.warn(`set ${startOrEnd} = {position}; calibration(${memberId}, ${machineId}, ${studioId}) = ${JSON.stringify(calibration)}`);
}

/** Not in standard sensor API.
 * Set the brightness level of the machine screen
 * level : A fractional value between 0.0 and 1.0 (inclusive).
 * Returns a promise that resolves if the brightness could be set to the indicated level.
 */
fit20.sensors_core_riseapps.setBrightness = function(machineId, level) {
  if (!isNaN(parseFloat(level)) && level >= 0.0 && level <= 1.0) {
    var byteLevel = Math.floor(level * 255);
    var brightnessPromise = fit20.sensors_core_riseapps._call('/brightness', machineId, undefined, {
      method: 'POST',
      data: {level: byteLevel}
    });
    return brightnessPromise;
  } else {
    return Promise.reject(`brightness cannot be set to [${level}]`);
  }
};

/**
 * Connect to the sensors in a studio.
 * The studio parameter is part of this API, but it is not used, and may be undefined.
 * This must be done when a current studio is selected, and when something about the sensors changes (e.g., the IP address).
 * Returns a promise. When the promise resolves, the fit20.sensors.active property has been set to communicate the sensor status.
 * For this type of sensor, the resolved promise contains an object: machineId -> IP address for sensors that have been found.
 */
fit20.sensors_core_riseapps.connect = function(studio) {
  fit20.sensors_core_riseapps.active = false;
  fit20.log("* Core-RiseApps sensor init / connect");
  // Initialize connection object
  fit20.sensors_core_riseapps.connection = {};
  var machines = fit20.store.state.studioMachines || [];
  machines.forEach((machine) => {
    Vue.set(this.connection, machine.id, {state: 0, message: ''});
  });
  // Scan for sensors.
  return (
    // First try the configured IP addresses.
    fit20.sensors_core_riseapps._scanConfiguredIpAddresses().
    catch(() => ({})).
    then(machineIdToIPAddress => {
      var nrValidIPAddresses = Object.values(machineIdToIPAddress).filter(ip => !!ip).length;
      fit20.log(`* Core-RiseApps sensor found ${nrValidIPAddresses} valid configured sensors`);
      if (fit20.model.machines.length <= nrValidIPAddresses) {
        return machineIdToIPAddress;
      } else {
        // Scan for 'bonjour' (DNS-SD) IP addresses.
        return fit20.sensors_core_riseapps._scanDNSSD(machineIdToIPAddress);
      }
    }).
    then(machineIdToIPAddress => {
      // machineIdToIPAddress is an object: machineId -> IP address.
      var nrValidIPAddresses = Object.values(machineIdToIPAddress).filter(ip => !!ip).length;
      fit20.log(`* Core-RiseApps sensor found ${nrValidIPAddresses} valid sensors`);
      // There are sensors, return 1 if they all work, -1 if some have problems.
      fit20.sensors_core_riseapps.active = (fit20.model.machines.length <= nrValidIPAddresses) ? 1 : -1;
      // Set valid IP addresses in fit20.store.state.studioMachineSettings.
      for (machineId in machineIdToIPAddress) {
        var ipAddress = machineIdToIPAddress[machineId];
        if (ipAddress) {
          if (isUndefined(fit20.store.state.studioMachineSettings[machineId])) {
            fit20.store.state.studioMachineSettings[machineId] = {};
          }
          Vue.set(fit20.store.state.studioMachineSettings[machineId], 'sensorAddress', ipAddress);
        }
      }
      // This is what will be returned when sensors have been found.
      return machineIdToIPAddress;
    })
  ); // return
};

/** Not in standard sensor API.
 * Scan configured IP addresses.
 * This will set the address in fit20.store.state.studioMachineSettings[machineId] (in _connectTo).
 * Returns a promise for an object: machineId -> IP address.
 */
fit20.sensors_core_riseapps._scanConfiguredIpAddresses = function() {
  fit20.log("* Core-RiseApps _scanConfiguredIpAddresses");
  var validMachineIPAddresses = {};
  // We must have studio machine settings.
  if (!fit20.store.state.studioMachineSettings) {
    fit20.log('!! Core-RiseApps sensor has no studioMachineSettings');
    return Promise.reject();
  }
  var machines = fit20.store.state.studioMachines || [];
  // Requests is a list of ajax requests, which are promises.
  var requests = machines.
    filter(machine => fit20.store.state.studioMachineSettings[machine.id] && fit20.store.state.studioMachineSettings[machine.id].sensorAddress).
    map(machine => {
      var oldIP = fit20.sensors_core_riseapps.getIPAddress(machine.id);
      return (
        fit20.sensors_core_riseapps._connectTo(machine, oldIP).
        then(ipAddress => {
          validMachineIPAddresses[machine.id] = oldIP;
        }).catch(() => {
          // Promise.all rejects immediately upon any of the input promises rejecting.
        })
      ); // return
    }); // requests
  return Promise.all(requests).then(() => validMachineIPAddresses);
};

/** Connect to a machine screen server, preferably by GET and POST /identify the machine.
 * However, because of old tablet software that does not support /identify, do not use GET /identify, but POST /brightness instead.
 * This will set the address in fit20.store.state.studioMachineSettings[machineId] if the sensor is found.
 * Returns a promise containing the validated IP address, or rejects.
 */
fit20.sensors_core_riseapps._connectTo = function(machine, sensorAddress) {
  fit20.log(`* Core-RiseApps _connectTo ${machine.name} @ ${sensorAddress}`);
  Vue.set(fit20.sensors_core_riseapps.connection, machine.id, {state: 0, message: ''});
  if (isUndefined(sensorAddress)) {
    Vue.set(fit20.sensors_core_riseapps.connection, machine.id, {state: -1, message: $t('M0911')});
    return Promise.reject();
  } else {
    Vue.set(fit20.sensors_core_riseapps.connection, machine.id, {state: 1, message: ''});
    return (
      // Use POST /brightness to see if a sensor is present, because GET /identify is not available on old member screen software.
      fit20.sensors_core_riseapps._call('/brightness', machine.id, undefined, {
        method: 'POST',
        _sensorAddress: sensorAddress,
        data: {level: Math.floor(fit20.sensors_core_riseapps.highBrightness * 255)}
      }).
      then(result => {
        return (
          fit20.sensors_core_riseapps._call('/brightness', machine.id, undefined, {
            method: 'POST',
            _sensorAddress: sensorAddress,
            data: {level: Math.floor(fit20.sensors_core_riseapps.lowBrightness * 255)}
          })
        );
      }).
      then(result => {
        return (
          // Do not pass machineTag, because it will crash the old member screen software.
          fit20.sensors_core_riseapps._call('/identify', machine.id, undefined, {
            _sensorAddress: sensorAddress,
            data: {machineId: machine.id, machineName: machine.name}
          }).
          then(function(result){
            if (isUndefined(fit20.store.state.studioMachineSettings[machine.id])) {
              fit20.store.state.studioMachineSettings[machine.id] = {};
            }
            Vue.set(fit20.sensors_core_riseapps.connection, machine.id, {state: 2, message: $t('M0910')});
            Vue.set(fit20.store.state.studioMachineSettings[machine.id], 'sensorAddress', sensorAddress);
            return sensorAddress;
          }).
          catch(function(message){
            Vue.set(fit20.sensors_core_riseapps.connection, machine.id, {state: -1, message: $t('M0915')});
            return Promise.reject();
          })
        );
      }).
      catch(message => {
        Vue.set(fit20.sensors_core_riseapps.connection, machine.id, {state: -1, message: $t('M0912')});
        return Promise.reject();
      })
    );
  }
}


/** Not in standard sensor API.
 * Scan for Android tablets that have registered with DNS-SD.
 *   validMachineIPAddresses: machineId -> IP address; IP addresses for machines already known.
 * This will set the address in fit20.store.state.studioMachineSettings[machineId] if the sensor is found.
 * Returns a promise for the augmented (via DNS-SD/identify) validMachineIPAddresses object: machineId -> IP address.
 */
fit20.sensors_core_riseapps._scanDNSSD = function(validMachineIPAddresses) {
  fit20.log("* Core-RiseApps _scanDNSSD");
  var androidLocalAddresses = ['Android.local'].concat([1,2,3,4,5,6,7,8,9].map(n => `Android-${n}.local`));
  // Requests is a list of ajax requests, which are promises.
  var requests = androidLocalAddresses.
    map(host => {
      return (
        $.ajax(`http://${host}:${fit20.sensors_core_riseapps.httpPort}/identify`, {
          cache: false,
          dataType: 'json',
          timeout: 20000
        }).then(result => {
          // There may be more than one machine connected to a sensor (ad/abduction).
          fit20.model.matchingMachines(fit20.store.state.studioMachines, result.machineTag, result.machineName).
          forEach(machine => {
            fit20.log(`* Core-RiseApps ${machine.name} (${machine.id}) sensor found at DNS-SD ${host} -> ${result.IPAddress}`);
            validMachineIPAddresses[machine.id] = result.IPAddress;
            if (isUndefined(fit20.store.state.studioMachineSettings[machine.id])) {
              fit20.store.state.studioMachineSettings[machine.id] = {};
            }
            Vue.set(fit20.sensors_core_riseapps.connection, machine.id, {state: 2, message: $t('M0910')});
            Vue.set(fit20.store.state.studioMachineSettings[machine.id], 'sensorAddress', result.IPAddress);
          });
        }).catch(() => {
          // Promise.all rejects immediately upon any of the input promises rejecting.
        })
      )
    }); // requests
  return Promise.all(requests).then(() => validMachineIPAddresses);
};

/** Not in standard sensor API.
 * Compute the data for a configure request.
 */
fit20.sensors_core_riseapps._configureData = function (member, machineId, studioId) {
  var calibration = fit20.sensors_core_riseapps.getCalibrationFromMMSettings(member.id, machineId, studioId);
  calibration = onlyDefined(calibration);
  delete calibration.studioId; // Must do this on a copy.
  return {
    member: {id: member.id, name: member.fullName},
    trackingFactor: fit20.sensors_core_riseapps.trackingFactor,
    easingFactor: fit20.sensors_core_riseapps.easingFactor,
    calibration: calibration
  };
};

/** Not in standard sensor API.
 * Finish the exercise for the given machineId.
 * If the exercise is not active, finishExercise will just resolve.
 * In a duo-training, the duo-partner may be using the machine, so we need to search through currentExercises.
 * Returns a promise.
 */
fit20.sensors_core_riseapps._closeExerciseUsingMachine = function(studioId, machineId, memberId) {
  var exerciseUsingThisMachine =
    Object.entries(fit20.sensors_core_riseapps.currentExercises).
      find(function(entry){return entry[1].machineId == machineId});
  if (exerciseUsingThisMachine) {
    var memberIdUsingThisMachine = exerciseUsingThisMachine[0];
    var currentExercise = exerciseUsingThisMachine[1];
    fit20.log(`* Core-Riseapps sensor will close machineId=${machineId} for memberId=${memberIdUsingThisMachine} by memberId=${memberId}`);
    if (currentExercise && currentExercise.stateHandler) {
      // Close the sensor panel.
      currentExercise.stateHandler({stopSensor: true});
    }
    return fit20.sensors_core_riseapps.finishExercise(studioId, memberIdUsingThisMachine);
  } else {
    return Promise.resolve();
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
 *   errorHandler: An error handling function, with parameters (type, description).
 *   stateHandler: A function that is called when the sensor state changes,
 *     with parameter { isCalibrated? : [boolean, boolean] // two booleans, [0] (start position) and [1] (end position)
 *                    } (The ? means that this property may be undefined when unchanged.)
 *   dataHandler: A function that is called when new data arrives,
 *     with parameter ({count, actual_position, reference_position, repetition, tracking}).
 *       repetition: 0 = start; >0 = moving, -1 = stationary
 *   resultHandler: A function that is called to show results,
 *     with parameter ({average, tempo, rhythm, range, graphData}).
 * Returns a promise.
 */
fit20.sensors_core_riseapps.configureExercise = function(studioId, machineId, member, errorHandler, stateHandler, dataHandler, resultHandler, options) {
  var machineName = fit20.store.state.machines[machineId].longName+" ("+machineId+")";
  var memberName = `${member.fullName} (${member.id})`;
  var memberId = member.id;
  fit20.log(`* Core-RiseApps sensor configureExercise for member ${memberName}, machine ${machineName}`);
  // If the previous exercise was finished, current exercise is undefined so you can re-select the previous exercise.
  // But on localhost, the machine is always the same, so finish it anyway.
  if (fit20.sensors_core_riseapps.getCurrentExercise(memberId).machineId == machineId) {
    fit20.sensors_core_riseapps.checkCalibration(studioId, memberId);
    return Promise.resolve("configureExercise: no change in exercise");
  }
  var promise =
    fit20.sensors_core_riseapps._closeExerciseUsingMachine(studioId, machineId, memberId).
    then(function(result) {
      // Get the member's calibration.
      var sensorCalibration = fit20.sensors_core_riseapps.getCalibrationFromMMSettings(memberId, machineId, studioId);
      if (isUndefined(sensorCalibration)) debugger; // This cannot happen.
      fit20.sensors_core_riseapps.currentExercises[memberId] = {
        machineId: machineId, sensorCalibration: sensorCalibration, startTime: undefined, measurements: undefined,
        errorHandler: errorHandler, stateHandler: stateHandler, dataHandler: dataHandler, resultHandler: resultHandler
      };
      return fit20.sensors_core_riseapps.checkCalibration(studioId, memberId);
    }).
    then(function(result) {
      return fit20.sensors_core_riseapps._call('/configure', machineId, memberId, {
        method: 'POST',
        data: Object.assign({colorScheme: options.colorScheme},
                            fit20.sensors_core_riseapps._configureData(member, machineId, studioId))
      });
    }).
    then(function(result) {
      fit20.log(`* Core-RiseApps GW ready configureExercise, member: ${memberName} machine: ${machineName}`);
      fit20.sensors_core_riseapps.setBrightness(machineId, fit20.sensors_core_riseapps.highBrightness);
      // Do not include the websocket connection in the promise.
      fit20.sensors_core_riseapps.openDataStream(member, studioId, machineId, stateHandler, dataHandler, resultHandler);
      return result;
    }).catch(function(error){
      fit20.log(`* Core-RiseApps sensor FAILED configureExercise for member ${member.fullName} (${memberId}) and machine ${machineName}`);
      fit20.sensors_core_riseapps.setBrightness(machineId, fit20.sensors_core_riseapps.lowBrightness);
      return Promise.reject(error);
    });
  return promise;
};

/**
 * Find out if the sensor for this member/machine is calibrated, and call the stateHandler to make it known.
 * Returns a promise.
 */
fit20.sensors_core_riseapps.checkCalibration = function(studioId, memberId) {
  fit20.log("* Core-RiseApps sensor checkCalibration");
  var currentExercise = fit20.sensors_core_riseapps.getCurrentExercise(memberId);
  var machineId = currentExercise.machineId;
  if (isUndefined(machineId)) {
    return Promise.reject("M0914");
  }
  var stateHandler = currentExercise.stateHandler;
  if (isUndefined(stateHandler)) {
    return Promise.reject("checkCalibration: M0915 (no stateHandler)");
  }
  var sensorCalibration = fit20.sensors_core_riseapps.getCalibrationFromMMSettings(memberId, machineId, studioId);
  var hasActualCalibrationRange = sensorCalibration.start != sensorCalibration.end
  stateHandler({isCalibrated: [sensorCalibration && hasActualCalibrationRange && isDefined(sensorCalibration.start) ,
                               sensorCalibration && hasActualCalibrationRange && isDefined(sensorCalibration.end)]});
  // Check if the sensor reading is in the safe range.
  // The resulting promise is the return value of checkCalibration.
  var checkCalibrationPromise = fit20.sensors_core_riseapps._call('/position', machineId, memberId, {
    method: 'GET',
    dataType: 'json'
  }).then(function(result){
    var sensorReading = Number.parseInt(result.sensor_reading) || 0;
    if (sensorReading > 28000 || sensorReading < -28000) {
      fit20.app.addAlert('warning', $t('M0923'));
    }
    return {};
  });
  return checkCalibrationPromise;
};

/**
 * Calibrate for a specific machine and member.
 *   studioId: The id of the current studio.
 *   memberId: The id of the current member
 *   calibratePosition can be 0 (start position) or 1 (end position)
 * Returns a promise.
 */
fit20.sensors_core_riseapps.calibrate = function(studioId, memberId, calibratePosition) {
  var action = calibratePosition == 0 ? 'start' : 'end';
  var currentExercise = fit20.sensors_core_riseapps.getCurrentExercise(memberId);
  var machineId = currentExercise.machineId;
  var member = fit20.store.state.members[memberId];
  var sensorCalibration = fit20.sensors_core_riseapps.getCalibrationFromMMSettings(memberId, machineId, studioId);
  fit20.log(`* Core-RiseApps sensor calibrate ${action}; old = ${JSON.stringify(sensorCalibration)}`);
  if (isUndefined(machineId)) {
    return Promise.reject("M0914");
  }
  var calibratePromise = fit20.sensors_core_riseapps._call('/position', machineId, memberId, {
    method: 'GET',
    dataType: 'json'
  }).then(function(result){
    var position = Number.parseInt(result.position);
    fit20.log(`* Core-RiseApps sensor calibrate ${action} = ${position}`);
    fit20.sensors_core_riseapps.setCalibration(memberId, machineId, studioId, action, position);
    var configData = fit20.sensors_core_riseapps._configureData(member, machineId, studioId);
    if (Math.abs(configData.calibration.start - configData.calibration.end) < 2) {
      fit20.app.addAlert('warning', $t('M0922')+` (${configData.calibration.start} - ${configData.calibration.end})`);
    }
    return fit20.sensors_core_riseapps._call('/configure', machineId, memberId, {
      method: 'POST',
      data: configData
    });
  }).then(function(result){
    fit20.log(`* Core-RiseApps sensor store calibration ${JSON.stringify(sensorCalibration)}`);
    return fit20.put('sensorCalibration',
                     Object.assign({machineId: machineId, memberId: memberId}, sensorCalibration),
                     undefined, undefined, true); // (key, value, callback, subkey, noBlock)
  }).then(function(result){
    currentExercise.dataHandler({count: 0}); // Needed to show the panel after updateSensorAfterChange().
    currentExercise.stateHandler({isCalibrated: [sensorCalibration && isDefined(sensorCalibration.start) ,
                                                 sensorCalibration && isDefined(sensorCalibration.end)]});
    return result;
  });
  return calibratePromise;
};

/**
 * Start the exercise.
 * This will resolve when the sensor is not active for the selected member and machine.
 *   studioId: The id of the current studio.
 *   memberId: The id of current member.
 * Returns a promise.
 */
fit20.sensors_core_riseapps.startExercise = function(studioId, memberId) {
  var currentExercise = fit20.sensors_core_riseapps.getCurrentExercise(memberId);
  var machineId = currentExercise.machineId;
  if (isUndefined(machineId)) {
    return Promise.resolve("startExercise: M0914");
  }
  var memberName = fit20.store.state.members[memberId].fullName+" ("+memberId+")";
  var machineName = fit20.store.state.machines[machineId].longName+" ("+machineId+")";
  fit20.log(`* Core-RiseApps sensor startExercise for ${memberName}, ${machineName}`);
  return fit20.sensors_core_riseapps._call('/exercise/start', machineId, memberId, {
    method: 'GET'
  });
};

/**
 * Re-start the exercise. This is NOT USED at the moment.
 * This will resolve when the sensor is not active for the selected member and machine.
 *   studioId: The id of the current studio.
 *   memberId: The id of current member.
 * Returns a promise.
 */
fit20.sensors_core_riseapps.restartExercise = function(studioId, memberId) {
  return fit20.sensors_core_riseapps.startExercise(studioId, memberId);
};

/**
 * Put the exercise in the stationary state.
 *   studioId: The id of the current studio.
 *   memberId: The id of current member.
 * Returns a promise.
 */
fit20.sensors_core_riseapps.stationaryExercise = function(studioId, memberId) {
  var machineId = fit20.sensors_core_riseapps.getCurrentExercise(memberId).machineId;
  if (isUndefined(machineId)) {
    return Promise.reject("M0914");
  }
  var memberName = fit20.store.state.members[memberId].fullName+" ("+memberId+")";
  var machineName = fit20.store.state.machines[machineId].longName+" ("+machineId+")";
  fit20.log(`* Core-RiseApps sensor stationaryExercise for ${memberName}, ${machineName}`);
  return fit20.sensors_core_riseapps._call('/exercise/stationary', machineId, memberId, {
    method: 'GET'
  });
};

/**
 * Stop the exercise. When it is stopped, show the results.
 * This will resolve when the sensor is not active for the selected member and machine.
 *   studioId: The id of the current studio.
 *   memberId: The id of current member.
 * Returns a promise.
 */
fit20.sensors_core_riseapps.stopExercise = function(studioId, memberId) {
  var currentExercise = fit20.sensors_core_riseapps.getCurrentExercise(memberId);
  var machineId = currentExercise.machineId;
  if (isUndefined(machineId)) {
    return Promise.resolve("M0914"); // Resolve, it is okay to do this to nicely close a possibly running exercise.
  }
  var memberName = fit20.store.state.members[memberId].fullName+" ("+memberId+")";
  var machine = fit20.store.state.machines[machineId];
  var machineName = machine.longName+" ("+machineId+")";
  fit20.log(`* Core-RiseApps sensor stopExercise for ${memberName}, ${machineName}`);
  var stopExercisePromise = fit20.sensors_core_riseapps._call('/exercise/stop', machineId, memberId, {
    method: 'GET'
  }).
  catch(function(error){
    // Report the error, but ignore it.
    fit20.log("! Core-RiseApps sensor exercise stop memberId="+memberId+" machine: "+machineName+" error: "+stringify(error));
    return error;
  }). // catch (exercise stop)
  then(function(data){
    fit20.sensors_core_riseapps.closeSocket(memberId);
    // Compute and show QS.
    var results = fit20.sensors_core_riseapps.computeQualityScores(currentExercise, machine);
    var resultHandler = currentExercise.resultHandler;
    if (isUndefined(resultHandler)) {
      debugger; // This can not happen.
      return Promise.reject("M0915 (no resultHandler)");
    }
    resultHandler(results);
    var apiResults = {
        total: results.average, range: results.range, rhythm: results.rhythm, tempo: results.tempo
    };
    return fit20.sensors_core_riseapps._call('/exercise/stop', machineId, memberId, {
      method: 'POST',
      data: apiResults
    });
  }).
  catch(function(result){
    fit20.log(`!! Core-RiseApps sensor error in exercise stop memberId=${memberId}: ${JSON.stringify(result)}`);
    return fit20.sensors_core_riseapps._call('/exercise/finish', machineId, memberId, {
      method: 'GET',
      _acceptErrors: true
    })
  });
  return stopExercisePromise;
};

/** Not in standard sensor API.
 * Compute the quality scores.
 *   currentExercise: The currentExercise object.
 * Returns {average, tempo, rhythm, range, graphData} (all 0..100)
 */
fit20.sensors_core_riseapps.computeQualityScores = function(currentExercise, machine){
  try {
    var machineGroupId = machine.longName.endsWith('duction') ? 'mg1' : 'mg0';
    var reversalIndexes = qs.calculateReversalIndexes(currentExercise.measurements);
    var tempoScore = Math.round(qs.calculateTempoScore(machineGroupId, currentExercise.measurements, reversalIndexes));
    var rangeScore = Math.round(qs.calculateRangeScore(machineGroupId, currentExercise.measurements, reversalIndexes));
    var rhythmScore = Math.round(qs.calculateRhythmScore(machineGroupId, currentExercise.measurements, reversalIndexes));
    var totalQualityScore = Math.round(qs.calculateTotalQualityScore({tempo:tempoScore, range: rangeScore, rhythm: rhythmScore}));
    var graphData = qs.graphData(currentExercise.measurements, 0.2);
    var reversalTimes = qs.reversalTimes(currentExercise.measurements, reversalIndexes);
    return {average: totalQualityScore, tempo: tempoScore, rhythm: rhythmScore, range: rangeScore, graphData: graphData, reversalTimes: reversalTimes};
  } catch (ex) {
    fit20.log(`!! Error in computeQualityScores: ${ex}`);
    debugger; // Hoping to catch this.
    return {};
  }
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
fit20.sensors_core_riseapps.finishExercise = function(studioId, memberId) {
  var currentExercise = fit20.sensors_core_riseapps.getCurrentExercise(memberId);
  var machineId = currentExercise ? currentExercise.machineId : undefined;
  fit20.sensors_core_riseapps.closeSocket(memberId);
  delete fit20.sensors_core_riseapps.currentExercises[memberId];
  if (isUndefined(machineId)) {
    return Promise.resolve({"status": "success", "message": "M0914"}); // Resolve, it is okay to do this when there is no running exercise.
  }
  var memberName = fit20.store.state.members[memberId].fullName+" ("+memberId+")";
  var machineName = fit20.store.state.machines[machineId].longName+" ("+machineId+")";
  fit20.log(`* Core-RiseApps sensor finishExercise for ${memberName}, ${machineName}`);
  var finishExercisePromise = fit20.sensors_core_riseapps._call('/exercise/finish', machineId, memberId, {
    method: 'GET',
    _acceptErrors: true
  }).catch(function(error){
    // Accept that finish is not always possible.
    return error;
  }).then(function(){
    return fit20.sensors_core_riseapps.setBrightness(machineId, fit20.sensors_core_riseapps.lowBrightness);
  });
  return finishExercisePromise;
};

/**
 * Close the socket for the current exercise.
 */
fit20.sensors_core_riseapps.closeSocket = function(memberId) {
  var currentExercise = fit20.sensors_core_riseapps.getCurrentExercise(memberId);
  if (currentExercise.socket) {
    fit20.log("* Core-RiseApps sensor socket closing.");
    currentExercise.socket.close();
  }
}

/**
 * Open a data stream listening to the sensor of a specific machine.
 *   member: The current member
 *   studioId: The id of the current studio.
 *   machineId: The id of the machine from which data is received.
 *   stateHandler: The stateHandler, used to force-stop the exercise.
 *   dataHandler: A function that is called when new data arrives,
 *     with parameter ({count, actual_position, reference_position, repetition, tracking}).
 *   resultHandler: A function that is called to show results,
 *     with parameter ({average, tempo, rhythm, range}).
 * Returns a promise that resolves when the connection has been established, or rejects when no connection can be made.
 */
fit20.sensors_core_riseapps.openDataStream = function(member, studioId, machineId, stateHandler, dataHandler, resultHandler) {
  var openDataStreamPromise = new Promise(function(resolve, reject) {
    var memberId = member.id;
    var socketName = `machineId=${machineId} memberId=${memberId}`;
    fit20.log(`* Core-RiseApps sensor openDataStream ${socketName}`);
    var currentExercise = fit20.sensors_core_riseapps.getCurrentExercise(memberId);
    var sensorAddress = fit20.sensors_core_riseapps.getIPAddress(machineId);
    var socketURL = `ws://${sensorAddress}:${fit20.sensors_core_riseapps.wsPort}/exercise/data`;
    var socketReadyStates = ['connecting', 'open', 'closing', 'closed'];
    currentExercise.measurements = [];
    currentExercise.startTime = undefined;
    var durationSec = 0.0;
    var nrMessages = 0;
    var previousMessageTime = undefined;
    var messageDelayMs; // time between this message and the previous
    var longestMessageDelayMs = 0;
    try {
      var socket = new WebSocket(socketURL, 'websocket');
      currentExercise.socket = socket;
      socket.onopen = function (event) {
        fit20.log(`< Core-RiseApps socket open ${socketName} [${socketReadyStates[socket.readyState]}]`);
        resolve(`connected ${socketName}`);
      };
      socket.onerror = function(event) {
        fit20.log(`!! Core-RiseApps socket error ${socketName} [${socketReadyStates[socket.readyState]}]: ${event.reason}`);
        reject(`error on ${socketName} [${socketReadyStates[socket.readyState]}]: ${event.reason}`);
      };
      socket.onmessage = function(event) {
        var data = JSON.parse(event.data);
        var now = data.time; // more reliable than local clock; no network latency
        // gather statistics
        if (isDefined(previousMessageTime)) {
          messageDelayMs = now - previousMessageTime;
          if (messageDelayMs > longestMessageDelayMs) {longestMessageDelayMs = messageDelayMs;}
        }
        previousMessageTime = now;
        nrMessages += 1;
        // get the data and handle it
        var actual_position = data.actualPosition;
        var reference_position = data.referencePosition;
        var halfRepetition = data.halfRepetition;
        var repetition = (halfRepetition <= 0) ? halfRepetition : Math.ceil(halfRepetition/2);
        var count = data.count;
        //var tracking = (actual_position - reference_position) * fit20.sensors_core_riseapps.trackingFactor; // If trackingFactor == 20, 5% corresponds to +/- 1.0
        var tracking = data.tracking;
        dataHandler({count: count, actual_position: actual_position, reference_position: reference_position, repetition: repetition, tracking: tracking});
        if (!currentExercise.startTime && halfRepetition > 0) {
          // coming out of lead-in phase
          currentExercise.startTime = now;
        }
        if (isDefined(currentExercise.startTime) && halfRepetition > 0) {
          durationSec = (now - currentExercise.startTime) / 1000;
          currentExercise.measurements.push({time: durationSec, hr: halfRepetition, ref: reference_position, act: actual_position});
        }
  /* Lots of logging for debugging.
        if (!(currentExercise.debuglogcount = ((currentExercise.debuglogcount || 0)+1)%10)) {
          console.info('event.data = '+event.data);
          console.info('computed data = '+JSON.stringify({actual_position: actual_position, reference_position: reference_position,
                                       actual_tracking: tracking, reported_tracking: data.tracking}));
        }
   */
      }; // onmessage
      socket.onclose = function(event) {
        if (event.reason != 'Close') debugger;
        fit20.log(`< Core-RiseApps socket closed ${socketName} [${socketReadyStates[socket.readyState]}]; ${event.reason}`);
        // show statistics
        var msgPerSecond = durationSec > 0 ? Math.round(nrMessages/durationSec) : '---';
        fit20.log(`* Core-RiseApps socket: ${nrMessages} messages, ${msgPerSecond} per second; longest delay = ${longestMessageDelayMs} ms.`);
        // Resolve when disconnected.
        resolve(`disconnected ${socketName}`);
      };
    } catch (ex) {
      fit20.log(`!! Core-RiseApps socket ${socketName} exception: ${JSON.stringify(ex)}`);
      debugger;
      reject(ex);
    }
  }); // new Promise
  return openDataStreamPromise;
}; // fit20.sensors_core_riseapps.openDataStream


/**
 * Vue component for a modal, used to connect to sensors from the trainers app.
 */
fit20.sensors_core_riseapps.sensorconnect = {
  template: `
    <div class="modal fade">
      <div class="modal-dialog modal-md" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Sensors</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close" @click="reset">
              <span aria-hidden="true">&times;</span>
            </button>
          </div><!-- modal-header -->
          <div class="modal-body">
            <div class="container-fluid">
              <div class="form-group row p-1 mb-1 bg-light rounded" v-for="machine in machines">
                <label class="col-5 px-1 mb-0" :for="makeId('sensor_IPAddress', machine.id)">
                  {{ machine.name }}
                  <br>
                  <span v-if="connection[machine.id]" :id="makeId('sensor_indicator', machine.id)">
                    <span v-if="connection[machine.id].state == -1" class="badge badge-danger">
                      <i class="fa fa-exclamation-triangle"></i>&#xA0;{{ connection[machine.id].message }}
                    </span>
                    <span v-if="connection[machine.id].state == 0" class="badge badge-gray">
                      <i class="fa fa-question-circle"></i>&#xA0;{{ connection[machine.id].message }}
                    </span>
                    <span v-if="connection[machine.id].state == 1" class="badge badge-warning">
                      <i class="fa fa-rss fa-spin"></i>&#xA0;{{ connection[machine.id].message }}
                    </span>
                    <span v-if="connection[machine.id].state == 2" class="badge badge-success icon icon-sensor" @click="reset">
                      &#xA0;{{ connection[machine.id].message }}
                    </span>
                  </span>
                </label>
                <div class="col-4 px-1">
                  <input type="text" class="form-control" :id="makeId('sensor_IPAddress', machine.id)"
                    :pattern="'ip_address' | inputPattern" title="IP address"
                    v-model="settings[machine.id].sensorAddress">
                </div>
                <div class="col-3 px-1 text-center">
                  <button type="button" class="btn btn-primary" title="connect"
                    @click="connectTo(machine)"
                  >
                    {{ $t('M0083') }}
                  </button>
                </div>
              </div><!-- form-group row -->
            </div><!-- container-fluid -->
          </div><!-- modal-body -->
          <div class="modal-footer">
            <button type="button" class="btn btn-primary mr-auto" title="auto-find sensors"
              v-on:click="findSensorIPAddresses()"
            >
              {{ $t('M0909') }}
            </button>
            <button type="button" class="btn btn-primary" title="OK"
              v-on:click="setSensorIPAddresses()"
              data-dismiss="modal"
            >
              {{ $t('M0028') }}
            </button>
          </div>
        </div><!-- modal-content -->
      </div>
    </div>
  `,
  props: ['studio'],
  data: function() {
    return {
      settings: {} // machineId => {studio, machine, sensorAddress}; initialized in reset()
    }
  }, // data

  computed: {

    // Get a list of all machines from the current studio
    machines: function() {
      // The machines property may be used before settings has been initialized.
      if (isEmpty(this.settings)) {
        this.reset();
      } else {
        this.completeSettings()
      }
      return fit20.store.state.studioMachines || [];
    },

    // Get the studioMachineSettings.
    studioMachineSettings: function() {
      return fit20.store.state.studioMachineSettings;
    },

    // machineId => {state, message}; State: -1 = failed, 0 = unknown; 1 = connecting; 2 = connected.
    connection: function() {
      return fit20.sensors_core_riseapps.connection
    }

  }, // computed

  methods: {

    // Make an id based on a prefix and a machine.
    makeId: function(prefix, machineId) {
      return prefix+'_'+machineId;
    },

    // Reset settings to the studioMachineSettings from the store.
    reset: function() {
      var scope = this;
      // Initialize settings
      this.settings = Object.assign(this.settings, fit20.store.state.studioMachineSettings);
      this.completeSettings();
    },

    // Fill in potentially missing properties.
    completeSettings: function() {
      var scope = this;
      // Make sure that we have one entry per machine in settings.
      var machines = fit20.store.state.studioMachines || [];
      machines.forEach(function(machine) {
        if (isUndefined(scope.settings[machine.id])) {
          scope.settings[machine.id] = {};
        }
        scope.settings[machine.id].studio = scope.studio.id;
        scope.settings[machine.id].machine = machine.id;
      });
    },

    // Connect to a machine screen server.
    connectTo: function(machine) {
      // Get the filled in sensor address.
      var sensorAddress = this.settings[machine.id].sensorAddress;
      fit20.sensors_core_riseapps._connectTo(machine, sensorAddress);
    },

    // Find all / any sensor tablets.
    findSensorIPAddresses: function() {
      var scope = this;
      fit20.sensors_core_riseapps.connect(scope.studio).
        then(machineIdToIPAddress => { // machineIdToIPAddress: machineId -> IP
          //debugger;
        }).
        catch(error => {
          fit20.log(`! Core-RiseApps error searching sensor : ${error.toString()}`);
        });
    },

    // Set and persist the sensor addresses.
    setSensorIPAddresses: function() {
      fit20.put('studioMachineSettings', this.settings);
    }

  }, // methods

  watch: {
    studioMachineSettings: {
      handler: function() {
        this.reset();
      },
      deep: true // trigger when a property in fit20.store.state.studioMachineSettings changes.
    },
    connection: {
      handler: function() {
        this.reset();
      },
      deep: true
    }
  } // watch
}
