fit20.components.memberallremarks = {
  template: `
    <modal size="lg">
      <template #title>{{ $t('M0341', {name: member.fullName}) }}</template>
      <div class="allremarks container-fluid">
        <a href="" data-toggle="collapse" href="#CollapseR1" role="button" aria-expanded="false" aria-controls="collapseSessions">
          <h5 class="text-primary">{{ $t('M0284') }}</h5>
        </a>
        <div class="row collapse show" id="CollapseR1">
          <div class="col-12 ordered pb-3">
            <div v-for="(session, index) in sessionsWithRemarks" class="mb-1" :style="{ order: -index }">
              <h6 class="mb-0 d-inline-block"><strong>{{ $t('M0006') }} {{ session.number + member.nrPaperSessions }}</strong></h6>
              <p class="d-inline-block">({{ session.date | dateFormat('short') }})</p>
              <p class="d-inline-block">({{ session.trainerInitials }})</p>
              <p v-if="session.remark">{{ session.remark }}</p>
              <p v-if="session.absentReason"><span class="text-danger">{{ $t('M0408') | capitalize }}</span> {{ $t(session.absentReason) }}</p>
              <template v-for="exercise in session.exercises">
              <p v-if="exercise.remark">{{ machineName(exercise.machineId) }} - {{ exercise.remark }}</p>
              </template>
            </div>
          </div>
        </div>
        <a href="" data-toggle="collapse" href="#CollapseR2" role="button" aria-expanded="false" aria-controls="CollapseR2">
          <h5 class="text-primary">{{ $t('M0305') }}</h5>
        </a>
        <div class="row ordered flex-row pb-3 collapse show" id="CollapseR2">
          <div class="col-12" v-for="(remark, index) in member.remarks" :style="{ order: -index }">
            <p>{{ remark }}</p>
          </div>
        </div>
        <a href="" data-toggle="collapse" href="#CollapseR3" role="button" aria-expanded="false" aria-controls="CollapseR3">
          <h5 class="text-primary">{{ $t('M0306') }}</h5>
        </a>
        <div class="row ordered flex-row pb-3 collapse show" id="CollapseR3">
          <div class="col-12" v-for="(aim, index) in member.aims" :style="{ order: -index }">
             <p>{{ aim }}</p>
      		</div>
        </div>
        <a href="" data-toggle="collapse" href="#CollapseR4" role="button" aria-expanded="false" aria-controls="CollapseR4">
          <h5 class="text-primary">{{ $t('M0307') }}</h5>
        </a>
        <div class="row ordered flex-row pb-3 collapse show" id="CollapseR4">
          <div class="col-12" v-for="(result, index) in member.results" :style="{ order: -index }">
            <p>{{ result }}</p>
          </div>
        </div>
      </div>
    </modal>
  `,
  props: ['member', 'sessions'],
  methods: {
    machineName: function(machineId) {
      if (machineId) {
        var machine = this.listStudioMachines.filter(function(m){return m.id == machineId})[0];
        if (machine) {
          return machine.name;
        }
      }
    }
  },
  computed: {
    // Sessions are filtered to only if remarks are available in either
    // session.remark, session.exercises[i].remark or session.absentReason
    sessionsWithRemarks: function() {
      return isEmpty(this.sessions) ? [] :
	      this.sessions.filter(function(session) {
	        return session.remark || session.absentReason ||
		        !isEmpty(session.exercises) && session.exercises.some(function(session) {return !isEmpty(session.remark)});
	      });
    },
    // Get a list of all machines from the current studio
    listStudioMachines: function() {
      return fit20.store.state.studioMachines || [];
    }
  }
};
