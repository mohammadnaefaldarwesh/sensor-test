/* General information about a member. */

fit20.components.memberinfo = {
  template: `
    <div class="member-info-panel pl-2">
      <div class="d-flex flex-column">
        <div class="member-name">
          <h5 class="font-weight-bold word-break m-0 w-100">
          	<span class="name">{{ member.firstName }}</span>
          </h5>
        </div>
        <div class="member-lastname">
          <strong class="d-block text-secondary pb-2">{{ member.intercalation | appendIfNotEmpty('\xA0') }}{{ member.lastName }}</strong>
        </div>
      </div>
      <span class="alert alert-danger alert-small" v-if="member.daysToBirthday > -2 && member.daysToBirthday < 2">
          <span v-if="member.daysToBirthday == 0"><i class="fas fa-birthday-cake"></i><strong>{{ $t('M0321') }}</strong></span>
          <span v-if="member.daysToBirthday == 1"><i class="fas fa-birthday-cake"></i><strong>{{ $t('M0322') }}</strong></span>
          <span v-if="member.daysToBirthday == -1"><i class="fas fa-birthday-cake"></i><strong>{{ $t('M0324') }}</strong></span>
      </span>
      <span class="alert alert-warning alert-small" v-if="member.daysToBirthday > 1 && member.daysToBirthday < 14">
      	<strong>{{ $t('M0323', {days: member.daysToBirthday}) }}</strong>
      </span>
      <span class="alert alert-warning alert-small" v-if="member.daysToBirthday < -1 && member.daysToBirthday > -14">
      	<strong>{{ $t('M0325', {days: -member.daysToBirthday}) }}</strong>
      </span>
      <figure class="mt-2 mb-1 text-center" style="position:relative;" v-on:click="appModal(photoEditId)">
        <i class="fas fa-camera no-photo-icon"></i>
        <img :src="photoURI" class="memberPhoto">
      </figure>
      <span class="badge badge-light" v-if="member.age">{{ $t('M0302', {age: member.age ? member.age : ''}) }}</span>
      <div class="row no-gutters justify-content-between">
        <div class="col-12">
          <button type="button" class="btn btn-primary btn-icon"
              v-on:click="appModal(memberEditId)"
          >
            <i :class="memberIconClasses(member)[0]"></i>
          </button>
          <button type="button" class="btn btn-primary btn-icon"
              v-on:click="appModal(memberRemarksId)"
          >
            <i class="fas fa-comment-alt"></i>
          </button>
          <button type="button" class="btn btn-primary btn-icon"
            v-on:click="openReport"
          >
            <i class="fas fa-chart-line"></i>
          </button>
        </div>
        <div class="col-12 pt-2" v-if="activeSession">
          <label class="small" :for="makeId('sessionRemark')">{{ $t('M0816') }}</label>
          <textarea :id="makeId('sessionRemark')" v-model="activeSession.remark"></textarea>
        </div>
        <div class="col-12 pt-2 d-flex" v-if="canBeAbsent">
          <input type="checkbox" :id="makeId('absent')" class="switch_1" :checked="activeSession.absent" v-model="activeSession.absent">
          <label class="ml-2" :for="makeId('absent')">{{ $t('M0410') }}</label>
        </div>
        <div class="col-12" v-if="activeSession && activeSession.absent">
          <label class="small" :for="makeId('absentReason')">{{ $t('M0411') }}</label>
          <select name="absentReason" :id="makeId('absentReason')" v-model="activeSession.absentReason" class="custom-select">
            <option v-for="reason in absentReasons"
                :value="reason[0]"
                :selected="reason[0] == activeSession.absentReason ? 'selected': ''"
            >{{ $t(reason[0]) }}</option>
          </select>
        </div>
        <div class="col-12 pt-2">
          <span
            v-on:click="appModal(memberEditId)"
            class="alert alert-info alert-small"
            v-for="msg in member.messages"
            v-if="msg !== 'M0406'">
              {{ $t(msg) }}
          </span>
          <span
            v-on:click="appModal(photoEditId)"
            class="alert alert-info alert-small"
            v-for="msg in member.messages"
            v-if="msg === 'M0406'">
              {{ $t(msg) }}
          </span>
        </div>
      </div>
      <memberallremarks v-if="member" :member="member" :sessions="sessions" :id="memberRemarksId"></memberallremarks>
      <memberedit v-if="member" :member="member" :id="memberEditId" :ref="memberEditId"></memberedit>
      <membereditphoto v-if="member" :member="member" :id="photoEditId"></membereditphoto>
    </div>
  `,
  props: ['member', 'sessions', 'activeSession'],
  components: {
    'memberedit': fit20.components.memberedit,
    'memberallremarks': fit20.components.memberallremarks,
    'membereditphoto': fit20.components.membereditphoto
  },
  methods: {
    appModal : fit20.app.modal, // fit20 is not in scope in the template
    makeId: function(prefix) {
      return prefix+'_'+(this.member && this.member.id)
    },
    memberIconClasses: function(member) {
      return memberIconClasses(member);
    },
    openReport : function() {
      fit20.log(`Sending member progress report for ${this.member && this.member.fullName}`);
      var url = 'member-report/old/?studioId='+fit20.store.state.currentStudio.id+
      '&memberId='+this.member.id+"&language="+fit20.i18n.getLanguage()+'&access_token='+fit20.app.getAccessToken();
      if(!this.member.birthDate || !this.member.gender) {
        if(!this.member.birthDate) { fit20.app.addAlert('danger', 'M0404'); }
        if(!this.member.gender) { fit20.app.addAlert('danger', 'M9062'); }
      } else {
        if (!this.member.weight || this.member.weight <= 0 || !this.member.length || this.member.length <= 0) {
          if(confirm($t('M0717'))) {
            window.open(url, '_blank').focus();
          }
        } else {
          window.open(url, '_blank').focus();
        }
      }
    }
  }, // methods
  computed: {
    canBeAbsent: function() {
      // Remove exercises with duration == 0 to make this work properly.
      if (this.activeSession && this.activeSession.absent) {
        return true; // You can always undo absence.
      }
      return this.activeSession && this.activeSession.exercises &&
      ( this.activeSession.exercises.length == 0 || this.activeSession.exercises.every(function(ex){return ex.duration < 1}) );
    },
    absentReasons: function() {
      return fit20.i18n.absentReasons();
    },
    memberEditId: function() {
      return "member-edit-"+(this.member && this.member.id)
    },
    photoURI: function() {
      return isDefined(this.member) ? fit20.app.addAccessTokenNoCache(this.member.photoURI) : undefined;
    },
    photoEditId: function() {
      return "member-edit-photo-"+(this.member && this.member.id)
    },
    memberRemarksId: function() {
      return "member-remarks-"+(this.member && this.member.id)
    }
  } // computed
};
