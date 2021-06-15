/* Membersessions shows the past sessions, machines used and optionally the active session of a member. */

fit20.components.membersessions = {
  template: `
    <div class="member-sessions-panel pl-2">
      <div class="sessions">
        <table class="session-table">
          <tr>
            <!-- button to fetch more past sessions -->
            <td rowspan="999">
              <button type="button" class="btn btn-primary btn-block btn-icon" v-if="hasEarlierSessions" v-on:click="getEarlierSessions()">
                <i class="fa fa-backward pb-1"></i>
              </button>
            </td>
            <!-- past sessions -->
            <td v-for="session in sessions" class="head" @click="showSessionPopup(session)">
              <div class="date-col bg-secondary text-white text-center flex-column">
                <span>{{ session.date | dateFormat('short') }}</span>
                <span class="week">{{ $t('M0052', { week: getSessionWeek(session.date) }) }}</span>
                <!-- <span class="hasAbsent" v-if="session.absent"><i class="fas fa-user-times"></i></span> -->
              </div>
              <div class="nr-col text-white text-center">
                <span class="nr" :class="{ 'text-danger': session.absent || session.remark }">{{ session.number + member.nrPaperSessions }}</span>
                <span class="ti" :class="{ 'text-danger': session.absent || session.remark }">{{ session.trainerInitials }}</span>
                <!-- <span class="hasComment" v-if="session.remark"><i class="fas fa-exclamation-circle"></i></span> -->
              </div>
            </td>
          </tr>
          <tr v-for="machine in machines">
            <!-- past sessions -->
            <td v-for="session in sessions" class="data">
              <div class="exercise-col">
                <div v-for="exercise in exerciseFor(session, machine.id)"
                     class="row no-gutters"
                     :class="{ remark: exercise.remark }"
                     @click="showExerciseDetails(machine, exercise, session.date)"
                >
                  <div class="col-9 exercise-data-l">
                    <span class="weight">{{ exercise.weight }}</span><br>
                    <span class="time">{{ exercise.duration | showTime }}</span>
                  </div>
                  <div class="col-3 exercise-data-r">
                    <span class="order">{{ exercise.order }}</span>
                    <span class="change">{{ exercise.weightChange | weightChange }}</span>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </table>
      </div>
      <div class="machines">
        <div v-if="activeSession">
          <div class="absent-active" v-if="activeSession.absent"><h3>{{ $t('M0410') }}</h3></div>
        </div>
        <table class="session-table">
          <tr>
            <!-- active session -->
            <td v-if="activeSession" class="head member-active-session" @click="showSessionPopup(activeSession)">
              <div class="date-col bg-secondary text-white text-center flex-column">
                <span>{{ activeSession.date | dateFormat('short') }}</span>
                <span class="week">{{ $t('M0052', { week: getSessionWeek(activeSession.date) }) }}</span>
              </div>
              <div class="nr-col bg-primary text-white text-center">
                <div class="nr">{{ activeSession.number + member.nrPaperSessions }}</div>
                <span class="ti">{{ activeSession.trainerInitials }}</span>
              </div>
            </td>
            <!-- last column machine header = deselect machine (eraser) -->
            <td class="head" style="border: 1px solid transparent;">
              <!-- deselect machine -->
              <div v-if="activeSession && selectedMachineId && !isExerciseStarted" class="text-light h-100 text-center pt-1" @click="selectMachine(null)">
                <i class="h2 fas fa-eraser"></i>
              </div>
            </td>
          </tr>
          <tr v-for="machine in machines">
            <!-- active session machine -->
            <td v-if="activeSession" class="data member-active-session">
              <div class="exercise-col">
                <div v-for="exercise in exerciseFor(activeSession, machine.id)"
                     class="row no-gutters"
                     :class="{ remark: exercise.remark }"
                     @click="showExerciseDetails(machine, exercise, activeSession.date)"
                >
                  <div class="col-9 exercise-data-l">
                    <span class="weight">{{ exercise.weight || 0 }}</span><br>
                    <span class="time">{{ (exercise.duration || 0) | showTime }}</span>
                  </div>
                  <div class="col-3 exercise-data-r">
                    <span class="order">{{ exercise.order || '' }}</span>
                    <span class="change">{{ (exercise.weightChange || '') | weightChange }}</span>
                  </div>
                </div>
              </div>
            </td>
            <!-- machine -->
            <td :class="machineClass(machine)" class="studio-machine"
                @click="selectMachine(machine.id)"
            >
              <div class="machine-col row no-gutters">
                <div class="col-9"><span class="machine">{{ machine.name || '\u00A0' }}</span></div>
                <membermachinesettings class="settings col-3"
                  :memberId="memberId" :machine="machine" :remark="machineRemarks[machine.id]"
                  :adjustableSettings="adjustableSettings" :classes="['', '', 'd-none']"
                  :key="selectedMachineId"
                ></membermachinesettings>
              </div>
            </td>
          </tr>
        </table>
      </div>
      <memberexercisedetails
        :machine="exerciseMachine"
        :exercise="exerciseDetails"
        :date="exerciseDate"
        :id="exerciseId('exerciseDetails')"
      ></memberexercisedetails>
      <membersessionpopup
        :session="sessionEdit"
        :canedit="!this.activeSession"
        :id="sessionId('sessionPopup')"
        @editSession="editSession"
      >
      </membersessionpopup>
    </div><!-- .member-sessions-panel -->
  `,
  components: {
    membermachinesettings: fit20.components.membermachinesettings,
    memberexercisedetails: fit20.components.memberexercisedetails,
    membersessionpopup: fit20.components.membersessionpopup,
  },
  props: ['member', 'sessions', 'activeSession', 'selectedMachine', 'duoPartnerSelectedMachine', 'isExerciseStarted', 'adjustableSettings', 'machineRemarks'],
  data: function() {
    return {
      exerciseMachine: undefined, exerciseDetails: undefined, exerciseDate: undefined, // parameters for memberexercisedetails
      sessionEdit: {absent: false, date: new Date(), remark: undefined} // fake session to prevent undefined references
    }
  },
  computed: {
    memberId: function(){
      return this.member && this.member.id;
    },
    // Get a list of all machines from the current studio
    machines: function() {
      return fit20.store.state.studioMachines || [];
    },
    selectedMachineId: function() {
      return this.selectedMachine ? this.selectedMachine.id : undefined;
    },
    duoPartnerSelectedMachineId: function() {
      return this.duoPartnerSelectedMachine ? this.duoPartnerSelectedMachine.id : undefined;
    },
    hasEarlierSessions: function() {
      if (this.sessions && this.sessions.length > 0) {
        return this.sessions[0].number > 1;
      } else {
        return false;
      }
    }
  }, // computed
  methods: {
    exerciseId: function(id) {
      return id+(this.member && this.member.id);
    },
    showExerciseDetails: function(machine, exercise, sessionDate) {
      if (machine && exercise && sessionDate) {
        this.exerciseMachine = machine;
        this.exerciseDetails = exercise;
        this.exerciseDate = sessionDate;
        fit20.app.modal(this.exerciseId('exerciseDetails'));
      }
    },
    sessionId: function(id) {
      return id+'_'+(this.member && this.member.id);
    },
    showSessionPopup: function(session) {
      if(session) {
        this.sessionEdit = session;
        fit20.app.modal(this.sessionId('sessionPopup'));
      }
    },
    // exerciseFor returns a list of 0 or 1 element, containing the exercise for a machine in a session.
    exerciseFor: function(session, machineId) {
      var exercise = isDefined(session) && !isEmpty(session.exercises)
                     ? session.exercises.find(function(xrc){return xrc.machineId == machineId})
                     : undefined;
      return isDefined(exercise) ? [exercise] : [];
    },
    // hasBeenDone returns a boolean indicating if the exercise for a machine has been done in a session.
    hasBeenDone: function(session, machineId) {
      var exercise = isDefined(session) && !isEmpty(session.exercises)
                     ? session.exercises.find(function(xrc){return xrc.machineId == machineId})
                     : undefined;
      return isDefined(exercise) && isDefined(exercise.order) && exercise.order > 0;
    },
    // getEarlierSessions fetches more sessions from the database.
    getEarlierSessions: function() {
      fit20.get(['memberSessions', this.member.id], true);
    },
    // Edit a session by making it the active session.
    editSession: function(session) {
      if(!this.activeSession) {
        fit20.log(`* membersessions.editSession`);
        if (!(fit20.store.state.activeMemberSessions && fit20.store.state.activeMemberSessions[session.parentMemberId])) {
          fit20.store.commit('setActiveMemberSession', session);
        }
      }
    },
    selectMachine: function(machineId) {
      this.$emit('selectMachine', machineId);
    },
    // Return boolean indicating if the exercise can be done.
    exerciseOKforMember: function(machine) {
      return isUndefined(machine) || isUndefined(this.adjustableSettings[machine.id]) || isEmpty(this.adjustableSettings[machine.id]['^0001']);
    },
    getSessionWeek: function(sessionDate) {
      return getWeek(sessionDate);
    },
    machineClass: function(machine) {
      var hasBeenDone = this.hasBeenDone(this.activeSession, machine.id);
      return (machine.id == this.selectedMachineId) ? 'bg-emphasis' :
             (machine.id == this.duoPartnerSelectedMachineId) ? 'bg-light text-gray' :
             (!hasBeenDone) ? 'bg-light' :
             (hasBeenDone) ? 'bg-primary' :
             (!this.exerciseOKforMember(machine)) ? 'donot' :
             '';
    }
  }, // methods
  mounted: function() {
    $('.sessions, .machines', this.$el).syncScroll({vertical: true});
  }
}; // fit20.components.membersessions
