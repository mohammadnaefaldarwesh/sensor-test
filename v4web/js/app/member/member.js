/**
 *  The member component holds the member and the duo-partner (if present).
 *  Keys in member-panels are probably needed to prevent re-rendering from scratch. See [https://vuejs.org/v2/api/#key].
 */

fit20.components.member = {
  template: `
    <article>
      <section class="d-flex flex-column">
        <member_panel v-if="hasMember"
          :ref="primaryMemberPanelRef"
          :key="primaryMemberPanelRef+'_key'"
          :member="primaryMember"
          :sessions="primaryMemberSessions"
          :activeSession="primaryMemberActiveSession"
          :duoPanel="duopartnerPanel"
          :class="{ 'duo-partner-top': hasDuoPartner }"
          @stopExercise="stopExercise"
        >
        </member_panel>
        <member_panel v-if="hasDuoPartner"
          :ref="duopartnerPanelRef"
          :key="duopartnerPanelRef+'_key'"
          :member="duoPartner"
          :sessions="duoPartnerSessions"
          :activeSession="duoPartnerActiveSession"
          :duoPanel="primaryMemberPanel"
          :class="{ 'duo-partner-bottom': hasDuoPartner }"
          @stopExercise="stopExercise"
        >
        </member_panel>
      </section>
      <trainercontrols :showtrainer="false" :key="primaryMemberPanelRef+'_controls_key'">
        <button v-if="hasActiveSession && runningExercises == 0" type="button" class="btn btn-primary btn-icon px-5" @click="saveSession">
          <i class="d-block fas fa-download pb-1"></i>
          {{ $t('M0005') }}
        </button>
        <button v-if="hasActiveSession && runningExercises == 0" type="button" class="btn btn-primary btn-icon" @click="cancelSession">
          <i class="d-block fas fa-trash pb-1"></i>
          {{ $t('M0025') }}
        </button>
        <div class="d-inline-flex">
          <div class="stopwatch border border-primary align-items-center"
            v-if="hasActiveSession"
            v-show="hasSelectedExercise"
          >
            <span class="stopwatch-display p-1" :class="{'text-warning': stopwatch.countDown}" style="width: 5rem">
              {{ stopwatch.display }}
            </span>
            <button type="button" class="btn btn-primary" @click="startExercise" v-if="startStopwatchAllowed">
              <i class="fa fa-play" aria-hidden="true"></i>
            </button>
          </div><!-- .stopwatch -->
        </div>
        <button v-if="canStartSession && ! hasActiveSession" type="button" class="btn btn-primary btn-icon" @click="startNewSession">
          <i class="d-block far fa-file-plus pb-1"></i>
          {{ $t('M0301') }}
        </button>
      </trainercontrols>
    </article>
  `,
  props: ['memberId'],

  components: {
    'member_panel': fit20.components.member_panel,
    'trainercontrols': fit20.components.trainercontrols
    // The stopwatch is now embedded, so we do not use the stopwatch component any more.
  },

  data: function() {
    return {
      // panels are kept in data because #396
      primaryMemberPanel: undefined,
      duopartnerPanel: undefined,
      sessionTimer: undefined,
      stopwatch: {
        startTime: undefined, // Time when stopwatch was started or re-started after pause.
        totalTimeMs: 0, // Time to add because of pausing or lead-in.
        timer: undefined, // The javascript interval timer.
        display: "0:00",
        countDown: false
      },
      canStartSession: false,
      tabClosing: false // Set to true to indicate that ongoing requests may fail.
    }
  },

  methods: {

    startNewSession: function() {
      fit20.log(`* Member startNewSession by ${this.trainer}`);
      if (this.hasMember) {
        if (this.primaryMemberLastSession && sameDate(new Date(), this.primaryMemberLastSession.date))  {
          fit20.store.commit('setActiveMemberSession', this.primaryMemberLastSession);
        } else {
          fit20.store.commit('setActiveMemberSession', this._newSession(this.primaryMember.id));
        }
        this.setSessionTimer();
      }
      if (this.hasDuoPartner) {
        if (this.duoPartnerLastSession && sameDate(new Date(), this.duoPartnerLastSession.date))  {
          fit20.store.commit('setActiveMemberSession',this.duoPartnerLastSession);
        } else {
          fit20.store.commit('setActiveMemberSession', this._newSession(this.duoPartner.id));
        }
      }
    }, // startNewSession

    _newSession: function(memberId) {
	    var sessions = fit20.store.state.memberSessions[memberId] || [];
      var newSession = {
          absent: false,
          number: isEmpty(sessions) ? 1 : sessions[sessions.length-1].number + 1,
          date : new Date(),
          exercises: [],
          parentMemberId: memberId
      };
      fit20.log("* New session for member "+memberId);
      return newSession;
    }, // _newSession

    setSessionTimer : function() {
      var scope = this;
      this.clearSessionTimer();
      this.sessionTimer = setTimeout(function(){
        fit20.app.addAlert('warning', $t('M9036', {name: scope.primaryMember.fullName}));
      }, 1200000);
    },

    clearSessionTimer : function(){
      if (isDefined(this.sessionTimer)) {
        clearTimeout(this.sessionTimer);
        this.sessionTimer = undefined;
      }
    },

    saveSession: function() {
      this.clearSessionTimer();
      fit20.log(`* Member saveSession by ${this.trainer}`);
      var scope = this;
      var runningRequests = []; // Contains the promises of the put requests.
      if (scope.hasMember && isDefined(scope.primaryMemberActiveSession)) {
        var memberPanel = scope.primaryMemberPanel;
        if (isUndefined(memberPanel)) {
          var message = scope.reportMemberPanelProblem('saveSession (primary member)');
          fit20.log(message);
          fit20.logServer(message, 'member.js fit20.components.member/saveSession primaryMember', 2);
          fit20.app.addAlert('error', `M9590 M9698 \n Session of ${scope.primaryMember.fullName} not found`);
        } else if (scope.primaryMemberActiveSession.absent && !scope.primaryMemberActiveSession.absentReason) {
          // Check if absentReason is selected. If not show warning.
          fit20.log("! saveSession failed: No selected absent reason for memberId="+this.memberId);
          fit20.app.addAlert('error', `M9590 M9515 (${scope.primaryMember.fullName})`);
          runningRequests.push(Promise.reject(`M9590 M9515 (${scope.primaryMember.fullName})`));
        } else {
          // Stop the active exercise and store the session.
          runningRequests.push(
            memberPanel.stopExercise({terminate: true, cause: 'saving session for memberId='+this.memberId}).
            then(function(){
              return fit20.put('memberSession', scope.primaryMemberActiveSession);
            }).
            catch(function(error){
              var message = '!! Error saving session, '+JSON.stringify(error);
              fit20.log(message);
              fit20.logServer(message, 'member.js fit20.components.member/saveSession', 2);
              return Promise.reject(error);
            })
          );
        }
      } else { // if scope.hasMember
        fit20.log(`! No member or active session in saveSession by ${this.trainer}`);
      }
      if (scope.hasDuoPartner && isDefined(scope.duoPartnerActiveSession)) {
	      var memberPanel = scope.duopartnerPanel;
        if (isUndefined(memberPanel)) {
          var message = scope.reportMemberPanelProblem('saveSession (duo partner)');
          fit20.log(message);
          fit20.logServer(message, 'member.js fit20.components.member/saveSession duoPartner', 2);
          fit20.app.addAlert('error', `M9590 M9698 \n session of ${scope.duoPartner.fullName} not found`);
        } else if (scope.duoPartnerActiveSession.absent && !scope.duoPartnerActiveSession.absentReason) {
          // Check if absentReason is selected. If not show warning.
          fit20.log("! saveSession failed: No selected absent reason for duo partner, memberId="+this.primaryMember.duoPartner);
          fit20.app.addAlert('error', `M9590 M9515 (${scope.duoPartner.fullName})`);
          runningRequests.push(Promise.reject(`M9590 M9515 (${scope.duoPartner.fullName})`));
        } else {
          runningRequests.push(
            memberPanel.stopExercise({terminate: true, cause: 'saving session for memberId='+this.primaryMember.duoPartner}).
            then(function(){
              return fit20.put('memberSession', scope.duoPartnerActiveSession);
            }).
            catch(function(error){
              var message = '!! Error saving session, '+JSON.stringify(error);
              fit20.log(message);
              fit20.logServer(message, 'member.js fit20.components.member/saveSession', 2);
              return Promise.reject(error);
            })
          );
        }
      } // if scope.hasDuoPartner
      // If saving the sessions succeeds, clear the active sessions.
      Promise.all(runningRequests).
      then(function(){
        fit20.log('* saveSession: Clear active session(s)');
        if (scope.hasMember){
          fit20.store.commit('setActiveMemberSession', scope.primaryMember.id);
        }
        if (scope.hasDuoPartner) {
          fit20.store.commit('setActiveMemberSession', scope.duoPartner.id);
        }
      }).
      catch(function(err){
        fit20.log(`!! saveSession failed: ${err}`);
        fit20.logServer(`Saving session failed: ${err}.`, 'member.js fit20.components.member/saveSession', 2);
      });
    }, // saveSession

    // Cancel the session(s) in this member screen.
    // Returns a promise, because stopping sensors may take time.
    cancelSession: function(options) {
      var scope = this;
      // One trainer said he did not see the confirm popup, so test if it exists first and be very careful.
      // When closing the window / tab, no confirm will be shown, so you must use the force.
      if (options && options.tabClosing) {
        scope.tabClosing = true;
      }
      var reallyCancel = options && options.force;
      if (!reallyCancel && isDefined(window.confirm) && window.confirm($t('M9031'))) {
        reallyCancel = true;
      }
      if (!reallyCancel) {
        return Promise.resolve();
      }
      // Now we can be sure that the trainer really wants this.
      this.clearSessionTimer();
      var scopeName = `${scope.primaryMember && scope.primaryMember.fullName} (${scope.primaryMember && scope.primaryMember.id})`;
      fit20.log(`* cancelSession ${scope.tabClosing ? 'closing tab' : ''} for ${scopeName}`);
      return (
        (scope.hasActiveSession && scope.hasMember
            ? scope._cancelSession(scope.primaryMemberPanel, scope.primaryMember)
            : Promise.resolve()).
        then(function() {
          return (scope.hasActiveSession && scope.hasDuoPartner ? scope._cancelSession(scope.duopartnerPanel, scope.duoPartner) : Promise.resolve());
        }).
        then(function() {
          fit20.log(`* cancelSession completed for ${scopeName}`);
          return Promise.resolve();
        }).
        catch(function(error) {
          debugger;
          var message = `!! cancelSession failed for ${scopeName}`;
          fit20.log(message);
          Promise.reject(message);
        })
      );
    }, // cancelSession

    // Stop the exercise completely for a member with the given memberPanel.
    // Returns a promise.
    _cancelSession: function (memberPanel, member) {
      var scope = this;
      var logMessage = `${scope.trainer} canceling session of ${member.fullName} (${member.id})`;
      fit20.log(`! ${logMessage}`);
      if (isUndefined(memberPanel)) {
        var message = this.reportMemberPanelProblem('_cancelSession');
        fit20.log(message);
        fit20.logServer(message, 'member.js fit20.components.member/cancelSession', 2);
        return Promise.reject(message);
      } else {
        return (
          memberPanel.stopExercise({terminate: true, cause: 'canceling session for member = '+member.fullName}).
          then(function(){
            fit20.log(`* cancelSession refreshing sessions for ${member.fullName}`);
            // Refresh the member's sessions from the database.
            fit20.store.commit('clearMemberSessions', member.id)
            return fit20.get(['memberSessions', member.id], true);
          }).
          then(function(){
            fit20.log(`* cancelSession un-setting active session for ${member.fullName}`);
            fit20.store.commit('setActiveMemberSession', member.id);
          }).
          catch(function(err){
            var message = `cancelSession failed to memberPanel.stopExercise for ${member.fullName}: ${err}`;
            fit20.log(`!! ${message}`);
            fit20.logServer(message, 'member.js fit20.components.member/cancelSession', 2);
          })
        );
      }
    },

    // startExercise is called when the start-button on the stopwatch is pressed.
    startExercise: function() {
      var scope = this;
      scope.clearSessionTimer();
      fit20.log(`* Member startExercise`);
      (fit20.sensors.active
        ? Promise.all([
            fit20.sensors.startExercise(scope.currentStudio.id, scope.primaryMember.id),
            (scope.hasDuoPartner ? fit20.sensors.startExercise(scope.currentStudio.id, scope.duoPartner.id) : Promise.resolve())
          ])
        : Promise.resolve()
      ).
      catch(function(error){
        fit20.log(`!! Member startExercise error when starting sensors: ${error}`);
      }).
      then(function(){
        scope.startStopwatch();
        if (scope.primaryMemberPanel && scope.primaryMemberPanel.selectedExercise) {
          scope.primaryMemberPanel.startExercise();
        }
        if (scope.duopartnerPanel && scope.duopartnerPanel.selectedExercise) {
          scope.duopartnerPanel.startExercise();
        }
      });
    }, // startExercise

    // StopExercise is called when an exercise (of the primary member or duo partner) stops.
    stopExercise: function(member, exercise) {
      fit20.log(`* Member stopExercise for ${member.fullName}, ${this.runningExercises} exercises still running`);
      if (this.runningExercises == 0) {
        // Reset the stopwatch. If it has not been started, there is no timer.
        if (this.stopwatch.timer) {
          fit20.log(`⏱ stopwatch ${this.stopwatch.timer} stopping at ${this.stopwatch.startTime}+${this.stopwatch.totalTimeMs}`);
          clearInterval(this.stopwatch.timer);
          this.stopwatch.startTime = undefined;
          this.stopwatch.totalTimeMs = 0;
          this.stopwatch.timer = undefined;
          // Show 0:00, because exercises have stopped.
          this.showStopwatchTime();
        }
      }
    }, // stopExercise

    startStopwatch: function(startMillis) {
      // Add lead-in to stopwatch.
      this.stopwatch.totalTimeMs = 1000 * fit20.sensors.leadInSeconds;
      this.stopwatch.startTime = isDefined(startMillis) ? startMillis : Date.now();
      // Show the stopwatch every tenth of a second.
      this.stopwatch.timer = setInterval(this.showStopwatchTime, 100);
      this.showStopwatchTime();
      fit20.log(`⏱ stopwatch ${this.stopwatch.timer} started at ${this.stopwatch.startTime}+(${this.stopwatch.totalTimeMs}) = `+
          (this.stopwatch.startTime + this.stopwatch.totalTimeMs));
    },

    // Get the duration of the stopwatch in seconds, if the stopwatch is running.
    getStopwatchDuration: function() {
      var sw = this.stopwatch;
      var totalTimeSec = Math.floor((sw.startTime ? Date.now() - sw.startTime + sw.totalTimeMs : sw.totalTimeMs) / 1000);
      return totalTimeSec;
    }, // getStopwatchDuration

    showStopwatchTime: function(){
      var duration = this.getStopwatchDuration();
      Vue.set(this.stopwatch, 'display', showTime(duration));
      Vue.set(this.stopwatch, 'countDown', duration < 0);
    }, // showStopwatchTime

    _primaryMemberPanel: function() {
      // Previously also checked  && Object.keys(this.$refs).length > 0
      var shouldHavePanel = !this.tabClosing && isDefined(this.memberId) && isDefined(this.primaryMember);
      var panel = shouldHavePanel ? this.$refs[this.primaryMemberPanelRef] : undefined;
      if (shouldHavePanel && isUndefined(panel)) {
        fit20.log(`! Panel is undefined for primary member; ref = ${this.primaryMemberPanelRef}`);
        fit20.logServer(this.reportMemberPanelProblem('_primaryMemberPanel'), 'member.js primaryMemberPanel', 2);
      } else {
        var okay = shouldHavePanel ? isDefined(panel) : isUndefined(panel);
        fit20.log(`* Panel is ${panel ? 'set' : 'unset'} ${okay ? 'OK' : 'KO'} for primary member; ref = ${this.primaryMemberPanelRef}; this.tabClosing = ${this.tabClosing}`);
      }
      return panel;
    },

    _duopartnerPanel: function() {
      // Previously also checked  && Object.keys(this.$refs).length > 0
      var shouldHavePanel = !this.tabClosing && isDefined(this.memberId) && isDefined(this.duoPartner);
      var panel = shouldHavePanel ? this.$refs[this.duopartnerPanelRef] : undefined;
      if (shouldHavePanel && isUndefined(panel)) {
        fit20.log(`! Panel is undefined for duo partner; ref = ${this.duopartnerPanelRef}`);
        fit20.logServer(this.reportMemberPanelProblem('_duopartnerPanel'), 'member.js duopartnerPanel', 2);
      } else {
        var okay = shouldHavePanel ? isDefined(panel) : isUndefined(panel);
        fit20.log(`* Panel is ${panel ? 'set' : 'unset'} ${okay ? 'OK' : 'KO'} for duo partner; ref = ${this.duopartnerPanelRef}; this.tabClosing = ${this.tabClosing}`);
      }
      return panel;
    },

    reportMemberPanelProblem : function(where) {
      var scope = this;
      debugger;
      var report = `!! member-panel problem reported from ${where}.\n`;
      try {
        if (scope.hasMember) {
          if (isUndefined(scope.primaryMemberPanel)) {
            report += `!! No memberPanel is associated with the session of ${scope.primaryMember.fullName} with primaryMemberPanelRef=${scope.primaryMemberPanelRef}.\n`
          }
        }
        if (scope.hasDuoPartner) {
          if (isUndefined(scope.duopartnerPanel)) {
            report += `!! No memberPanel is associated with the session of ${scope.duoPartner.fullName} with duopartnerPanelRef=${scope.duopartnerPanelRef}.\n`;
          }
        }
        report += `!! Keys in $refs are [${Object.keys(this.$refs).join(', ')}]\n`;
      } catch (ex) {
        report += `!! Exception in reportMemberPanelProblem: ${ex}\n`;
      }
      return report;
    } // reportMemberPanelProblem

  }, // methods

  computed: {
    currentStudio: function() {
      return fit20.store.state.currentStudio;
    },
    primaryMemberPanelRef: function() {
      return 'member_panel_'+(this.primaryMember ? this.primaryMember.id : Math.random().toString());
    },
    duopartnerPanelRef: function() {
      return 'member_panel_'+(this.duoPartner ? this.duoPartner.id : Math.random().toString())
    },
    hasMember: function() {
      return isDefined(this.primaryMember);
    },
    hasDuoPartner: function() {
      return isDefined(this.duoPartner);
    },
    primaryMember: function() {
      return (this.memberId && fit20.store.state.members)
             ? fit20.store.state.members[this.memberId] : undefined;
    },
    primaryMemberSessions: function() {
      return (this.memberId && fit20.store.state.memberSessions)
             ? (fit20.store.state.memberSessions[this.memberId] || []) : [];
    },
    primaryMemberLastSession: function() {
      return (this.primaryMemberSessions && this.primaryMemberSessions.length > 0)
             ? this.primaryMemberSessions[this.primaryMemberSessions.length-1] : undefined;
    },
    primaryMemberActiveSession: function() {
      return (this.primaryMember && fit20.store.state.activeMemberSessions)
             ? fit20.store.state.activeMemberSessions[this.primaryMember.id] : undefined;
    },
    duoPartner: function() {
      return (this.primaryMember && this.primaryMember.duoPartner && fit20.store.state.members)
             ? fit20.store.state.members[this.primaryMember.duoPartner] : undefined;
    },
    duoPartnerSessions: function() {
      return (this.primaryMember && this.primaryMember.duoPartner && fit20.store.state.memberSessions)
             ? (fit20.store.state.memberSessions[this.primaryMember.duoPartner] || []) : [];
    },
    duoPartnerLastSession: function() {
      return (this.duoPartnerSessions && this.duoPartnerSessions.length > 0)
             ? this.duoPartnerSessions[this.duoPartnerSessions.length-1] : undefined;
    },
    duoPartnerActiveSession: function() {
      return (this.duoPartner && fit20.store.state.activeMemberSessions)
             ? fit20.store.state.activeMemberSessions[this.duoPartner.id] : undefined;
    },
    hasActiveSession: function() {
      var hasActiveSession = isDefined(this.primaryMemberActiveSession) || isDefined(this.duoPartnerActiveSession);
      fit20.log(`* hasActiveSession = ${hasActiveSession} `+
                `(${this.hasMember && this.primaryMember.fullName}:${isDefined(this.primaryMemberActiveSession)} ||` +
                ` ${this.hasDuoPartner && this.duoPartner.fullName}:${isDefined(this.duoPartnerActiveSession)})`);
      return hasActiveSession;
    },
    hasSelectedExercise: function() {
      var hasSelectedExercise = isDefined( this.primaryMemberPanel && this.primaryMemberPanel.selectedExercise ) ||
                                isDefined( this.duopartnerPanel && this.duopartnerPanel.selectedExercise );
      fit20.log(`* hasSelectedExercise = ${hasSelectedExercise} `+
                `(${this.hasMember && this.primaryMember.fullName}: panel=${isDefined(this.primaryMemberPanel)} && exercise=${isDefined(this.primaryMemberPanel && this.primaryMemberPanel.selectedExercise)} ||` +
                ` ${this.hasDuoPartner && this.duoPartner.fullName}: panel=${isDefined(this.duopartnerPanel)} && exercise=${isDefined(this.duopartnerPanel && this.duopartnerPanel.selectedExercise)})`);
      return hasSelectedExercise;
    },
    runningExercises: function() {
      return ( this.primaryMemberPanel && this.primaryMemberPanel.isExerciseStarted ? 1 : 0 ) +
             ( this.duopartnerPanel && this.duopartnerPanel.isExerciseStarted ? 1 : 0 );
    },
    startStopwatchAllowed: function() {
      return !( this.primaryMemberPanel && this.primaryMemberPanel.isExerciseActive ) &&
             !( this.duopartnerPanel && this.duopartnerPanel.isExerciseActive );
    },
    trainer: function() {
      return fit20.app.userInfo.name;
    }
  }, // computed

  //  beforeDestroy: function(){ // Because of #396
  //    var pmName = this.primaryMember.fullName;
  //    console.info(`Destroying member panel for ${this.primaryMember.fullName}`);
  //  },
  mounted: function() {
    fit20.log(`* Mounting member panel for ${this.primaryMember.fullName} (${this.memberId})`); // Because of #396
    var scope = this;
    // canStartSession becomes true when all member details and sessions are loaded.
    scope.canStartSession = false;
    scope.tabClosing = false;
    if (scope.memberId) {
      scope.$nextTick(function(){
        // getDetails also gets duo partner details
        fit20.memberStore.getDetails(scope.memberId).then(function() {
          scope.$nextTick(function(){
            scope.primaryMemberPanel = scope._primaryMemberPanel();
            scope.duopartnerPanel = scope._duopartnerPanel();
            // It is possible that the trainer has already closed the member tab.
            if (!scope.tabClosing) {
              if (isDefined(scope.memberId) && isUndefined(scope.primaryMemberPanel)) {
                fit20.logServer(this.reportMemberPanelProblem('mounted/primaryMemberPanel'), 'member.js duopartnerPanel', 2);
                fit20.log(`!! Member panel problem for primary member has been reported to server.`);
                fit20.app.addAlert('error', 'M9111');
              }
              if (isDefined(scope.duoPartner) && isUndefined(scope.duopartnerPanel)) {
                fit20.logServer(this.reportMemberPanelProblem('mounted/duopartnerPanel'), 'member.js duopartnerPanel', 2);
                fit20.log(`!! Member panel problem for duo partner has been reported to server.`);
                fit20.app.addAlert('error', 'M9111');
              }
              scope.canStartSession = true;
            }
          }); // nextTick
        }); // then
      }); // nextTick
    } // if scope.memberId
  } // mounted
}; // fit20.components.member
