/*
  Storage hierarchy implementation.
  Values are stored in the Vuex store.
  This is backed up by localstorage, because javascript variables may be lost when switching browser tabs or apps.
  Instead of localstorage, which is very limited on iOS, we use localForage: https://github.com/localForage/localForage
  If a value is not in localstorage (or is stale) it is fetched (if possible) from the database on the server.
  There may be dependencies between stored items, which are handled (if configured) by this code.
*/

/** Define namespace. */
var fit20 = fit20 || {};

/**
 *  Functions for localForage.
 */

// Maximum lifetime for items in localstorage.
fit20.storeLifetime = 30 * 60 * 1000; // 30 minutes

// Set an item in the Vuex store and in localForage.
// Returns a promise from localForage.
fit20.storeItem = function(state, key, value, subkey) {
  if (isUndefined(state)) debugger; // Detect bug in Firefox / Vue devtools, May 2019.
  if (isDefined(subkey)) {
    Vue.set(state[key], subkey, value);
  } else {
    Vue.set(state, key, value);
  }
  // Set a fresh timestamp, don't check if the value has changed. This means that, if the value has not changed, it is refreshed.
  return localforage.setItem(key, {value: state[key], timestamp: Date.now()}).
    then(function(fromLocal) {
      if (isUndefined(fromLocal)) {
        var err = `LocalForage setItem(${key}) returned an undefined value.`;
        fit20.log(`!! store ${err}`);
        fit20.logServer(err, 'store.js/fit20.storeItem', 2);
        debugger; // Please check what happened!
        Promise.reject(err);
      } else {
        return fromLocal.value;
      }
    }).
    catch(function(err) {
      if (fit20.log) {
        err = `LocalForage setItem(${key}) caused an error: ${err}`;
        fit20.log(`!! store ${err}`);
        //fit20.logServer(err, 'store.js/fit20.storeItem', 2);
        // known bug: https://bugs.webkit.org/show_bug.cgi?id=201483  https://bugs.webkit.org/show_bug.cgi?id=197050
      }
      debugger;
      Promise.reject(err);
    });
};

// Get an item from localForage.
// Returns a promise from localForage.
fit20.getItem = function(key) {
  return localforage.getItem(key).
    then(function(fromLocal) {
      if (isUndefined(fromLocal)) {
        // The localForage value does not exist.
        fit20.log("* store Cannot getItem from localstorage (not present): "+key);
        return undefined;
      } else if (isUndefined(fromLocal.timestamp) || Date.now() - fromLocal.timestamp > fit20.storeLifetime) {
        // The localForage value is too old.
        fit20.log("* store Cannot getItem from localstorage (too old): "+key);
        return undefined;
      } else {
        fit20.log(`* store GetItem from localstorage: ${key} = ${shallowStringify(fromLocal.value)} (age is ${Math.round((Date.now() - fromLocal.timestamp)/60000)} min.)`);
        return fromLocal.value;
      }
    }).
    catch(function(err) {
      var message = `!! store Error in getItem ${key} from localstorage: ${err}`;
      fit20.log(message);
      //fit20.logServer(message, 'store.js/fit20.getItem', 2);
      return undefined; // So the value will be fetched from the server.
    });
};

// List the contents of localForage, to be used for debugging.
fit20.showLocalStorage = function() {
  localforage.iterate(function(value, key, iterationNumber) {console.dir({key: key, value: value})});
}


/**
 *  The Vuex store.
 *  Variables are initialized to undefined, so they will be fetched from localstorage or the server at first access.
 */
fit20.store = new Vuex.Store({
  //strict: true, // very inefficient, use only for debugging

  state: {
    // The fit20 object.
    fit20: undefined,
    // All machine data, mapping from id to machine.
    machines: undefined,
    // The trainer who is using the app.
    currentTrainer : undefined,
    // The studios available to the current user.
    studios: undefined,
    // The current studio and information belonging to it.
    currentStudio: undefined,
    // List of machines in the current studio.
    studioMachines: undefined,
    // MachineSettings for the current studio. This maps machine ids to settings.
    studioMachineSettings: undefined,
    // The members for the current studio. This maps member ids to member objects.
    members: undefined,
    // MemberSessions maps member ids to member sessions lists.
    memberSessions: undefined,
    // MemberMachineSettings maps member ids to machine settings.
    memberMachineSettings: undefined,
    // ActiveMemberSession maps member ids to sessions.
    activeMemberSessions: undefined
  }, // state

  mutations: {
    // When a value is set in localForage, we don't wait for setItem to finish.
    // The value from localForage should not be needed immediately, and mutations must be synchronous.
    setFit20: function(state, fit20object) {
      fit20.storeItem(state, 'fit20', fit20object);
    },
    setMachines: function(state, machines) {
      fit20.storeItem(state, 'machines', mapById(machines));
    },
    setCurrentTrainer: function(state, currentTrainer) {
      fit20.storeItem(state, 'currentTrainer', currentTrainer);
      fit20.log(`* store Set current trainer to ${currentTrainer.fullName} (${currentTrainer.id})`);
    },
    setStudios: function(state, studios) {
      fit20.storeItem(state, 'studios', studios);
    },
    setCurrentStudio: function(state, currentStudio) {
      fit20.log(`* store Set current studio to ${currentStudio.name} ${currentStudio.subName} (${currentStudio.id})`);
      // Setting current studio changes the following:
      Promise.all([
        fit20.get(['studioMachines', currentStudio.id], true),
        fit20.get(['members', currentStudio.id], true),
        fit20.get(['studioMachineSettings', currentStudio.id], true)]).
      catch(error => fit20.log(`!! store error getting studio data: ${error}`)).
      then(() => {
        fit20.log(`* store Current studio ${currentStudio.name} ${currentStudio.subName} has ${Object.keys(fit20.store.state.studioMachineSettings).length} studioMachineSettings`);
        // Now it is safe to set the currentStudio, which is watched by members.js, and maybe others.
        fit20.storeItem(state, 'currentStudio', currentStudio);
      });
    },
    setCurrentStudioGatewayAddress: function(state, currentStudio) {
      fit20.storeItem(state, 'currentStudio', currentStudio);
      var studioIndex = state.studios.findIndex(function(std){return std.id == currentStudio.id});
      fit20.storeItem(state, 'studios', currentStudio, studioIndex);
    },
    setStudioMachines: function(state, studioMachines) {
      fit20.storeItem(state, 'studioMachines', studioMachines.sort(function(a, b){return a.sortOrder - b.sortOrder}));
    },
    setStudioMachineSettings: function(state, studioMachineSettings) {
      fit20.storeItem(state, 'studioMachineSettings', studioMachineSettings);
    },
    setMembers: function(state, members) {
      // Members may be undefined, when switching studios.
      if (Array.isArray(members)) {
        // If members is an array, make it into an indexed object.
        members = mapById(members);
      }
      fit20.storeItem(state, 'members', members);
      if (isDefined(members)) {
        // Initialize member sessions. See https://vuejs.org/v2/guide/reactivity.html#Change-Detection-Caveats and https://vuejs.org/v2/guide/list.html#Caveats
        fit20.log("* store Initializing memberSessions in setMembers");
        var memberSessions = {};
        Object.values(members).forEach(function(member){
          if (isDefined(member) && isDefined(member.id)) memberSessions[member.id] = undefined;
        });
        fit20.storeItem(state, 'memberSessions', memberSessions);
        // Initialize memberMachineSettings.
        fit20.log("* store Initializing memberMachineSettings in setMembers");
        var memberMachineSettings = {};
        Object.values(members).forEach(function(member){
          if (isDefined(member) && isDefined(member.id)) memberMachineSettings[member.id] = undefined;
        });
        fit20.log("* store Storing memberMachineSettings in setMembers");
        fit20.storeItem(state, 'memberMachineSettings', memberMachineSettings);
      }
    },
    setMember: function(state, member) {
      if (isUndefined(member)) {
        fit20.log('!! store setMember called on undefined member.');
        return;
      }
      // Store the complete member-info in state.members.
      Vue.set(state.members, member.id, member);
      fit20.storeItem(state, 'members', member, member.id);
      // You must get member sessions and machine settings ASYNCHRONOUSLY if they are not yet there.
    },
    // Clear the memberSessions for the indicated member.
    clearMemberSessions: function(state, memberId) {
      if (isDefined(memberId)) {
        state.memberSessions = state.memberSessions || {};
        fit20.storeItem(state, 'memberSessions', [], memberId);
        fit20.log("* store Clear memberSessions for member id="+memberId);
      }
    },
    setMemberSessions: function(state, sessionsForMember) {
      // Determine the member-id by looking at the first session.
      var memberId = !isEmpty(sessionsForMember) ? sessionsForMember[0].parentMemberId : undefined;
      if (isDefined(memberId)) {
        state.memberSessions = state.memberSessions || {};
        sessionsForMember = sessionsForMember || [];
        fit20.storeItem(state, 'memberSessions', sessionsForMember, memberId);
        fit20.log("* store Set "+sessionsForMember.length+" memberSessions for member id="+memberId);
      } else if (isEmpty(sessionsForMember)) {
        fit20.log("* store No sessions were set, memberId is undefined and sessions is empty.");
      } else {
        fit20.log("! store No sessions were set, memberId is undefined.");
      }
    },
    // Set all machine settings for a member, or the settings for one machine (if parentMachineId is defined).
    setMemberMachineSettings: function(state, memberMachineSettingsForMember) {
      memberMachineSettingsForMember = memberMachineSettingsForMember || {};
      // The parentMemberId is set by the filter.
      var memberId = memberMachineSettingsForMember.parentMemberId ||
                     (Object.values(memberMachineSettingsForMember)[0] || {}).parentMemberId;
      if (isDefined(memberId)) {
        var machineId = memberMachineSettingsForMember.parentMachineId;
        if (isDefined(machineId)) {
          // settings for one machine
          state.memberMachineSettings = state.memberMachineSettings || {};
          var memberMachineSettings = state.memberMachineSettings[memberId] || {};
          memberMachineSettings[machineId] = memberMachineSettingsForMember;
          fit20.storeItem(state, 'memberMachineSettings', memberMachineSettings, memberId);
          fit20.log(`* store Set memberMachineSettings for member id=${memberId} machine id=${machineId}`);
        } else {
          // settings for all machines
          delete memberMachineSettingsForMember.parentMemberId;
          state.memberMachineSettings = state.memberMachineSettings || {};
          fit20.storeItem(state, 'memberMachineSettings', memberMachineSettingsForMember, memberId);
          fit20.log(`* store Set all memberMachineSettings for member id=${memberId}`);
        }
      } else {
        debugger;
        throw("SetMemberMachineSettings did not get a memberId in "+JSON.stringify(memberMachineSettingsForMember));
      }
    },
    setMemberSession : function(state, session) {
      // Determine the member-id by looking at the first session.
      var memberId = session.parentMemberId;
      if (isDefined(memberId)) {
        // Make sure the state has a memberSessions object.
        state.memberSessions = state.memberSessions || {};
        // Make sure we have a sessionsForMember array.
        var sessionsForMember = state.memberSessions[memberId] || [];
        // Find the index of the current session, if it already exists.
        var sessionIndex = sessionsForMember.findIndex(function(ssn){return ssn.id == session.id});
        // Put the current session into sessionsForMember.
        if (sessionIndex < 0) {
          sessionsForMember.push(session);
        } else {
          Vue.set(sessionsForMember, sessionIndex, session);
        }
        // Store the memberSessions.
        fit20.storeItem(state, 'memberSessions', sessionsForMember, memberId);
        fit20.log("* store Set "+(sessionIndex < 0 ? "new" : "existing")+" memberSession for member id="+memberId);
      } else {
        fit20.log("! store No session was set because the memberId was not given.");
      }
    },
    // Set the active session for a member.
    // The session parameter can be a session, or a member-id to unset the active session.
    setActiveMemberSession: function(state, session) {
      if (isUndefined(state.activeMemberSessions)) state.activeMemberSessions = {};
      if (isObject(session)) {  // session is a real session
        if (isUndefined(session.exercises)) session.exercises = [];
        var memberId = session.parentMemberId;
        fit20.log("* store Set active session for member "+memberId+" with "+session.exercises.length+" exercises.");
      } else { // session is a member-id
        var memberId = session;
        session = undefined;
        fit20.log("* store Unset active session for member "+memberId);
      }
      fit20.storeItem(state, 'activeMemberSessions', session, memberId);
    },
    // Some duo changed.
    duoChanged : function(state, results) {
      // Inefficient but effective: just reload the whole members object.
      fit20.memberStore.memberHasChanged();
    },
    // Used for fit20.refreshAll.
    RESET: function(state) {
      Object.keys(state).forEach(function(key){state[key] = undefined});
    }
  }, // mutations

  getters: {
  } // getters

}); // fit20.store


/**
 * Filters to use when fetching data.
 *  Must be defined before fit20.storeConf.
 *  Filter parameters are the result, and the subkey of the request.
 */
fit20.fetchFilters = {
  // Get the date part of a DateTime.
  _date : function(date) {
    return date.replace(/T.*/, '');
  },
  _person : function(person) {
    ['firstName', 'lastName'].forEach(function(key){
      if (isUndefined(person[key]))
        person[key] = '';
    });
    return person;
  },
  // Filters for specific object types.
  machine : function(machine) {
    if (isDefined(machine.weightValues) && !Array.isArray(machine.weightValues)) {
      machine.weightValues = machine.weightValues.split(/\s+/);
    }
    return machine;
  },
  trainer : function(trainer) {
    trainer = fit20.fetchFilters._person(trainer);
    ['birthDate'].forEach(function(key){
      if (isDefined(trainer[key]))
        trainer[key] = fit20.fetchFilters._date(trainer[key]);
    });
    return trainer;
  },
  member : function(member) {
    member = fit20.fetchFilters._person(member);
    ['birthDate', 'membershipSince', 'membershipUntil', 'measureDate'].forEach(function(key){
      if (isDefined(member[key]))
        member[key] = fit20.fetchFilters._date(member[key]);
    });
    if (isDefined(member.measureDates))
      for (var i = 0; i < member.measureDates.length; ++i)
        member.measureDates[i] = fit20.fetchFilters._date(member.measureDates[i]);
    return member;
  },
  memberMachineSettings : function(memberMachineSettings, memberId) {
    if (isUndefined(memberId)) throw("No memberId given to memberMachineSettings filter.");
    Object.keys(memberMachineSettings).filter(key => isNaN(key)).forEach(key => delete(memberMachineSettings[key]));
    memberMachineSettings.parentMemberId = memberId;
    return memberMachineSettings;
  }
}; // fit20.fetchFilters

/**
 * Configuration of the storage hierarchy for persisted items.
 * This maps a key in the store.state, which is also the key in localstorage, to an object containing:
 * {
 *   mutation: name of the mutation which stores the value.
 *   fetch: server API name to fetch the value from the database.
 *   fetchParams (optional): function with optional subkey parameter, which returns the API parameters for the fetch server API.
 *     If this function returns undefined, the fetch API is not called (see memberSessions).
 *   fetchFilter (optional): A filter-function that is applied to each result item.
 *   persist (optional): server API name to persist the value into the database.
 *     The mutation will be called on the result of the persist API.
 *   persistParams (optional): function which returns the API parameters for the persist server API.
 *     The persistParams function has the value to be persisted and the optional subkey as parameters.
 *     For most APIs, this should become the 'resource' property of the API parameters object.
 * }.
 */
fit20.storeConf = {
  fit20: {
    mutation: 'setFit20',
    fetch: 'getFit20'
  },
  machines: {
    mutation: 'setMachines',
    fetch: 'listMachine',
    fetchFilter: fit20.fetchFilters.machine
  },
  currentTrainer: {
    mutation: 'setCurrentTrainer',
    fetch: 'getTrainer', fetchParams: function() {
      return {studioId: id0(fit20.store.state.currentStudio), trainerId: fit20.store.state.currentTrainer.id};
    },
    fetchFilter: fit20.fetchFilters.trainer,
    persist: 'putTrainer', persistParams: function(trainer) {
      // Empty dates cause errors, so delete them.
      ['birthDate'].forEach(function(key){
        if (trainer[key] && trainer[key] == '') delete trainer[key];
      });
      return {studioId: id0(fit20.store.state.currentStudio), resource: trainer};
    }
  },
  studios: {
    mutation: 'setStudios',
    fetch: 'listStudio', fetchParams: function() {
      return {};
    }
  },
  currentStudio: {
    mutation: 'setCurrentStudio'
    // No fetch, set to one item from studios.
  },
  studioMachines: {
    mutation: 'setStudioMachines',
    fetch: 'listStudioMachine', fetchParams: function(studioId) {
      return {studioId: studioId || fit20.store.state.currentStudio.id}
    },
    fetchFilter: fit20.fetchFilters.machine
  },
  sensorGateway: {
    mutation: 'setCurrentStudioGatewayAddress',
    persist: 'setSensorGateway', persistParams: function(studio) {
      return {
        studioId: studio.id,
        sensorGatewayAddress: studio.gatewayIPAddress
      };
    }
  },
  studioMachineSettings: {
    mutation: 'setStudioMachineSettings',
    fetch: 'getStudioMachineSettings', fetchParams: function(studioId) {
      return {studioId: studioId || fit20.store.state.currentStudio.id};
    },
    persist: 'setStudioMachineSettings', persistParams: function(settings) {
      // Remove properties 'etag' and 'kind' which Google adds.
      //delete settings.etag;
      //delete settings.kind;
      return {studioId: id0(fit20.store.state.currentStudio), resource: {settings: settings}};
    }
  },
  members: {
    mutation: 'setMembers',
    fetch: 'listMember', fetchParams: function(studioId) {
      return {studioId: studioId || fit20.store.state.currentStudio.id, onlyActive: true};
    },
    fetchFilter: fit20.fetchFilters.member
  },
  memberSessions: {
    mutation: 'setMemberSessions',
    // Initially, 20 sessions are fetched. Every time you do fit20.get('memberSessions', true), 50 more sessions are fetched.
    fetch: 'listSession', fetchParams: function(memberId) {
      if (isEmpty(memberId)) return undefined;
      var toFetch = isEmpty(fit20.store.state.memberSessions[memberId]) ? 20 : 50 + fit20.store.state.memberSessions[memberId].length;
      fit20.log("* store Requesting fetch of "+toFetch+" sessions.");
      return {studioId: id0(fit20.store.state.currentStudio), memberId: memberId, offset: -toFetch};
    }
  },
  memberMachineSettings: {
    mutation: 'setMemberMachineSettings',
    fetch: 'machineSettings', fetchParams: function(memberId) {
      return {studioId: id0(fit20.store.state.currentStudio), memberId: memberId};
    },
    fetchFilter: fit20.fetchFilters.memberMachineSettings,
    persist: 'putMemberMachineSettings', persistParams: function(value, memberId) {
      if (!memberId) {
        throw "Application error in put('memberMachineSettings', "+JSON.stringify(value)+", "+memberId+"): Must have a memberId.";
      }
      // Make a copy of the settings, and delete a property that must remain in value.
      var settings = Object.assign({}, value);
      Object.keys(settings).filter(key => isNaN(key)).forEach(key => delete(settings[key]));
      delete settings.parentMemberId;
      // Remove properties 'etag' and 'kind' which Google adds.
      delete settings.etag;
      delete settings.kind;
      return {studioId: id0(fit20.store.state.currentStudio), memberId: memberId, resource: {settings: settings}};
    }
  },

  /*** The following keys are not in the store. Do not use them with fit20.get, only with fit20.put.
   *** They cannot have a fetch property, but a fetchFilter is allowed.
   ***/
  member: {
    mutation: 'setMember',
    fetchFilter: fit20.fetchFilters.member,
    persist: 'putMember', persistParams: function(member) {
      // Empty dates cause errors, so delete them.
      ['birthDate', 'membershipSince', 'membershipUntil', 'measureDate'].forEach(function(key){
        if (member[key] && member[key] == '') delete member[key];
      });
      return {studioId: id0(fit20.store.state.currentStudio), resource: member};
    }
  },
  memberSession: {
    mutation: 'setMemberSession',
    fetchFilter: fit20.fetchFilters.session, //  Used for the session returned by putSession.
    persist: 'putSession', persistParams: function(value) {
      var memberId = value.parentMemberId;
      if (!memberId) throw "Application error in put('memberSession', "+JSON.stringify(value)+"): Must have a parentMemberId.";
      return {studioId: fit20.store.state.currentStudio.id, memberId: memberId, resource: value};
    }
  },
  // Add a remark by calling fit20.put('addAim', {memberId: memberId, text: "..."});
  addRemark: {
    mutation: 'setMember',
    fetchFilter: fit20.fetchFilters.member,
    persist: 'addRemark', persistParams: function(value) {
      return {
        studioId: fit20.store.state.currentStudio.id, memberId: value.memberId,
        resource: {text: value.text}
      };
    }
  },
  addAim: {
    mutation: 'setMember',
    fetchFilter: fit20.fetchFilters.member,
    persist: 'addAim', persistParams: function(value) {
      return {
        studioId: fit20.store.state.currentStudio.id, memberId: value.memberId,
        resource: {text: value.text}
      };
    }
  },
  addResult: {
    mutation: 'setMember',
    fetchFilter: fit20.fetchFilters.member,
    persist: 'addResult', persistParams: function(value) {
      return {
        studioId: fit20.store.state.currentStudio.id, memberId: value.memberId,
        resource: {text: value.text}
      };
    }
  },
  // Change the remark with index i (starting at 0) by calling fit20.put('changeAim', {memberId: memberId, index: i, text: "..."});
  changeRemark: {
    mutation: 'setMember',
    fetchFilter: fit20.fetchFilters.member,
    persist: 'changeRemark', persistParams: function(value) {
      return {
        studioId: fit20.store.state.currentStudio.id, memberId: value.memberId,
        index: value.index, resource: {text: value.text}
      };
    }
  },
  changeAim: {
    mutation: 'setMember',
    fetchFilter: fit20.fetchFilters.member,
    persist: 'changeAim', persistParams: function(value) {
      return {
        studioId: fit20.store.state.currentStudio.id, memberId: value.memberId,
        index: value.index, resource: {text: value.text}
      };
    }
  },
  changeResult: {
    mutation: 'setMember',
    fetchFilter: fit20.fetchFilters.member,
    persist: 'changeResult', persistParams: function(value) {
      return {
        studioId: fit20.store.state.currentStudio.id, memberId: value.memberId,
        index: value.index, resource: {text: value.text}
      };
    }
  },
  sensorCalibration: {
    mutation: 'setMemberMachineSettings',
    persist: 'putSensorCalibration', persistParams: function(value) {
      var machineId = value.machineId;
      var memberId = value.memberId;
      delete value.machineId;
      delete value.memberId;
      value.inStudioId = id0(fit20.store.state.currentStudio);
      return {
        studioId: id0(fit20.store.state.currentStudio), memberId: memberId, machineId: machineId,
        resource: value
      };
    }
  },
  // Joining and splitting duos.
  joinDuoPartner: {
    mutation: 'duoChanged',
    persist: 'duoJoin', persistParams: function(memberId) {
      return {
        studioId: fit20.store.state.currentStudio.id,
        memberId1: memberId[0],
        memberId2: memberId[1]
      }
    }
  },
  splitDuoPartner: {
    mutation: 'duoChanged',
    persist: 'duoSplit', persistParams: function(memberId) {
      return {
        studioId: fit20.store.state.currentStudio.id,
        memberId: memberId
      }
    }
  },
  putMemberOnHold: {
    mutation: 'setMembers',
    fetchFilter: fit20.fetchFilters.member,
    persist: 'putMemberOnHold', persistParams: function(memberId) {
      return {
        studioId: fit20.store.state.currentStudio.id,
        memberId: memberId,
        onlyActive: false
      };
    }
  },
  addMemberToStudio: {
    mutation: 'setMembers',
    fetchFilter: fit20.fetchFilters.member,
    persist: 'addMemberToStudio', persistParams: function(memberId) {
      return {
        studioId: fit20.store.state.currentStudio.id,
        memberId: memberId,
        onlyActive: false
      };
    }
  },
  removeMemberFromStudio: {
    mutation: 'setMembers',
    fetchFilter: fit20.fetchFilters.member,
    persist: 'removeMemberFromStudio', persistParams: function(memberId) {
      return {
        studioId: fit20.store.state.currentStudio.id,
        memberId: memberId,
        onlyActive: false
      };
    }
  }
//  machine: {
//    persist: 'putMachine', persistParams: function(value) {
//      return {
//        resource: value
//      }
//    }
//  }
}; // fit20.storeConf

/**
 * Apply a fetch-filter to a result, if needed.
 */
fit20._applyFilter = function(filter, result, subkey) {
  if (Array.isArray(result)) {
    if (filter) {
      for (var i = 0; i < result.length; ++i) result[i] = filter(result[i], subkey);
    }
  } else {
    if (filter) {
      result = filter(result, subkey);
    }
  }
  return result;
}

/**
 * Make sure that a value is in the Vuex store, possibly getting it from the localstorage, or the server.
 * This may start a server-request. When the server request returns, the Vuex mutation is called.
 *   key: A key in storeConf (also in the Vuex store and localstorage).
 *     This may be a primitive value, which is the key,
 *     or a pair [key, subkey], where key is the key and subkey is the subkey into the store.
 *   refresh (optional): Get from the database, even if a value is present locally if this is true.
 *                       If this is a function, it will be called after the refresh (like a callback).
 * Returns a promise that resolves when the value is in the Vuex store.
 * Whenever possible, use the Vuex store to get the value reactively.
 */
fit20.get = function(key, refresh) {
  // Split key and subkey, if present.
  var subkey = undefined;
  if (Array.isArray(key)) {
    subkey = key[1];
    key = key[0];
  }
  if (refresh) {
    // If we do forced refresh, fetch from the server.
    fit20.log("* store Getting "+key+(subkey ? " / "+subkey : '')+" by forced refresh");
    var getPromise = fit20.fetch(fit20.storeConf[key], key, subkey).
      then(function(value){
        if (isUndefined(value)) fit20.log("! store fit20.get "+key+(subkey ? " / "+subkey : '')+" is undefined");
        if (typeof refresh === 'function') refresh(value);
        return value;
      });
    return getPromise;
  } else {
    // No forced refresh. First try to get the value from the Vuex store.
    var fromStore = (subkey && fit20.store.state[key]) ? fit20.store.state[key][subkey] : fit20.store.state[key];
    if (isDefined(fromStore)) {
      fit20.log("* store Getting "+key+(subkey ? " / "+subkey : '')+" already present in Vuex store: "+shallowStringify(fromStore));
      return Promise.resolve(fromStore);
    } else {
      // Try to get the value from localstorage.
      return fit20.getItem(key).then(function(fromLocal) {
        if (isDefined(subkey) && isDefined(fromLocal)) {
          fromLocal = fromLocal[subkey];
        }
        if (isDefined(fromLocal)) {
          fit20.log("* store Getting from localstorage: "+key+(subkey ? " / "+subkey : ''));
          // Put the value from localstorage in the Vuex store.
          fit20.store.commit(fit20.storeConf[key].mutation, fromLocal);
          return fromLocal;
        } else {
          fit20.log("* store Getting from database: "+key+(subkey ? " / "+subkey : ''));
          return fit20.fetch(fit20.storeConf[key], key, subkey);
        }
      });
    }
  }
};

/**
 * Fetch from the server and stores it in localstorage and the Vuex store.
 *   conf: A configuration as in fit20.storeConf.
 *   key: A key in storeConf (also in the Vuex store and localstorage).
 *   subkey (optional): Subkey into store, also parameter for the conf.fetchParams and fit20._applyFilters functions.
 * Returns a promise that resolves (with the value) when the fetch is complete.
 */
fit20.fetch = function(conf, key, subkey) {
  if (isUndefined(conf) || isUndefined(conf.fetch)) {
    fit20.log("!! store Error fetching "+key+(subkey ? " / "+subkey : '')+" with invalid conf="+JSON.stringify(conf));
    return Promise.reject('fit20.fetch: invalid conf');
  }
  // If the fetchParams is undefined, use empty parameters.
  var fetchParams = conf.fetchParams ? conf.fetchParams(subkey) : {};
  if (isUndefined(fetchParams)) {
    // Only fetch when fetchParams return value is defined.
    fit20.log("* store Nothing to fetch for "+key+(subkey ? " / "+subkey : ''));
    return Promise.resolve(null);
  } else if (!fit20._activeFetchRequests[key] || !fit20._activeFetchRequests[key][subkey]) {
    // Fetch the value from the database. This happens asynchronously.
    fit20.log(`> store Fetching ${key}${subkey ? " / "+subkey : ''} fetchParams=${JSON.stringify(fetchParams)} at ${Date()}`);
    // Use fit20._activeFetchRequests to prevent concurrent requests for the same object.
    if (!fit20._activeFetchRequests[key]) {
      fit20._activeFetchRequests[key] = {};
    }
    fit20._activeFetchRequests[key][subkey] = // Store the promise.
      fit20.callAPI(gapi.client.fit20[conf.fetch](fetchParams)).
        then(function(result){
          // Remove properties 'etag' and 'kind' which Google adds.
          delete result.etag;
          delete result.kind;
          // Filter and store the result.
          result = fit20._applyFilter(conf.fetchFilter, result, subkey);
          if (Array.isArray(result)) {
            fit20.log("< store Fetched "+key+(subkey ? " / "+subkey : '')+" fetchParams="+JSON.stringify(fetchParams)+" ("+result.length+" items)");
          } else {
            fit20.log("< store Fetched "+key+(subkey ? " / "+subkey : '')+" fetchParams="+JSON.stringify(fetchParams)+" ("+typeof(result)+")");
          }
          fit20.store.commit(conf.mutation, result);
          fit20._activeFetchRequests[key][subkey] = false;
          return result; // Resolve with the value.
        }).
        catch(function(error){
          var extendedError = "Error fetching "+key+(subkey ? " / "+subkey : '')+" fetchParams="+JSON.stringify(fetchParams)+": "+error;
          fit20.log("!! store "+extendedError);
          fit20._activeFetchRequests[key][subkey] = false;
          Promise.reject(`M9596: ${JSON.stringify(error)}\nM9698`); // Reject again.
        });
    return fit20._activeFetchRequests[key][subkey]; // The promise.
  } else {
    fit20.log("* store Fetch already in progress for "+key+(subkey ? " / "+subkey : ''));
    return fit20._activeFetchRequests[key][subkey]; // The promise that is fetching this value.
  }
};
// Object keeping track of active requests, to prevent multiple requests for the same object.
// During a request, fit20._activeFetchRequests[key][subkey] holds the promise that is doing the request.
fit20._activeFetchRequests = {};

/**
 * Make sure that a changed value is stored in Vuex, localstorage and the server.
 * This will call the mutation, so you don't need to do that before calling this function.
 *   key: A key in storeConf (and the Vuex store and localstorage).
 *   value: The value that must be stored.
 *   callback (optional): A function to execute after the value has been persisted.
 *     This function is called with the result of the web-service call as its first parameter,
 *     and a boolean indicating if an error occurred during persistence as its second parameter.
 *   subkey (optional): Subkey into store, also parameter for the conf.fetchParams and fit20._applyFilter functions.
 *   noBlock: if true, does *not* block the UI. Use with care, see #160.
 * Returns a promise that resolves with the result of the web-service call when the put request is complete,
 * or rejects when the put request failed.
 */
fit20.put = function(key, value, callback, subkey, noBlock) {
  // Clean the value, so that undefined properties don't upset the JSON parser.
  Object.keys(value).forEach(function(key){
    if (isUndefined(value[key])) delete value[key];
  });
  // Get the store configuration.
  var conf = fit20.storeConf[key];
  if (isUndefined(conf)) throw "fit20.storeConf["+key+"] is undefined.";
  // If persistence is possible, do it.
  if (conf.persist) {
    // Persist the value into the database. This happens asynchronously.
    var persistParams = conf.persistParams(value, subkey);
    fit20.log(`> store Persisting ${key}${subkey ? ' / '+subkey : ''} persistParams=${shortStringify(persistParams)} at ${Date()}`);
    fit20.app.startLoading(!noBlock); // Block UI when saving data. See #160.
    var putPromise = fit20.callAPI(gapi.client.fit20[conf.persist](persistParams)).
      then(function(result){
        fit20.app.stopLoading(!noBlock); // Unblock UI.
        fit20.log(`< store Persisted ${key}${subkey ? ' / '+subkey : ''}${result && result.id ? ' id='+result.id : ''}`);
        // The result must be the new value. Filter it if needed.
        result = fit20._applyFilter(conf.fetchFilter, result, subkey);
        // Set it using a mutation, so computed properties will be obtained from the server.
        if (isDefined(conf.mutation)) fit20.store.commit(conf.mutation, result);
        if (callback) callback(result, false);
        return result;
      }).
      catch(function(error){
        fit20.app.stopLoading(!noBlock); // Unblock UI.
        var message = `!! store Error (${JSON.stringify(error)}) persisting ${key}${subkey ? ' / '+subkey : ''} := ${JSON.stringify(value)}`;
        fit20.log(message);
        if (callback) callback(error, true);
        return Promise.reject(`M9590 ${error}`);
      });
    return putPromise;
  } else {
    // No persistence is defined.
    fit20.store.commit(conf.mutation, value);
    return Promise.resolve(value);
  }
};

/**
 * Clear all storage on the client.
 */
fit20.clearStores = function(continuation) {
  localforage.clear().then(function() {
    fit20.store.commit('RESET');
    fit20.log("* store localstorage is cleared.");
    if (continuation) continuation();
  }).catch(function(err) {
    // This code runs if there were any errors
    fit20.log("!! store Error clearing localstorage "+err);
  });
};

/**
 * Clear all storage and reload page, which will refresh the storage.
 */
fit20.refreshAll = function() {
  fit20.log("* store Refreshing all storage!");
  fit20.app.startLoading("L0104");
  fit20.clearStores(function(){
    fit20.log("* store Reloading page!");
    window.location.reload(true);
  });
};

/**
 * Load all permanently stored items.
 * Returns a promise.
 */
fit20.reloadStoreItems = function() {
  return fit20.get('fit20', true).then(function(){
    return fit20.get('machines', true);
  });
};

/**
 * Call a server API which is a Google Cloud Endpoint.
 *   api: An API call with parameters, constructed by the gapi object, such as:
 *     gapi.client.fit20.getTranslations({language: language})
 *   retry: True if we are retrying.
 * Returns a promise that resolves or rejects according to the result of the API call.
 */
fit20.callAPI = function(api, retry) {
  /*
   * If fit20.app.signedIn() then go on, otherwise try to log in first using fit20.app.signin().
   * However, sometimes the user is not signed in even if fit20.app.signedIn() is true.
   */
  var apiPromise = (fit20.app.signedIn() ? Promise.resolve() : fit20.app.signin()).
    then(function(){
      return new Promise(function(resolve, reject) {
        if (fit20.app.hasAPI()) {
          fit20.app.startLoading(false);
          // TODO: Replace callback by promise.then.
          api.execute(function(resp) {
            fit20.app.stopLoading(false);
            if (resp && !resp.code) {
              var result = resp.result;
              if (result.hasOwnProperty('items') && result.items instanceof Array) result = result.items;
              if (resolve) resolve(result);
            } else if (resp && resp.code == 401 && !retry) {
              // resp.code == 401 => not authenticated. Then user == null in CloudEndpointAPI/authorizedStudioTrainerForMember. But fit20.app.signedIn() is true.
              fit20.log(`! Requesting signin before retrying API call.`);
              fit20.app.signin().
              then(function(){
                fit20.log(`! Retrying API call.`);
                fit20.callAPI(api, 1).
                then(function(result){
                  if (resolve) resolve(result);
                }).
                catch(function(message){
                  if (reject) reject(message);
                });
              }).
              catch(function(message){
                fit20.log(`!! User is not authenticated: ${message}`);
                fit20.app.addAlert('error', 'M9502\n\nM9698');
                if (reject) reject(message);
              });
            } else if (resp && Math.floor(resp.code/100) == 4) {
              var message = fit20.callAPI.errorMessage(api, resp);
              if (reject) reject(message);
            } else if (resp && Math.floor(resp.code/100) == 5) {
              var message = fit20.callAPI.errorMessage(api, resp);
              fit20.app.addAlert('error', 'M9595\n '+message+' \nM9698');
              if (reject) reject(message);
            } else {
              var message = fit20.callAPI.errorMessage(api, resp);
              fit20.app.addAlert('error', 'M9697\n '+message+' (code '+resp.code+')\nM9594');
              if (reject) reject(message);
            }
          }); // api.execute
        } else {
          fit20.app.addAlert('error', 'M9502');
          fit20.log(`!! User is not authenticated or API is not available. API = ${JSON.stringify(api)}`);
          if (reject) reject('M9502');
        }
      }); // new Promise
    }); // then, apiPromise
  return apiPromise;
};

/**
 * Get an error message from an API call response.
 */
fit20.callAPI.errorMessage = function(api, resp) {
  var message = resp && (resp.message || (resp.error && resp.error.message));
  return message;
};

/**
 * Call an API that is not a Google Cloud Endpoint.
 * This is an extension of jQuery.ajax(uri, options).
 */
fit20.callAJAX = function(url, options) {
  fit20.app.startLoading(false);
  if (isUndefined(options.complete)) {
    options.complete = [];
  } else if (!Array.isArray(options.complete)) {
    options.complete = [options.complete];
  }
  options.complete.push(function(){fit20.app.stopLoading(false)});
  $.ajax(url, options);
}


/* Functions for detailed member data. */

fit20.memberStore = {

  /* When a member has changed, members and studios must be refreshed.
   * Do this after the member details have been put into the database.
   */
  memberHasChanged: function() {
    fit20.log("* store memberStore: memberHasChanged");
    fit20.get('members', true).then(function(){
      return fit20.get('studios', true);
    }).then(function(){
      fit20.app.vue.updateMemberTabs();
    });
  },

  /* Get member sessions and member machine settings, if they are not yet there.
   * memberId: The id of the member.
   * refresh: If true, ignore data that was already fetched.
   * Return a promise with no interesting data in it.
   */
  getAdditionalMemberData: function(memberId, refresh) {
    return (
        ( refresh || isUndefined(fit20.store.state.memberSessions) || isUndefined(fit20.store.state.memberSessions[memberId]) )
        ? fit20.get(['memberSessions', memberId]) : Promise.resolve()
      ).then(function() { return (
        ( refresh || isUndefined(fit20.store.state.memberMachineSettings) || isUndefined(fit20.store.state.memberMachineSettings[memberId]) )
        ? fit20.get(['memberMachineSettings', memberId]) : Promise.resolve()
      )});
  },

  /* Get details for a member and make sure that the details are present.
   * This uses locally stored details if available.
   * This also gets details for the duo-partner if it exists.
   * That is done when the member-details have arrived, because the duo-partner may have changed, unless options.asDuoPartner.
   *   memberId: The id of the member.
   *   options: {asDuoPartner}
   * Return a promise that resolves when the details have arrived.
   */
  getDetails: function(memberId, options) {
    options = options || {};
    var $memberPanel = $(`#memberPanel-${memberId}`);
    fit20.app.startLoading(true, $memberPanel); // Block UI
    // First try to get the value from the Vuex store.
    fit20.log("* fit20.memberStore getDetails starting for "+memberId);
    // getMemberDetails resolves when the details are present
    var getMemberDetails = Promise.resolve();
    var fromStore = fit20.store.state.members[memberId];
    if (isUndefined(fromStore) || !fromStore._complete) {
      // Try to get the value from localstorage.
      getMemberDetails = fit20.getItem('member').
      then(function(fromLocal) {
        if (isDefined(fromLocal)) {
          fromLocal = fromLocal[memberId];
        }
        if (isUndefined(fromLocal) || !fromLocal._complete) {
          fit20.log("* store Refreshing member details from server: "+memberId);
          return fit20.memberStore.refreshDetails(memberId);
        } else { // fromLocal is defined
          fit20.log("* store Refreshing member details from local storage: "+memberId);
          fit20.store.commit('setMember', fromLocal);
          return Promise.resolve();
        }
      });
    } else { // fromStore is defined
      fit20.log("* store No need to refresh member details: "+memberId);
    }
    var getDetailsPromise = getMemberDetails.then(function(){
      return fit20.memberStore.getAdditionalMemberData(memberId, false);
    }).then(function(result){
      fit20.app.stopLoading(true, $memberPanel); // Unblock UI
      var member = fit20.store.state.members[memberId];
      if (isUndefined(member)) {
        return Promise.reject(`No member found in store, for memberId=${memberId}`);
      }
      fit20.log(`* fit20.memberStore getDetails completed for ${memberId} (${member.fullName})`);
      // Fetch duo partner details if this was not already the duo partner.
      if (!options.asDuoPartner && member.duoPartner) {
        fit20.log(`* fit20.memberStore getDetails for duo partner of ${memberId} (${member.fullName})`);
        return fit20.memberStore.getDetails(member.duoPartner, {asDuoPartner: true});
      } else {
        return result;
      }
    }).catch(function(error){
      if (options.asDuoPartner) {
        fit20.app.addAlert('error', `M9070: ${error}\nM9698`);
      } else {
        fit20.app.addAlert('error', `M9596: ${error}\nM9698`);
      }
      fit20.log(`!! fit20.memberStore getDetails failed for ${memberId}: ${error}`);
      return undefined;
    });
    return getDetailsPromise;
  },

  /* Refresh member details from server.
   * This ignores the locally stored member details.
   * memberId: The id of the member.
   * Return a promise that resolves when details have been refreshed.
   */
  refreshDetails: function(memberId) {
    var $memberPanel = $(`#memberPanel-${memberId}`);
    fit20.app.startLoading(true, $memberPanel); // Block UI
    fit20.log("* fit20.memberStore refreshDetails: "+memberId);
    var conf = {
      mutation: 'setMember',
      fetchFilter: function(member) {
        // When all member data has been loaded, set _complete property.
        member._complete = true;
        return fit20.fetchFilters.member(member);
      },
      fetch: 'getMember', fetchParams: function(memberId) {
        return {studioId: id0(fit20.store.state.currentStudio), memberId: memberId}
      }
    };
    var refreshDetailsPromise = fit20.fetch(conf, 'members', memberId).then(function(){
      return fit20.memberStore.getAdditionalMemberData(memberId, true);
    }).catch(function(error){
      fit20.log(`!! fit20.memberStore refreshDetails failed for ${memberId} because ${error}`);
      return undefined;
    }).then(function(result){
      fit20.app.stopLoading(true, $memberPanel); // Unblock UI
      return result;
    });
    return refreshDetailsPromise;
  }

};

