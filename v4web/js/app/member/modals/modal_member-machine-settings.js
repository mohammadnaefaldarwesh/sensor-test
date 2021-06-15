/** Modal form to add a new member. */
fit20.components.editmembermachinesettings = {
  'template': `
    <modal v-if="member && machine" size="lg" @open="reset" @close="clear">
      <template #title>{{ $t('M0830', {machine: machine.name}) }}</template>
            <div class="container-fluid">
              <div class="row" v-for="(adjustable, index) in adjustables">
                <div class="col-12">
                  <div class="form-group row">
                    <label class="form-text col-4 px-2">{{ $t(adjustable.name) }}</label>
                    <label class="form-text col-2 px-2"><span v-if="!$t(adjustable.initial).startsWith('-')">({{ $t(adjustable.initial) }})</span></label>
                    <select class="custom-select form-control col-6 px-2" v-model="settings.values[index]">
                      <option value=""></option>
                      <option v-for="value in adjustable.values.split(' ')" :value="value">{{ $t(value) }}</option>
                    </select>
                  </div><!-- end of form-group -->
                </div><!-- col -->
              </div><!-- row -->
              <div class="row">
                {{ $t('M0814') }}
                <textarea v-model="settings.remark"></textarea>
              </div><!-- row -->
            </div><!-- container-fluid -->
      <template #controls>
            <button type="button" class="btn btn-primary" @click="putMemberMachineSettings" data-dismiss="modal">{{ $t('M0028') }}</button>
      </template>
    </modal>
  `,
  props: ['member', 'machine'],
  data: function() {
    return {
      settings: {values: [], remark:""}
    }
  },
  methods: {
    clear: function() {
      this.settings = {values: [], remark:""};
    },
    reset: function() {
      this.settings = this.originalSettings();
    },
    // Make a clone of the original settings.
    originalSettings: function() {
      if (this.member && this.machine) {
        var memberSettings = fit20.store.state.memberMachineSettings[this.member.id];
        var storedSettings = (isDefined(memberSettings) ? memberSettings[this.machine.id] : undefined) || {};
        // Make a copy of the settings, otherwise mmSettings interferes with the store.
        var mmSettings = {values: (Array.isArray(storedSettings.values) ? storedSettings.values.slice() : []), remark: storedSettings.remark};
        // The settings.values array must have enough elements, otherwise it cannot be the v-model for <select>.
        mmSettings.values = this.adjustables.map(function(adj, idx){return mmSettings.values[idx] || ''});
        return mmSettings;
      } else {
        return {values: [], remark:""};
      }
    },
    putMemberMachineSettings: function() {
      // The next lines trigger a reactive change which is also triggered by the mutation of the Vuex store.
      // This causes repeated requests to connect to the sensor.
      //Vue.set(fit20.store.state.memberMachineSettings[this.member.id], this.machine.id, this.settings);
      //Vue.set(fit20.store.state.memberMachineSettings, this.member.id, fit20.store.state.memberMachineSettings[this.member.id]);
      // So now we use a local variable 'mms' to pass on the settings.
      try {
        if (isDefined(this.machine.id)) {
          var mms = fit20.store.state.memberMachineSettings[this.member.id];
          mms[this.machine.id] = this.settings;
          fit20.put('memberMachineSettings', mms, undefined, this.member.id);
          this.$emit('settingsChanged');
        }
      } catch (error) {
        fit20.app.addAlert('error', `M9590 (${error})\nM9698`);
        fit20.log(`!! Problem in putMemberMachineSettings: ${error}\n  mms=${JSON.stringify(mms)}  this.machine=${JSON.stringify(this.machine)}`);
      }
    }
  }, // methods
  computed: {
    // adjustables : [ { initial, name, values : [] }, ... ]
    adjustables: function() {
      var machine = this.machine;
      if (machine && machine.adjustableInitials) {
        return machine.adjustableInitials.map(function(x, i){
          return {initial: x, name: machine.adjustableParts[i], values: machine.adjustableValues[i]};
        });
      } else {
        return [];
      }
    }
  }, // computed
  watch: {
    // The following should be done by @open.
    //'member' : function() {this.reset()},
    //'machine' : function() {this.reset()}
  }
};
