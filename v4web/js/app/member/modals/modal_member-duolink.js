/** Modal for joining and splitting duos. */
fit20.components.duojoinsplit= {
  template: `
    <modal @open="reset">
      <template #title>{{ $t('M0332') }}</template>
      <div class="container-fluid">
        <div class="row">
          <div class="col-12">
            <h5>{{ member.fullName }}</h5>
          </div>
        </div>
        <div class="form-group row">
          <div class="col-12">
            <label class="form-text">{{ $t('M0451 ') }}</label>
            <search-box v-model="memberFilter" class="mb-2"></search-box>
            <div class="duo-scroll">
              <label class="duo-partner"
                v-for="member in listMembers"
                v-if="notSelf(member.id)"
                v-show="filtered(member)"
              >
                <input type="radio"
                  name="duopicker"
                  class="switch_2"
                  :id="'duolink-'+member.id"
                  :value="member.id"
                  v-model="partnerId"
                >
                <span class="w-100">{{ member.fullName }}</span>
              </label>
            </div>
          </div>
        </div><!-- end of form-group -->
      </div>
      <div v-if="hasInvalidDuoPartner" class="alert alert-danger">{{ $t('M9070') }}</div>
      <template #controls>
        <button type="button" class="btn btn-primary"
          @click="duoJoin" data-dismiss="modal"
          v-if="partnerId && partnerId != oldPartnerId"
        >
          {{ $t('M0310') }}
        </button>
        <button type="button"class="btn btn-warning"
          @click="duoSplit" data-dismiss="modal"
          v-if="hasDuoPartner"
        >
          {{ $t('M0312') }}
        </button>
      </template>
    </modal>
  `,
  props: [ 'selectedMember', 'listMembers' ],
  data: function() {
    return {
      oldPartnerId: undefined,
      partnerId: undefined,
      isValidPartnerId: false,
	    memberFilter: ""
    }
  },
  methods: {
    reset: function() {
      var scope = this;
      Vue.nextTick(function(){
        scope.partnerId = scope.selectedMember ? scope.selectedMember.duoPartner : undefined;
        scope.oldPartnerId = scope.selectedMember ? scope.selectedMember.duoPartner : undefined;
        scope.isValidPartnerId = false;
        scope.memberFilter = "";
        if (scope.oldPartnerId) {
          var duoPartnerLabel = $('#duolink-'+scope.oldPartnerId).closest('label');
          if (duoPartnerLabel.length > 0) {
            scope.isValidPartnerId = true;
            duoPartnerLabel[0].scrollIntoView();
          }
        }
      });
    },
	  filtered: function(member) {
		  var filter = this.memberFilter.toLowerCase();
		  return member && (member.fullName.toLowerCase().indexOf(filter) >= 0);
	  },
	  closeDuoTabs: function() {
	    var oldPartnerIdOfNewPartner =
	      (this.partnerId && fit20.store.state.members && fit20.store.state.members[this.partnerId])
        ? fit20.store.state.members[this.partnerId].duoPartner : undefined;
	    fit20.app.vue.forgetMemberId(this.selectedMember.id);
      if (isDefined(this.oldPartnerId))
        fit20.app.vue.forgetMemberId(this.oldPartnerId);
      if (isDefined(this.partnerId))
        fit20.app.vue.forgetMemberId(this.partnerId);
      if (isDefined(oldPartnerIdOfNewPartner))
        fit20.app.vue.forgetMemberId(oldPartnerIdOfNewPartner);
	  },
    duoJoin: function() {
      var closeDuoTabs = this.closeDuoTabs; // JS scope :(
      fit20.put('joinDuoPartner', [this.selectedMember.id, this.partnerId], function(){
        closeDuoTabs();
      });
    },
    duoSplit: function() {
      var closeDuoTabs = this.closeDuoTabs; // JS scope :(
      fit20.put('splitDuoPartner', this.selectedMember.id, function(){
        closeDuoTabs();
      });
    },
    notSelf: function(memberId) {
      return this.member && memberId != this.member.id;
    }
  },
  computed: {
    member: function() {
      return this.selectedMember ? this.selectedMember : {};
    },
    hasDuoPartner: function() {
      return isDefined(this.selectedMember) && isDefined(this.selectedMember.duoPartner);
    },
    hasInvalidDuoPartner: function() {
      return this.hasDuoPartner && !this.isValidPartnerId && this.oldPartnerId == this.partnerId;
    }
  },
  watch: {
    'selectedMember' : function () {
      this.reset();
    }
  }
};
