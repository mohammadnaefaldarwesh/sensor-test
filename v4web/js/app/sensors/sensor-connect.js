/**
 * Initialize and connect to sensors.
 *
 * The studio.gatewayIPAddress can be:
 *  - empty or undefined: No sensors used in this studio.
 *  - non-empty, matches IP-address pattern: Isensit sensors with a known address.
 *  - non-empty, ending in ".js": Use indicated js-file,
 *    for example when Isensit gateway address is not yet known (isensit.js), or when a simulated sensor is used (fakesensor.js).
 */

/* Define namespace. */
fit20.sensors = fit20.sensors || {};

/**
 * Vue component for a modal, used to connect to sensors from the trainers app.
 * This is the default of fit20.sensors.sensorconnect, which the sensor component should override.
 */
fit20.defaultSensorconnect = {
  template: `
    <div class="modal">
      <div class="modal-dialog modal-md" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ $t('M0913') }}</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div><!-- modal-header -->
          <div class="modal-body">
          </div><!-- modal-body -->
          <div class="modal-footer">
          </div>
        </div><!-- modal-content -->
      </div>
    </div>
  `,
  props: ['studio'],
  methods: {}
};

fit20.sensors_isIsensit = function(gatewayIPAddress) {
  // Check for a (non-empty) IPv4 or IPv6 address, or a bonjour address.
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(gatewayIPAddress) ||
    /^[0-9a-fA-F]{1,4}(?:::?[0-9a-fA-F]{1,4}|\.\d{1,3})*(?:::)?$/.test(gatewayIPAddress) ||
    /^.+\.local\.?$/.test(gatewayIPAddress)
};

/**
 * Initialize the sensors in a studio.
 * This must be done when a current studio is selected, and when something about the sensors changes (e.g., the IP address).
 * When sensors are initialized, the whole fit20.sensors object is changed!
 * This function must not be overwritten by a specific sensors file.
 * Returns a promise. When the promise resolves or rejects, the fit20.sensors.active property is set.
 * Use the fit20.sensors.active property to determine the status of the sensors.
 */
fit20.sensors.init = function(studio) {
  fit20.log("* Sensor initialization.");
  // Remember this function itself. It will be overwritten in the included sensors.js file.
  fit20.sensors_init = fit20.sensors.init;
  // Reset the sensor object.
  fit20.sensors = {active: false, sensorconnect: fit20.defaultSensorconnect, init: fit20.sensors_init, leadInSeconds: -3};
  // Determine the sensor API to load.
  if (isUndefined(studio) || isEmpty(studio.gatewayIPAddress)) {
    fit20.log("* Sensor not present in this studio.");
    return Promise.resolve('M0913');
  }
  if (fit20.sensors_isIsensit(studio.gatewayIPAddress)) {
    // Use Isensit sensors.
    fit20.sensors.js_file = 'isensit.js';
  } else if (studio.gatewayIPAddress.endsWith('.js')) {
    // Use sensors defined in JS file.
    fit20.sensors.js_file = studio.gatewayIPAddress;
  } else {
    fit20.log(`* Sensor specification '${studio.gatewayIPAddress}' is invalid.`);
    return Promise.reject('M0911');
  }
  // Load the js file for the specific sensors.
  return new Promise(function(resolve, reject) {
    jQuery.getScript(`js/app/sensors/${fit20.sensors.js_file}`).
    done(function(){
      fit20.sensors.init = fit20.sensors_init; // Re-set this function itself as the init function.
      // Connect to the specific sensor type.
      fit20.sensors.connect(studio).
        then(function(){
          resolve('M0910');
        }).
        catch(function(error){
          reject(error);
        });
    }).
    fail(function(){
      reject(`M0915: Cannot find ${fit20.sensors.js_file}`);
    });
  });
};

/**
 * Activate sensors in the current studio, from the console.
 * This is a secret function for developers.
 */
fit20.sensors_activateNow = function() {
  var studio = fit20.store.state.currentStudio;
  studio.gatewayIPAddress = "";
  fit20.put('sensorGateway', studio);
};
