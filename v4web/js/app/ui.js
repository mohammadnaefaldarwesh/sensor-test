"use strict";
/**
 * User interface.
 */

/** Define namespace. */
var fit20 = fit20 || {};
// fit20.app holds objects accessible throughout the app.
fit20.app = fit20.app || {};
// Components must add themselves to fit20.components before fit20.app.initUI, so Vue can find them.
fit20.components = fit20.components || {};

/**
 * Determine if the app needs an update.
 */
Vue.set(fit20, 'appNeedsUpdate', false);
fit20.app.needsUpdate = function() {
  fit20.callAPI(gapi.client.fit20.getAppVersion()).
  then(function(result){
    if (result.text != window.appVersion) {
      fit20.log(`! App needs update from ${window.appVersion} to ${result.text}`);
      fit20.app.addAlert('warning', 'L0101');
      Vue.set(fit20, 'appNeedsUpdate', true);
    }
  });
};

/**
 * Initialize the Vue object and other parts of the UI.
 * Returns a promise that resolves when the UI is ready.
 */
fit20.app.initUI = function() {
  fit20.log("* Creating UI");
  fit20.app.colors = getThemeColors();
  fit20.app.checkBrowserCapabilities();
  // Create and install the i18n plugin.
  var i18nPlugin = {
    'install': function(Vue, options) {
      Vue.prototype.$t = function(text, params, language) {return fit20.i18n.translate(text, params, language)}
    }
  };
  Vue.use(i18nPlugin);
  // Do asynchronous stuff in a promise.
  return new Promise(function(resolve, reject) {
    fit20.log("* Creating the Vue object");
    //Vue.config.devtools = location.host.startsWith('localhost') || location.host.indexOf('test') >= 0; //Important for devtools extension!

    fit20.app.vue = new Vue({
      'el': '#app',
      'store': fit20.store,
      'components': fit20.components,
      'data': {
        fit20 : fit20,
        selectedTabHref: '#studios', // at the start show the studios
        currentMemberIds : [],
        maxNrMemberTabs : 3
      }, // data

      'computed': {

        currentStudio: function() {
          return fit20.store.state.currentStudio;
        },

        currentMembers: function() {
          if (isDefined(this.currentMemberIds) && !isEmpty(fit20.store.state.members)) {
            return this.currentMemberIds.
              map(function(currentMemberId){
                return fit20.store.state.members[currentMemberId];
              }).
              // filter defined members, see #380, bug in index.jsp for member.id
              // A member who is removed from the studio may be temporarily undefined here.
              filter(function(mbr){
                return mbr;
              });
          } else {
            return [];
          }
        },

        // memberTabsDisplay is only needed for logging and debugging
        memberTabsDisplay: function() {
          var activeMemberSessions = fit20.store.state.activeMemberSessions || {};
          var activeSessionMembers = Object.values(activeMemberSessions).filter(isDefined).map(ssn => ssn.parentMemberId);
          return this.currentMembers.map(function(m){
              var activeSession = isDefined(activeMemberSessions[m.id]);
              return `${m.fullName} (${m.id})`+
                     ((m.duoPartner && fit20.store.state.members[m.duoPartner]) ? ` + ${fit20.store.state.members[m.duoPartner].fullName} (${m.duoPartner})` : '')+
                     ` [${activeSession ? 'o' : 'x'}]`;
            }).join(' , ') +
            ` | active sessions for ${activeSessionMembers.join(' , ')}`;
        }

      }, // computed

      'methods': {

        // map duo-partner-id to one of the current members, if there is one with this duo-parttner
        currentDuoPartner: function(duoPartnerId) {
          return this.currentMembers.
            find(function(m){
              return m.duoPartner && m.duoPartner == duoPartnerId
            });
        },

        // Is there a session going on?
        isInSession: function() {
          var activeSessions = fit20.store.state.activeMemberSessions ?
            Object.values(fit20.store.state.activeMemberSessions).filter(function(ssn){return isDefined(ssn)}) : [];
          return activeSessions.length > 0;
        }, // isInSession

        // Select a tab when user clicks on it.
        selectTab: function(href) {
          this.selectedTabHref = href;
        }, // selectTab

        // Select the studio tab, showing the members.
        selectStudioId: function(studioId) {
          this.selectedTabHref = '#members';
        },

        // Select a member tab.
        // This also works when memberId is the id of a duo partner that is in a tab that is already open.
        selectMemberId: function(memberId) {
          if (isUndefined(this.currentMemberIds)) this.currentMemberIds = [];
          // Only select a member if a new tab may be opened, or if the member tab is already open.
          // Maybe the memberId is a duo partner of a member in an open tab.
          var openedTabDuoPartner = this.currentDuoPartner(memberId);
          if (openedTabDuoPartner) {
            memberId = openedTabDuoPartner.id;
          } else if (!this.currentMemberIds.includes(memberId)) {
            // open a new tab if allowed
            if (this.currentMemberIds.length < this.maxNrMemberTabs) {
              fit20.log(`* selectMemberId opening new tab, id=${memberId}`);
              this.currentMemberIds.push(memberId);
            } else {
              fit20.log(`! selectMemberId cannot open new tab for id=${memberId}, ${this.currentMemberIds.length} open tabs, current members: [${this.memberTabsDisplay}]`);
              fit20.app.addAlert('info', 'M0065');
              return; // do not open a tab
            }
          }
          var scope = this;
          Vue.nextTick(function () {
            // do this when the DOM has been updated, so the member tab exists
            scope.selectedTabHref = '#member-tab-panel-'+memberId;
          })
          fit20.log(`* selectMemberId selected ${memberId}, current members: [${this.memberTabsDisplay}]`);
        }, // selectMemberId

        // ForgetMemberId removes the memberId from currentMemberIds and closes the corresponding tab.
        // It also closes any ongoing sessions.
        // This does not work for the member id of a duo partner.
        // Returns a promise which resolves when the tab has been closed.
        forgetMemberId: function(memberId) {
          if (isUndefined(this.currentMemberIds)) {
            this.currentMemberIds = [];
            return Promise.resolve('forgetMemberId: no open member tabs');
          } else if (this.currentMemberIds.includes(memberId)) {
            var scope = this;
            fit20.log(`* forgetMemberId closing tab, id=${memberId}`);
            // first switch to another tab
            this.selectedTabHref = isDefined(fit20.store.state.currentStudio) ? '#members' : '#studios';
            // then finish ongoing sessions
            var member_screen = this.$refs.tabpanels.$refs['member_screen_'+memberId][0];
            return (member_screen.cancelSession({force: true, tabClosing: true}).
              catch(function(error){
                var message = `Cannot cancel session for ${memberId}: ${error}`;
                debugger; // Find out what has happened.
                fit20.log(`!! ${message}`);
              }).
              then(function() {
                // then close the tab of this member
                var tabIndex = scope.currentMemberIds.indexOf(memberId);
                if (tabIndex >= 0) {
                  scope.currentMemberIds.splice(tabIndex, 1);
                }
                fit20.log(`* forgetMemberId closed tab, id=${memberId}, current members: [${scope.memberTabsDisplay}]`);
                return Promise.resolve(`forgetMemberId closed ${memberId}`);
              }));
          } else {
            return Promise.resolve(`forgetMemberId: open membertabs does not include ${memberId}`);
          }
        }, // forgetMemberId

        // Refresh the data of members who have an open tab.
        updateMemberTabs: function() {
          if (isUndefined(this.currentMemberIds)) {
            this.currentMemberIds = [];
          } else {
            fit20.log(`* updateMemberTabs current members: [${this.memberTabsDisplay}]`);
            // First remove undefined members (after removing a member from a studio)
            this.currentMemberIds = this.currentMemberIds.filter(function(mId){
              return isDefined(fit20.store.state.members[mId]);
            });
            // Then refresh the members in open tabs.
            this.currentMembers.
              forEach(function(member) {
                // getDetails also gets duo partner details
                fit20.memberStore.getDetails(member.id);
              });
          }
        }, // updateMemberTabs

        // Cancel ongoing sessions and close the corresponding member tabs.
        // This returns a promise, because switching off sensors takes time.
        closeAllMemberTabs: function() {
          var scope = this;
          var promise = Promise.resolve('start');
          this.currentMemberIds.forEach(function(memberId) {
            promise = promise.then(function(result) {
              fit20.log(`* closeAllMemberTabs will close ${memberId} after '${result}'`);
              return scope.forgetMemberId(memberId)
            });
          });
          // Give Vue time to re-render.
          return promise.then(function(){return Vue.nextTick();});
        } // closeAllMemberTabs

      }, // methods

      'mounted': function() {
        var scope = this;
        fit20.log("* Vue object mounted.");
        fit20.reloadStoreItems().then(function(){
          fit20.app.hasUI = true;
          fit20.app.updateUI('Vue object mounted');
          // Prevent accidentally leaving the page by showing a confirmation dialog. Note that 'beforeunload' does not work on iPad.
          window.addEventListener((fit20.app.usesipad ? 'pagehide' : 'beforeunload'), function(event) {
            if (scope.isInSession()) {
              // According to the specification, to show the confirmation dialog an event handler should call preventDefault() on the event.
              event.preventDefault();
              // However note that not all browsers support this method, and some instead require the event handler to implement one of two legacy methods: assigning a string to the event's returnValue property; returning a string from the event handler.
              event.returnValue = 'M9034';
            }
          });
          window.addEventListener("unload", function(event) {
            fit20.log('! User unloads window.');
            if (scope.isInSession()) {
              scope.closeAllMemberTabs();
            }
          });
          // Resolve after Vue object has been mounted.
          if (resolve) resolve();
        });
      } // mounted

    });
  });
}; // fit20.app.initUI
