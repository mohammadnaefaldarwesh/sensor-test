/* Machine-settings for a member and machine. */

fit20.components.membermachinesettings = {
  template: `
    <div class="membermachine d-flex">
      <div class="settings">
        <div class="d-table-row" v-for="adjustableInitial in adjustableInitials">
          <span class="d-table-cell">{{ $t(adjustableInitial) }}:</span>
          <span class="d-table-cell">{{ adjustableValues && adjustableValues[adjustableInitial] || '--' }}</span>
        </div>
        <div class="d-table-row">
          <span class="d-table-cell">
            <span v-if="exerciseOKforMember" :class="sensorStatus"></span>
            <span v-else=""class="text-danger"><i class="fas fa-ban"></i></span>
          </span>
          <span v-if="remark" class="ml-1 text-danger"><i class="fas fa-exclamation-triangle"></i></span>
        </div>
      </div>
    </div>
  `,
  // classes: classes for sensor used / not used / undefined
  props: ['memberId', 'machine', 'remark', 'adjustableSettings', 'classes'],
  computed: {
    adjustableInitials: function() {
      return (this.machine && this.machine.adjustableInitials) ? this.machine.adjustableInitials.filter(function(x){return !$t(x).startsWith('-')}) : [];
    },
    adjustableValues: function() {
      return this.adjustableSettings && this.machine && this.adjustableSettings[this.machine.id];
    },
    exerciseOKforMember: function() {
      return isUndefined(this.adjustableSettings[this.machine.id]) ||
             isEmpty(this.adjustableSettings[this.machine.id]['^0001']);
    },
    sensorStatus: function() {
      if (isUndefined(this.machine) || isUndefined(this.machine.adjustableInitials) || this.machine.adjustableInitials.indexOf('^0081') < 0) {
        return 'd-none';
      } else if (isUndefined(this.adjustableSettings) || isUndefined(this.adjustableSettings[this.machine.id])) {
        return this.classes[2] ? 'icon icon-no-sensor '+this.classes[2] : 'd-none';
      } else if (this.adjustableSettings[this.machine.id]['^0081'] === 'M0030') {
        return 'icon icon-sensor '+this.classes[0];
      } else if (this.adjustableSettings[this.machine.id]['^0081'] === 'M0031') {
        return 'icon icon-no-sensor '+this.classes[1];
      } else {
        return this.classes[2] ? 'icon icon-no-sensor '+this.classes[2] : 'd-none';
      }
    }
  }
}; // fit20.components.membermachinesettings
