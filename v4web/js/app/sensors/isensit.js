/**
 * Isensit sensor interface.
 * Isensit uses a gateway to connect to sensors.
 * The gateway is accessed by its IP-address or by its bonjour address (fit20gwXX.local).
**/

fit20.sensors_isensit = {
  // Data to be monitored by Vue components.
  active: undefined,
  leadInSeconds: -3,
  /* The currently registered exercises that use sensors.
   * This is a map from memberId to the properties given in the default value of getCurrentExercise..
   * There may be one or two members.
   */
  currentExercises: {},
  getCurrentExercise: function(memberId){
    return fit20.sensors_isensit.currentExercises[memberId] ||
           { studioId: undefined, machineId: undefined, calibration: undefined,
             stateHandler: undefined, resultHandler: undefined, errorHandler: undefined,
             socket: undefined};
  },
  // Data specific for Isensit sensors.
  manual_retry: true, // Allow trainer to retry connecting. If true, do not switch off sensors.
  ipAddress: null,
  ipPort: '8001',
  gatewayVersion: '',
  callId: 0, // Every call gets an id.
  _LOCALHOST: (location.host.startsWith('localhost') || location.host.startsWith('192.168'))
};

/* Set ourselves as the sensor interface. */
fit20.sensors = fit20.sensors_isensit;

fit20.sensors_isensit.sendReport = function(memberId, error, message) {
  var location = 'studio ' +
  (fit20.store.state.currentStudio ? fit20.store.state.currentStudio.name + ' ' + fit20.store.state.currentStudio.subName : '(unknown)');
  var currentExercise = fit20.sensors_isensit.getCurrentExercise(memberId) || {};
  var otherInfo = `gateway: ${fit20.sensors_isensit.gatewayVersion || 'unknown version'}. `+
                  `Isensit exercise_id=${currentExercise.exerciseId}. GatewayStatus=${currentExercise.gatewayStatus}.`;
  // Do not send from localhost or Isensit test studio. (690d53531cf16bbb03af2fef6bf6cb9b23ba42d7)
  if (!fit20.sensors_isensit._LOCALHOST && (location.indexOf('Isensit test') < 0)) {
    fit20.log(`! Location ${location} (${location.indexOf('Isensit test')}) sends error report.`);
    fit20.logServer(`${error}\n${$t(message)}`, location, 11, {details: otherInfo});
  }
}

/** Not in standard sensor API.
 * Clear the gateway state.
 * Returns a ES6 promise.
 */
fit20.sensors_isensit.reset = function() {
  fit20.app.showSpinner();
  return $.ajax('http://'+fit20.sensors_isensit.ipAddress+':'+'8001/fit20/v1.0/restart',
         { timeout: 6000, method: 'GET', headers: {'Access-Control-Allow-Origin': '*'} }).
  catch(function(){}).
  then(function() {
      fit20.log('! Isensit GW reset');
      fit20.app.hideSpinner();
  });
}

/** Not in standard sensor API.
 * Update the gateway status in the currentExercise.
 * Returns nothing.
 */
fit20.sensors_isensit.updateStatus = function() {
  $.ajax('http://'+fit20.sensors_isensit.ipAddress+':'+'8001/fit20/v1.0/status',
         { timeout: 6000, method: 'GET', headers: {'Access-Control-Allow-Origin': '*'} }).
  then(function(result){
    for (var memberId in fit20.sensors_isensit.currentExercises) {
      fit20.sensors_isensit.currentExercises[memberId].gatewayStatus = stringify(result.data);
    }
  });
}
/**
 * Calls a Isensit Gateway service.
 *   path: The part of the URL after "/fit20/v1.0/studios/<int:studio_id>/machines/<int:machine_id>/members/"
 *     If path starts with '/', it contains the complete URL, and no studioId, machineId and memberId should be present.
 *   settings: Additional settings for $.ajax(), e.g., method and data (parameters).
 *     Default method is GET when settings.data is a string or undefined, POST if data is an object.
 *     We also define additional settings:
 *       GW_acceptErrors: Don't alert when an error occurs if true.
 *       GW_noRetry: Do not retry the request, even if it is a GET request.
 *       GW_retries: The number of retries.
 *   studioId: Undefined or a studio id.
 *   machineId: Undefined or a machine id.
 *   memberId: Undefined or a member id.
 * Returns a ES6 promise.
 */
fit20.sensors_isensit._callGateway = function(path, settings, studioId, machineId, memberId) {
  // Can't call gateway without IP-address, or when sensor is inactive.
  if (isUndefined(fit20.sensors_isensit.ipAddress)) {
    fit20.log("!! Isensit GW no IP address");
    return Promise.reject("M0911");
  }
  if (!fit20.sensors_isensit.active && isDefined(studioId)) {
    fit20.log("! Isensit GW not active in studio");
    return Promise.reject("M0913");
  }
  // DEBUG for Nico's sensor-gateway. This is also present in openDataStream.
  if (fit20.sensors_isensit._LOCALHOST) {
    if (studioId) studioId = '16001'; // fit20 test NL
    if (machineId) machineId = '3001'; // chest press
  }
  // END DEBUG
  // Merge settings with default settings, adjust data.
  settings = settings || {};
  settings.data = settings.data || '';
  settings = $.extend({
    contentType: (typeof settings.data == 'string' ? "application/x-www-form-urlencoded" : "application/json")+"; charset=UTF-8",
    method: (typeof settings.data == 'string' ? "GET" : "POST"),
    timeout: 6000,
    headers: {'Access-Control-Allow-Origin': '*'},
    GW_acceptErrors: false,
    GW_noRetry: false,
    GW_retries: 0
  }, settings);
  if (typeof settings.data == 'object') settings.data = JSON.stringify(settings.data);
  // URL of the gateway service.
  var url = 'http://'+fit20.sensors_isensit.ipAddress+':'+fit20.sensors_isensit.ipPort+
    ( path.startsWith('/')
    ? path
    : '/fit20/v1.0'+
      ( studioId ? '/studios/'+studioId : '' )+
      ( machineId ? '/machines/'+machineId : '' )+
      ( memberId ? '/members/'+memberId : '' )+
      ( path ? '/'+path : '' )
    );
  // Prepare some info for logging.
  var reqAction = (typeof settings.data == 'object') ? (settings.data.action || '') : (settings.data || '').replace(/^action=|.*/, '');
  var thisCallId = (fit20.sensors_isensit.callId = fit20.sensors_isensit.callId % 999 + 1);
  var urlInfo = `[${thisCallId}] ${settings.method} ${url} / ${stringify(settings.data)} ${reqAction}${fit20.sensors_isensit._LOCALHOST ? ' localhost debugging' : ''}`;
  // Create a promise containing the AJAX request.
  return new Promise(function(resolve, reject) {
    // Define success and failure functions.
    var onSuccess = function(result) {
      fit20.log("< Isensit GW response "+(result.message || result.status || stringify(result))+" on "+urlInfo);
      resolve(result)
    };
    var onFailure = function(status, error, message, lenient) {
      status = status || '';
      if (lenient || settings.GW_acceptErrors) {
        fit20.log("! Isensit GW ignore '"+error+"' on "+urlInfo+" : "+stringify(message));
        resolve(error);
      } else {
        fit20.log(`!! Isensit GW error: '${error}' on ${urlInfo}. Message: ${stringify(message)}. Manual retry: ${fit20.sensors_isensit.manual_retry}`);
        if (! fit20.sensors_isensit.manual_retry) {
          fit20.sensors_isensit.active = false;
          message += " \nM0916";
          var machineName = fit20.store.state.machines[machineId].longName;
          var memberName = fit20.store.state.members[memberId].fullName;
          fit20.app.addAlert('error', `M0915: ${error} ; ${message}\n${memberName}, ${machineName}`);
        }
        // Send non-client errors via GAE server to support. Do not do that for connect(), which has an empty path.
        if (!status.toString().startsWith('4') && path.length > 0 && settings.GW_retries > 0) {
          fit20.sensors_isensit.sendReport(memberId, `Error: ${error} on ${urlInfo} calling API`, message);
        }
        reject(message);
      }
    }; // onFailure
    // First attempt to call service.
    fit20.log("> Isensit GW call "+urlInfo);
    $.ajax(url, settings).then(
      // success function:
      function(result, status, jqXHR) {
        if (!result.status || result.status != "success") {
          onFailure(jqXHR.status, status, (result.message || jqXHR.responseText), true);
        } else {
          onSuccess(result);
        }
      }, // success function
      // fail function:
      function(jqXHR, status, error) {
        if (settings.method == 'GET' && !settings.GW_noRetry) {
          // Second attempt to call service, only for GET requests.
          fit20.log("! Isensit GW retry "+urlInfo+" because "+status+" / "+stringify(error));
          settings.timeout *= 1.5; // Give it more time on second attempt.
          $.ajax(url, settings).then(
              // second try success
              function(result, status, jqXHR) {
                if (!result.status || result.status != "success") {
                  onFailure(jqXHR.status, status, (result.message || jqXHR.responseText), true);
                } else {
                  onSuccess(result);
                }
              },
              // second try fail
              function(jqXHR, status, error) {
                // The error persists, turn off sensor.
                onFailure(jqXHR.status, error, (jqXHR.responseJSON ? jqXHR.responseJSON.message : status), false);
              }
          ); // then 2
        } else {
          // No second attempt, turn off sensor.
          onFailure(jqXHR.status, error, (jqXHR.responseJSON ? jqXHR.responseJSON.message : status), false);
        }
      } // fail function
    ); // $.ajax.then
  }); // new Promise
}; // _callGateway

/**
 * Connect to the sensors in a studio.
 * This must be done when a current studio is selected, and when something about the sensors changes (e.g., the IP address).
 * Returns a promise. When the promise resolves or rejects, the fit20.sensors.active property has been set.
 * This operation may be called when the sensor is already connected, and in that case must not do anything.
 */
fit20.sensors_isensit.connect = function(studio) {
  if (studio && studio.gatewayIPAddress && !studio.gatewayIPAddress.endsWith('.js')) {
    if (fit20.sensors_isensit.ipAddress != studio.gatewayIPAddress) {
      fit20.log(`* Isensit GW init / connect to gateway at ${studio.gatewayIPAddress}`);
      fit20.sensors_isensit.ipAddress = studio.gatewayIPAddress;
      // Do not accept errors, because then the sensor may be unavailable.
      var connectPromise = fit20.sensors_isensit._callGateway('', {GW_acceptErrors: false}).
        then(
          function(response){
            fit20.log("* Isensit GW activating sensor");
            fit20.sensors_isensit.active = true;
            fit20.sensors_isensit.gatewayVersion = response.data.version;
            return `M0910: ${studio.gatewayIPAddress}`;
          },
          function(error){
            fit20.log(`! Isensit GW de-activating sensor. ${error}`);
            fit20.sensors_isensit.active = false;
            return Promise.reject(`M0912 (${studio.gatewayIPAddress})`);
          }
        );
      return connectPromise;
    } else {
      fit20.log('* Isensit GW init / connect already connected');
      return Promise.resolve('M0910');
    }
  } else {
    fit20.log(`!! Isensit GW init / connect Studio ${studio ? 'has no gateway address' : 'does not exist'}.`);
    fit20.sensors_isensit.active = false;
    return Promise.reject("M0911");
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
 *     with parameter {isCalibrated? : [boolean, boolean] // two booleans, 0 (start position) and 1 (end position)
 *                    } (The ? means that this property may be undefined when unchanged.)
 *   dataHandler: A function that is called when new data arrives,
 *     with parameter ({count, actual_position, reference_position, repetition, tracking}).
 *       repetition: 0 = start; >0 = moving, -1 = stationary
 *   resultHandler: A function that is called to show results,
 *     with parameter ({average, tempo, rhythm, range, graphData}).
 *   options: Specific for Isensit. This has a `retries` property.
 * Returns a promise.
 */
fit20.sensors_isensit.configureExercise = function(studioId, machineId, member, errorHandler, stateHandler, dataHandler, resultHandler, options) {
  options = options || {retries: 0};
  var machineName = fit20.store.state.machines[machineId].longName+" ("+machineId+")";
  var memberName = `${member.fullName} (${member.id})`;
  fit20.log(`* Isensit GW configureExercise for ${memberName} machine: ${machineName}`);
  // If the previous exercise was finished, current exercise is undefined so you can re-select the previous exercise.
  // But on localhost, the machine is always the same, so finish it anyway.
  if (fit20.sensors_isensit.getCurrentExercise(member.id).machineId == machineId) {
    stateHandler({isCalibrated: fit20.sensors_isensit.getCurrentExercise(member.id).calibration});
    return Promise.resolve("configureExercise: no change in exercise");
  }
  var promise =
    fit20.sensors_isensit.connect(fit20.store.state.currentStudio).
    then(function(result) {
      // The exercise may be active, so close it. If the exercise is not active, finishExercise will just resolve.
      // In a duo-training, the duo-partner may be using the machine, so we need to search through currentExercises.
      var exerciseUsingThisMachine = Object.entries(fit20.sensors_isensit.currentExercises).
        find(function(entry){return entry[1].machineId == machineId});
      if (exerciseUsingThisMachine) {
        fit20.log(`* Isensit GW configureExercise, there is already an exercise using ${machineName}; closing it.`);
        var memberIdUsingThisMachine = exerciseUsingThisMachine[0];
        var currentExercise = exerciseUsingThisMachine[1];
        fit20.log(`Isensit GW will close machineId=${machineId} for memberId=${memberIdUsingThisMachine} by memberId=${member.id}`);
        if (currentExercise && currentExercise.stateHandler) {
          // Close the sensor panel.
          currentExercise.stateHandler({stopSensor: true});
        }
        return fit20.sensors_isensit.finishExercise(studioId, memberIdUsingThisMachine);
      } else {
        return Promise.resolve();
      }
    }).
    then(function(result) {
      fit20.sensors_isensit.currentExercises[member.id] = {
          studioId: studioId, machineId: machineId, calibration: undefined,
          stateHandler: stateHandler, resultHandler: resultHandler, errorHandler: errorHandler,
          socket: undefined
        };
      // Create member is always needed.
      return fit20.sensors_isensit._callGateway('members', {
        method: 'POST',
        data: {id: member.id, name: member.fullName}
      }, studioId, machineId);
    }).
    then(function(result) {
      // Create exercise.
      return (
        fit20.sensors_isensit._callGateway('exercise', {
          method: 'POST',
          data: $.param({action: 'create'}),
          GW_retries: options.retries,
        }, studioId, machineId, member.id)
      );
    }).
    then(function(result) {
      if (isUndefined(fit20.sensors_isensit.currentExercises[member.id])) {
        return Promise.reject('fit20.sensors_isensit.configureExercise / create: fit20.sensors_isensit.currentExercises[member.id] is undefined');
      } else if (isUndefined(result) || isUndefined(result.data)) {
        return Promise.reject('fit20.sensors_isensit.configureExercise / create: result.data is undefined');
      } else {
        fit20.sensors_isensit.currentExercises[member.id].exerciseId = result.data.exercise_id;
        fit20.sensors_isensit.updateStatus();
        return fit20.sensors_isensit.checkCalibration(studioId, member.id);
      }
    }).
    then(function(result) {
      fit20.log(`* Isensit GW ready configureExercise, member: ${memberName} machine: ${machineName}`);
      // Do not include the websocket connection in the promise.
      fit20.sensors_isensit.openDataStream(member, studioId, machineId, stateHandler, dataHandler, resultHandler);
      return result;
    }).
    catch(function(error){
      fit20.log(`! Isensit GW ready configureExercise error: ${JSON.stringify(error)}`);
      fit20.sensors_isensit.finishExercise(studioId, member.id);
      // Complain to the boss.
      var location = 'studio ' + (fit20.store.state.currentStudio ? fit20.store.state.currentStudio.name + ' ' + fit20.store.state.currentStudio.subName : '(unknown)');
      var otherInfo = `gateway: ${fit20.sensors_isensit.gatewayVersion || 'unknown version'}.`;
      if (!fit20.sensors_isensit._LOCALHOST) {
        fit20.logServer(error, location, 11, {details: otherInfo});
      }
      return Promise.reject(error);
    }); // promise
  return promise;
}; // configureExercise

/**
 * Find out if the sensor for this member/machine is calibrated, and call the stateHandler to make it known.
 * This will set the 'calibration' property of the currentExercise, and SHOULD be called ONLY ONCE per exercise.
 * Returns a promise.
 */
fit20.sensors_isensit.checkCalibration = function(studioId, memberId) {
  fit20.log("* Isensit GW isCalibrated memberId="+memberId);
  var currentExercise = fit20.sensors_isensit.getCurrentExercise(memberId);
  var machineId = currentExercise.machineId;
  if (isUndefined(machineId)) {
    return Promise.reject("checkCalibration: M0914");
  }
  var stateHandler = currentExercise.stateHandler;
  if (isUndefined(stateHandler)) {
    return Promise.reject("checkCalibration: M0915 (no stateHandler)");
  }
  if (isUndefined(currentExercise.calibration)) {
    return fit20.sensors_isensit._callGateway('calibrate', {
      method: 'GET',
      GW_acceptErrors: true,
      GW_noRetry: true
    }, studioId, machineId, memberId).
    then(function(result){
      currentExercise.calibration = isDefined(result.data) ? [result.data.minValue != 0 , result.data.maxValue != 360] : [false, false];
      stateHandler({isCalibrated: currentExercise.calibration});
      return result;
    }).
    catch(function(result){
      // Usually 404, with {"status": "error", "message": "calibration settings not found"}.
      currentExercise.calibration = [false, false];
      stateHandler({isCalibrated: currentExercise.calibration});
      return result;
    });
  } else {
    stateHandler({isCalibrated: currentExercise.calibration});
    return Promise.resolve();
  }
};

/**
 * Calibrate for a specific machine and member.
 *   studioId: The id of the current studio.
 *   memberId: The id of the current member
 *   calibratePosition can be 0 (start position) or 1 (end position)
 * Returns a promise.
 */
fit20.sensors_isensit.calibrate = function(studioId, memberId, calibratePosition) {
  var currentExercise = fit20.sensors_isensit.getCurrentExercise(memberId);
  if (isUndefined(currentExercise.calibration)) {
    currentExercise.calibration = [false, false];
  }
  var action = calibratePosition == 0 ? 'start' : 'stop';
  fit20.log("* Isensit GW calibrate "+action+" memberId="+memberId);
  var machineId = fit20.sensors_isensit.getCurrentExercise(memberId).machineId;
  if (isUndefined(machineId)) {
    return Promise.reject("calibrate: M0914");
  }
  return fit20.sensors_isensit._callGateway('calibrate', {
      method: 'POST',
      data: $.param({action: action})
    }, studioId, machineId, memberId).
    then(function(result){
      currentExercise.calibration[calibratePosition] = true;
    }).
    catch(function(error){
      fit20.log(`! Isensit GW calibrate ${action} memberId=${memberId} error: ${error}`);
      currentExercise.calibration = [false, false];
    }).
    then(function(){
      currentExercise.stateHandler({isCalibrated: currentExercise.calibration});
    });
};

/**
 * Start the exercise.
 * This will resolve immediately when the sensor is not active for the selected member and machine.
 *   studioId: The id of the current studio.
 *   memberId: The id of current member.
 * Returns a promise.
 */
fit20.sensors_isensit.startExercise = function(studioId, memberId) {
  var machineId = fit20.sensors_isensit.getCurrentExercise(memberId).machineId;
  if (isUndefined(machineId)) {
    return Promise.resolve("startExercise: M0914");
  }
  fit20.log("* Isensit GW startExercise memberId="+memberId);
  return fit20.sensors_isensit._callGateway('exercise', {
    method: 'POST',
    data: $.param({action: "start"})
  }, studioId, machineId, memberId);
};

/**
 * Re-start the exercise.
 * This will resolve when the sensor is not active for the selected member and machine.
 *   studioId: The id of the current studio.
 *   memberId: The id of current member.
 * Returns a promise.
 */
fit20.sensors_isensit.restartExercise = function(studioId, memberId) {
  var machineId = fit20.sensors_isensit.getCurrentExercise(memberId).machineId;
  if (isUndefined(machineId)) {
    return Promise.resolve("restartExercise: M0914");
  }
  fit20.log("* Isensit GW restartExercise memberId="+memberId);
  return fit20.sensors_isensit._callGateway('exercise', {
    method: 'POST',
    data: $.param({action: "restart"})
  }, studioId, machineId, memberId);
};

/**
 * Put the exercise in the stationary state.
 *   studioId: The id of the current studio.
 *   memberId: The id of current member.
 * Returns a promise.
 */
fit20.sensors_isensit.stationaryExercise = function(studioId, memberId) {
  fit20.log("* Isensit GW stationaryExercise memberId="+memberId);
  var machineId = fit20.sensors_isensit.getCurrentExercise(memberId).machineId;
  if (isUndefined(machineId)) {
    return Promise.reject("stationaryExercise: M0914");
  }
  return fit20.sensors_isensit._callGateway('exercise', {
    method: 'POST',
    GW_acceptErrors: true,
    data: $.param({action: "pause"})
  }, studioId, machineId, memberId);
};

/**
 * Stop the exercise. When it is stopped, show the results.
 * This will resolve when the sensor is not active for the selected member and machine.
 *   studioId: The id of the current studio.
 *   memberId: The id of current member.
 * Returns a promise.
 */
fit20.sensors_isensit.stopExercise = function(studioId, memberId) {
  var currentExercise = fit20.sensors_isensit.getCurrentExercise(memberId);
  var machineId = currentExercise.machineId;
  if (isUndefined(machineId)) {
    return Promise.resolve("stopExercise: M0914"); // Resolve, it is okay to do this to nicely close a possibly running exercise.
  }
  var resultHandler = currentExercise.resultHandler;
  if (isDefined(resultHandler)) {
    resultHandler({}); // Announce that results are coming, close progress panel.
  }
  var machineName = fit20.store.state.machines[machineId].longName+" ("+machineId+")";
  fit20.log("* Isensit GW stopExercise memberId="+memberId+" machine: "+machineName);
  return fit20.sensors_isensit._callGateway('exercise', {
      method: 'POST',
      GW_acceptErrors: true,
      data: $.param({action: "stop"})
    }, studioId, machineId, memberId).
    catch(function(error){
      // Report the error, but ignore it.
      fit20.log("! Isensit GW exercise stop memberId="+memberId+" machine: "+machineName+" error: "+stringify(error));
      return error;
    }). // catch (exercise stop)
    then(function(result){
      if (isUndefined(resultHandler)) {
        return Promise.reject("M0915 (no resultHandler)");
      }
      fit20.log("> Isensit GW userdata for memberId="+memberId+" machine: "+machineName);
      return fit20.sensors_isensit._callGateway('userdata', {
          method: 'GET',
          GW_acceptErrors: true
        }, studioId, machineId, memberId).
        then(function(result){
          fit20.log("< Isensit GW userdata for memberId="+memberId+" machine: "+machineName);
          var data = result.data;
          // Upgrade the graph data.
          var graphData = data.referenceData.map(function(data, index){return [index, data[0], data[1]]});
          resultHandler({average: data.qs, tempo: data.metronome, rhythm: data.steady, range: data.range, graphData: graphData});
          // Do not finish, because the exercise results are displayed on the machine screen.
        }).
        catch(function(error){
          fit20.log("! Isensit GW userdata memberId="+memberId+" machine: "+machineName+" error: "+stringify(error));
          fit20.sensors_isensit.finishExercise(studioId, memberId);
          return Promise.reject(`M0915 No userdata, ${+stringify(error)}`);
        }); // catch (userdata)
    }); // then (exercise stop)
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
fit20.sensors_isensit.finishExercise = function(studioId, memberId) {
  var currentExercise = fit20.sensors_isensit.getCurrentExercise(memberId);
  var machineId = currentExercise ? currentExercise.machineId : undefined;
  if (currentExercise && currentExercise.socket) {
    currentExercise.socket.disconnect();
  }
  delete fit20.sensors_isensit.currentExercises[memberId];
  if (isUndefined(machineId)) {
    return Promise.resolve({"status": "success", "message": "finishExercise: M0914"});
  }
  var machineName = fit20.store.state.machines[machineId].longName+" ("+machineId+")";
  fit20.log("* Isensit GW finishExercise memberId="+memberId+" machine: "+machineName);
  var promise = fit20.sensors_isensit._callGateway('exercise', {
      method: 'POST',
      GW_acceptErrors: true,
      data: $.param({action: "complete"})
    }, studioId, machineId, memberId).
    catch(function(result){ return {"status": "success", "message": "finishExercise: action=complete was rejected: "+stringify(result)} }).
    then(function(result) {
      fit20.log("* Isensit GW ready finishExercise memberId="+memberId+" machine: "+machineName+" ("+stringify(result)+")");
      fit20.sensors_isensit.updateStatus();
      currentExercise.exerciseId += ' (completed)';
      return result;
    });
  return promise;
};

/**
 * Open a data stream listening to the sensor of a specific machine.
 *   member: The current member
 *   studioId: The id of the current studio.
 *   machineId: The id of the machine from which data is received.
 *   stateHandler: The stateHandler, used to force-stop the exercise.
 *   dataHandler: A function that is called when new data arrives,
 *     with parameter ({count, actual_position, reference_position, repetition, tracking}).
 *   resultHandler: A function that is called to show results,
 *     with parameter ({average, tempo, rhythm, range, graphData}).
 * Returns a promise that resolves when the connection has been established, or rejects when no connection can be made.
 */
fit20.sensors_isensit.openDataStream = function(member, studioId, machineId, stateHandler, dataHandler, resultHandler) {
  // Return a promise.
  return new Promise(function(resolve, reject) {
    //DEBUG for Nico's sensor-gateway. This is also present in _callGateway
    if (fit20.sensors_isensit._LOCALHOST) {
      fit20.log("* Isensit GW socket DEBUGGING on localhost");
      if (studioId) studioId = '16001'; // fit20 test NL
      //if (machineId == 6368371348078592) machineId = '5001'; else // lat pull, only at Isensit.
      if (machineId) machineId = '3001'; // chest press
    }
    // END DEBUG
    // Have a 'function-global' variable socket.
    var socket = undefined;
    var disconnectSocket = function() {
      if (isDefined(socket)) socket.disconnect();
    };
    var socketUrl = `http://${fit20.sensors_isensit.ipAddress}:${fit20.sensors_isensit.ipPort}/livedata`;
    // We need memberId in some places.
    var memberId = member.id;
    var machineScreenUrl = `http://${fit20.sensors_isensit.ipAddress}/fit20/ms.html?studio=${studioId}&machine=${machineId}&member=${memberId}&start=false&stop=false&restart=false`;
    var socketName = `[studio=${studioId} machineId=${machineId} memberId=${memberId} (${member.fullName})]`;
    // Modify the error handler, so it can retry and send reports.
    var errorhandlerBusy = 0;
    // The error handler sends a report, and then relies on the rejection of the promise to handle the error.
    var socketErrorHandler = function(type, description, callbackButtons){
      // Only do one error handler at a time.
      if (errorhandlerBusy++) {
        fit20.log(`* Isensit GW socket errorHandler busy, ignoring ${description}`);
      } else {
        // Send an error report to the server, unless this is a test.
        fit20.sensors_isensit.sendReport(memberId, `Error ${type} in websocket communication`, description);
        reject(description);
      }
    }; // socketErrorHandler
    var execiseStarted = false;
    // Connect the socket, never retry.
    socket = io.connect(socketUrl, {'transports': ['websocket'], 'timeout': 20000});
    fit20.log(`> Isensit GW socket openDataStream for ${socketName} [${socketUrl}] via ${socket.io.engine.transport.name}`);
    fit20.sensors_isensit.getCurrentExercise(memberId).socket = socket; // Needed in finishExercise.
    // Socket event handlers
    socket.on('connect', function(){
      socketName += ` socketId=${socket.id}`;
      fit20.log("< Isensit GW socket connected for "+socketName);
      var room = 'machine_room_'+machineId.toString();
      fit20.log("> Isensit GW socket join room "+room+" for "+socketName);
      socket.emit('join', {room: room, machine: machineId},
        function(){
          fit20.log("< Isensit GW socket joined room "+room+" for "+socketName);
        });
      // Resolve when connected.
      resolve(`connected ${socketName}`);
    });
    socket.on('disconnect', function(reason){
      fit20.log("< Isensit GW socket disconnect received for "+socketName);
      // Resolve when disconnected.
      resolve(`disconnected ${socketName}`);
    });
    socket.on('server msg', function(msg){
      fit20.log("* Isensit GW socket server msg for "+socketName+": "+stringify(msg));
    });
    socket.on('connect_error', function(error){
      fit20.log("!! Isensit GW socket connect_error for "+socketName+": "+stringify(error));
// handling the error and disconnecting does not work. Rely on the trainer manually disconnecting when sensor does not work.
//      socketErrorHandler('error', stringify(error));
//      disconnectSocket();
    });
    socket.on('connect_timeout', function(timeout_ms){
      fit20.log("!! Isensit GW socket connect_timeout for "+socketName);
//      socketErrorHandler('error', 'M0917');
    });
    var onError = function(error){
      fit20.log("!! Isensit GW socket error for "+socketName+": "+stringify(error));
//      socketErrorHandler('error', stringify(error));
    }
    socket.on('error', onError);
    socket.on('reconnect_error', onError);
    socket.on('reconnect_failed', onError);
    // The data event handler updates the sensor panel.
    /* See fit20_exercise.py:
        'data': {
            'packetCounter': packet_counter,
            'state': self.exercise_status,
            'countdown': self.reference_bar.get_countdown(),
            'referenceValue': round(self.reference_bar.get_current_value(), 2),
            'memberValue': self.value,
            'realValue': round(self.sensor.data, 2),
            'totalRep': self.reference_bar.number_of_reps,
            'currentRep': self.reference_bar.get_reps_completed(),
            'timeElapsed': round(self.reference_bar.time_elapsed, 2)
        }
     */
    socket.on('live_data', function (data) {
      if (isUndefined(data.data) || isUndefined(data.data.state)) {
        fit20.log("!! Isensit GW socket live_data undefined for "+socketName+". "+data.status+": "+data.message);
        stateHandler({stopSensor: true}); // Calls finishExercise.
        //fit20.sensors_isensit.finishExercise(studioId, memberId);
        return;
      }
      var state = data.data.state;
      if (state == 'COMPLETE') {
        fit20.log("* Isensit GW socket disconnecting, live_data COMPLETE for "+socketName+": "+data.status+": "+data.message);
        disconnectSocket();
        return;
      }
      // There is also data.data.realValue.
      var actual_position = parseFloat(data.data.memberValue);
      var reference_position = parseFloat(data.data.referenceValue);
      var repetition = parseInt(data.data.currentRep) + 1;
      var count = parseInt(data.data.timeElapsed);
      var countdown = parseInt(data.data.countdown);
      if (state == 'STATIONARY') {
        count = countdown;
        repetition = -1; // convention in sensor.js
      } else if (state == 'INIT' || state == 'STOP') {
        count = '';
        repetition = 0; // convention in sensor.js
      } else if (state == 'RUNNING') {
        if (count == 0 && countdown > 0) {
          count = countdown;
        } else if (count == 1) {
          // Only show 0 after the 0 countdown, when exercise has not really started.
          execiseStarted = true;
        } else if (count == 0 && execiseStarted) {
          // Don't show 0 after initial countdown. Show 10 instead.
          count = 10;
        }
      }
      actual_position = actual_position / 100;
      reference_position = reference_position / 100;
      var tracking = 0;
      if (state == 'RUNNING') {
        tracking = Math.abs(reference_position - actual_position);
      }
      dataHandler({
        count: count,
        actual_position: actual_position,
        reference_position: reference_position,
        repetition: repetition,
        tracking: tracking,
        state: state
      });
      if (state == 'STOP') {
        fit20.log("> Isensit GW socket state == STOP for "+socketName);
      } // state == 'STOP'
    }); // socket.on('live_data')
  }); // new Promise
}; // openDataStream


/**
 * Vue component for a modal, used to connect to sensors from the trainers app.
 */
fit20.sensors_isensit.sensorconnect = {
  template: `
    <div class="modal fade">
      <div class="modal-dialog modal-md" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ $t('M0906' )}}</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div><!-- modal-header -->
          <div class="modal-body">
            <div v-if="usingHttps" class="alert-danger">{{ $t('M9550') }}</div>
            <div class="container-fluid">
              <div class="row">
                <div class="col-12">
                  <div class="form-group row">
                    <div class="col-12 px-2">
                      <p>{{ $t('M0907') }}</p>
                      <p><strong>{{ $t('M0908') }}</strong></p>
                    </div>
                    <div class="col-12 px-2" v-if="studio">
                      <input type="text" size="20" id="sensor_gateway_ip"
                        pattern="\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|.+\\.local\\.?"
                        v-model="gatewayIPAddress">
                      <button type="button" class="btn btn-primary"
                        @click="testGatewayIPAddress(studio)"
                      >
                        {{ $t('M0082') }}
                      </button>
                      <p class="pt-1" id="gatewayStatus"></p>
                    </div>
                  </div><!-- form-group -->
                </div><!-- col-12 -->
              </div><!-- row -->
            </div><!-- container-fluid -->
          </div><!-- modal-body -->
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-primary"
              v-on:click="setGatewayIPAddress(studio)"
              data-dismiss="modal"
            >
            {{ $t('M0000') }}
            </button>
          </div><!-- modal-footer -->
          <div class="modal-footer bg-info">
            <button
              type="button"
              class="btn btn-warning"
              v-on:click="resetAllSensors"
              data-dismiss="modal"
            >
              {{ $t('M0921') }}
            </button>
          </div><!-- modal-footer -->
        </div><!-- modal-content -->
      </div>
    </div>
  `,
  props: ['studio'],
  data: function() {
    return {
      gatewayIPAddress : this.studio.gatewayIPAddress.endsWith(".js") ? "" : this.studio.gatewayIPAddress
    }
  },
  methods: {
    /* Set and persist the sensor gateway address.
     * Works in the background and refreshes the studio object.
     */
    setGatewayIPAddress: function(studio) {
      studio.gatewayIPAddress = this.gatewayIPAddress;
      fit20.put('sensorGateway', studio);
    },
    testGatewayIPAddress: function(studio) {
      fit20.log(`Isensit GW testing gateway at ${this.gatewayIPAddress}`);
      $('#gatewayStatus').html('<i class="fa fa-rss fa-spin"></i>');
      studio.gatewayIPAddress = this.gatewayIPAddress;
      fit20.sensors.connect(studio).
        then(function(message) {
          $('#gatewayStatus').removeClass('alert-danger').html($t(message));
        }).
        catch(function(message) {
          $('#gatewayStatus').addClass('alert-danger').html($t(message));
        });
    },
    resetAllSensors: function() {
      var scope = this;
      fit20.sensors_isensit.reset();
    }
  }, // methods
  computed: {
    usingHttps: function() {
      return location.href.startsWith('https:');
    }
  }, // computed
  mounted: function () {
    //var scope = this;
    // When the dialog is shown, reset the data shown in the edit form.
    //$('#sensor-connect-popup').on('show.bs.modal', function(){
    //});
  }
}
