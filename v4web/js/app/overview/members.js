fit20.components.members = {
  template: `
    <article>
      <header class="container-fluid py-2">
        <div class="row no-gutters">
          <div class="col-4">
            <search-box v-model="memberFilter"></search-box>
          </div>
          <div class="col-6 pl-2">
            <div class="checkbox">
              <input type="checkbox" class="switch_1 ml-2" id="includeOnHoldMembersInput" v-model="includeOnHoldMembers">
              <label for="includeOnHoldMembersInput">{{ $t('M0021') }} {{ $t('M0089') }}</label>
              <input type="checkbox" class="switch_1 ml-4" id="orderByLastName" v-model="orderByLastName">
              <label for="orderByLastName">{{ $t('M0027') }} {{ $t('M0320') }}</label>
            </div>
          </div>
          <div class="col-2 text-right badges">
            <div class="badge-group ml-2 flex-0">
              <span class="badge badge-primary w-100">{{ countOnHoldMembers+countSoloMembers+countDuoMembers }} <i class="fa fa-users"></i></span>
              <span class="badge w-100" :class="includeOnHoldMembers ? 'badge-primary' : 'badge-secondary'">{{ countOnHoldMembers }} <i class="fa fa-user-clock"></i></span>
            </div>
            <div class="badge-group ml-2 flex-0">
              <span class="badge badge-primary w-100">{{ countSoloMembers }} <i class="fa fa-user"></i></span>
              <span class="badge badge-primary w-100">{{ countDuoMembers }} <i class="fa fa-user-friends"></i></span>
            </div>
          </div>
        </div>
        <div class="row" v-if="countMembers < 1">
          <div class="card-holder empty-indicator ifUI ifSignedIn">{{ $t('M0091') }}</div>
        </div>
      </header>
      <section class="pt-2 d-flex flex-row">
        <div class="container-fluid scrollable">
          <div class="row custom-gutters" v-if="membersNotLoaded">{{ $t('L0104') }}</div>
          <div id="member-list" class="row card-gutters members">
            <div v-for="member in listVisibleMembers"
                :id="'member-'+member.id"
                class="card-holder"
                :title="member.id"
            >
              <div class="card" v-bind:class="{ inactive: !member.active }">
                <div class="user" v-on:click="selectMember(member)">
                  <figure>
                    <img v-bind:src="member.thumbnail" alt="">
                  </figure>
                  <div class="name">
                    <h5 class="card-title">{{ member.firstName || '\xA0' }}</h5>
                    <h6 class="card-subtitle">{{ member.intercalation | appendIfNotEmpty('\xA0') }}{{ member.lastName || '\xA0' }}</h6>
                  </div>
                </div>
                <div class="status" v-on:click="duoJoinSplit(member)">
                  <i style="font-size: 150%" :class="memberIconClasses(member)"></i>
                  <div class="duo-name" v-if="member.duoPartner">
                    {{ duoPartnerName(member) || '\xA0' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <alphabetscroll :list="listVisibleMembers" :itemToName="itemToSortName" @scrollTo="scrollTo"></alphabetscroll>
      </section>
      <trainercontrols :showtrainer="true">
        <button
          type="button"
          class="btn ifSignedIn"
          :class="[sensorStatusClass]"
          @click="sensorPopup"
        >
          <span class="icon icon-sensor"></span>
        </button>
        <button
          type="button"
          class="btn btn-primary ifSignedIn"
          v-on:click="addMember()"
        >
          <i class="fas fa-user-plus"></i>
          <div class="small">{{ $t('M0212') }}</div>
        </button>
      </trainercontrols>
      <duojoinsplit :selectedMember="selectedMember" :listMembers="listActiveMembers" id="duo-form"></duojoinsplit>
      <memberedit :member="undefined" id="newmember-form" :ref="newMemberRef" @memberStored="selectMember"></memberedit>
      <component :is="sensorconnect" :studio="studio" id="sensor-connect-popup"></component>
    </article>
  `,

  components: {
    'memberedit': fit20.components.memberedit,
    'duojoinsplit': fit20.components.duojoinsplit,
    'alphabetscroll': fit20.components.alphabetscroll,
    'trainercontrols': fit20.components.trainercontrols,
  },

  props: ['studio', 'sensorconnect'],

  data: function() {
    return {
      memberFilter: "",
      includeOnHoldMembers: false,
      orderByLastName: false,
      countSoloMembers: 0,
      countDuoMembers: 0,
      countOnHoldMembers: 0,
      selectedMember: undefined,
    };
  },

  methods: {
    sensorPopup: function() {
      fit20.app.modal('sensor-connect-popup');
    },
    duoPartnerInStudio: function(member) {
      var partnerId = member && member.duoPartner;
      if (partnerId) {
        return this.listActiveMembers.filter(function(m){return m.id == partnerId})[0];
      } else {
        return undefined;
      }
    },
    duoPartnerName: function(member) {
      var partner = this.duoPartnerInStudio(member);
      if (partner) {
        return partner.firstName;
      } else {
        return $t('M9070');
      }
    },
    memberIconClasses: function(member) {
      if (member && member.duoPartner && isUndefined(this.duoPartnerInStudio(member))) {
        return ['text-danger'].concat(memberIconClasses(member));
      } else {
        return memberIconClasses(member);
      }
    },
    // The member parameter is an incomplete member object. Use its id to fetch the complete data.
    selectMember: function(member) {
      fit20.log(`* Selecting member ${member.fullName} (${member.id}) ${member.duoPartner ? 'with' : 'without'} duo-partner`);
    	fit20.app.vue.selectMemberId(member.id);
    },
    addMember: function() {
      fit20.app.modal('newmember-form');
    },
    duoJoinSplit: function(member) {
      this.selectedMember = member;
      fit20.app.modal('duo-form');
    },
    itemToSortName: function(member) {
      return this.orderByLastName ? member.lastName : member.firstName;
    },
    scrollTo: function(member) {
      try { // This has caused nasty errors, like TypeError: undefined is not an object (evaluating '$scrollTo.offset().top')
        var $scrollTo = $('#member-'+member.id);
        var $scrollable = $scrollTo.closest('section').children('.scrollable');
        $scrollable.animate({scrollTop : $scrollTo.offset().top - $scrollable.offset().top + $scrollable.scrollTop()}, 500);
      } catch (error) {
        debugger;
        fit20.log(`!! Error in members.scrollTo: ${error}`);
      }
    }
  }, // methods

  computed: {
    newMemberRef: function(){
      return 'new_member_'+Math.random().toString();
    },
    membersNotLoaded: function() {
      return isUndefined(fit20.store.state.members);
    },
    members: function() {
      return Object.values(fit20.store.state.members || {})
    },
    // Do not use _listMembers in the template, but listVisibleMembers or listActiveMembers.
    _listMembers: function() {
      if (this.members) {
        if (this.orderByLastName) {
          return this.members.filter(function(mbr){return mbr}).sort(function(a, b) {
            return (a && a.lastName || '').localeCompare(b && b.lastName) || (a && a.firstName || '').localeCompare(b && b.firstName);
          });
        } else {
          return this.members.filter(function(mbr){return mbr}).sort(function(a, b) {
            return (a && a.firstName || '').localeCompare(b && b.firstName) || (a && a.lastName || '').localeCompare(b && b.lastName);
          });
        }
      } else {
        return [];
      }
    },
    listVisibleMembers: function() {
      var data = this;
      var filter = data.memberFilter.toLowerCase();
      return this._listMembers.filter(function(mbr){
        return mbr && mbr.active &&
               (mbr.memberStatus != 'ONHOLD' || data.includeOnHoldMembers) &&
               (!filter || mbr.fullName.toLowerCase().indexOf(filter) >= 0);
      });
    },
    listActiveMembers: function() {
      return this._listMembers.filter(function(mbr){
        return mbr && mbr.active;
      });
    },
    countMembers: function() {
      this.countSoloMembers = 0;
      this.countDuoMembers = 0;
      this.countOnHoldMembers = 0;
      if (this.members) {
        for (var i = 0; i < this.members.length; i++) {
          if (this.members[i] && this.members[i].active && this.members[i].memberStatus != 'ONHOLD') {
            if(this.members[i].duoPartner) {
              this.countDuoMembers += 1;
            } else {
              this.countSoloMembers += 1;
            }
          } else if (this.members[i] && this.members[i].active) {
            this.countOnHoldMembers += 1;
          }
        }
      }
      return this.countSoloMembers + this.countDuoMembers + this.countOnHoldMembers;
    },
    sensorStatusClass: function() {
      if (this.studio) {
        var gip = this.studio.gatewayIPAddress;
        if (isEmpty(gip)) {
          return "d-none";
        } else {
          if (fit20.sensors.active) {
            return fit20.sensors.active < 0 ? 'btn-warning' : 'btn-primary';
          } else {
            return 'btn-danger';
          }
        }
      } else {
        return 'd-none';
      }
    }
  }, // computed

  watch: {
    studio: function (studio) {
      if (studio) {
        if (!isEmpty(studio.gatewayIPAddress) && location.href.startsWith('https:')) {
          fit20.app.addAlert('warning', $t('M9550'));
        }
        // sensors.init is in sensor-connect.js
        fit20.sensors.init(studio).
          then(function(result){fit20.log("* Studio sensors changed. "+$t(JSON.stringify(result)))},
               function(error){debugger;fit20.log("!! Studio sensors changed. "+$t(JSON.stringify(error)))});
      }
    }
  } // watch

};


