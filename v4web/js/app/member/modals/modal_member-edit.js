/** Modal form to add a new member. */
fit20.components.memberedit= {
  'template': `
    <modal size="lg" @open="reset">
      <template #title>{{ isNewMember ? $t('M0212') : $t('M0213') }}</template>
        <div class="container-fluid">
          <div class="row">
            <div class="col-12">
              <div class="form-group row">
                <div class="col-4 px-2">
                  <label class="form-text">{{ $t('M0318') }}</label>
                  <input type="text" class="form-control" v-model="editedMember.firstName" id="editedMember.firstName">
                </div>
                <div class="col-4 px-2">
                  <label class="form-text">{{ $t('M0319') }}</label>
                  <input type="text" class="form-control" v-model="editedMember.intercalation" id="editedMember.intercalation">
                </div>
                <div class="col-4 px-2">
                  <label class="form-text">{{ $t('M0320') }}</label>
                  <input type="text" class="form-control" v-model="editedMember.lastName" id="editedMember.lastName">
                </div>
              </div><!-- end of form-group -->
              <div class="form-group row">
                <div class="col-4 px-2">
                  <label class="form-text">{{ $t('M0336') }}</label>
                  <input type="date" class="form-control" id="editedMember.birthDate"
                    max="2014-01-01"
                    v-model="editedMember.birthDate"
                  >
                </div>
                <div class="col-4 px-2">
                  <label class="form-text">{{ $t('M0316') }}</label>
                  <select class="custom-select w-100" v-model="editedMember.gender" id="editedMember.gender">
                    <option value="M0038">{{ $t('M0038') }}</option>
                    <option value="M0330">{{ $t('M0330') }}</option>
                    <option value="M0329">{{ $t('M0329') }}</option>
                  </select>
                </div>
              </div><!-- end of form-group -->
              <div class="form-group row">
                <div class="col-4 px-2">
                  <label class="form-text">{{ $t('M0020') }}</label>
                  <input type="email" class="form-control" v-model="editedMember.email" id="editedMember.email">
                </div>
                <div class="col-4 px-2">
                  <label class="form-text">{{ $t('M0040') }}</label>
                  <input type="tel" pattern="\\+?[0-9\- ()]{10,}" class="form-control" v-model="editedMember.telephone" id="editedMember.telephone">
                </div>
              </div><!-- end of form-group -->
              <div class="form-group row">
                <div class="col-4 px-2">
                  <label class="form-text">{{ $t('M0308') }}</label>
                  <div class="input-group">
                    <input type="text" pattern="[-0-9.,]*" class="form-control" v-model="editedMember.length" id="editedMember.length">
                    <div class="input-group-prepend">
                    <div class="input-group-text">cm</div>
                    </div>
                  </div>
                </div>
                <div class="col-4 px-2">
                  <label class="form-text">{{ $t('M0309') }}</label>
                  <div class="input-group">
                    <input type="text" pattern="[-0-9.,]*" class="form-control" v-model="editedMember.weight" id="editedMember.weight">
                    <div class="input-group-prepend">
                    <div class="input-group-text">kg</div>
                    </div>
                  </div>
                </div>
                <div class="col-3 px-2">
                  <label class="form-text">{{ $t('M0331') }}</label>
                  <div v-if="editedMember.measureDate">{{ editedMember.measureDate | dateFormat('long') }}</div>
                  <div v-else>{{ $t('M0038') }}</div>
                </div>
                <div class="col-1 px-2">
                  <button type="button" class="btn btn-primary btn-icon mt-2" @click="showWeightHistory">
                    <i class="fas fa-history"></i>
                  </button>
                </div>
              </div><!-- end of form-group -->
              <div class="form-group row" v-if="showWeightSeries">
                <table class="table table-sm table-dark">
                  <tr>
                    <td v-for="measureDate in editedMember.measureDates">{{ measureDate | dateFormat('long') }}</td>
                  </tr>
                  <tr>
                    <td v-for="weight in editedMember.weightSeries">{{ weight }} kg</td>
                  </tr>
                </table>
              </div>
              <div class="form-group row">
                <div class="col-4 px-2">
                  <label class="form-text">{{ $t('M0303') }}</label>
                  <input type="date" class="form-control" id="editedMember.membershipSince"
                    min="2009-01-01"
                    v-model="editedMember.membershipSince"
                  >
                </div>
                <div class="col-4 px-2">
                  <label class="form-text">{{ $t('M0333') }}</label>
                  <input type="date" class="form-control" v-model="editedMember.membershipUntil" id="editedMember.membershipUntil">
                </div>
                <div class="col-4 px-2">
                  <label class="form-text">{{ $t('M0327') }}</label>
                  <input type="number" class="form-control" v-model="editedMember.nrPaperSessions" id="editedMember.nrPaperSessions">
                </div>
              </div><!-- end of form-group -->
            </div><!-- .col-12 -->
          </div><!-- .row -->
        </div><!-- .container-fluid -->
      <template #controls>
        <button v-if="hasBeenEdited" type="button" class="btn btn-primary" v-on:click="putMember()" data-dismiss="modal">{{ $t('M0028') }}</button>
        <div v-if="!isNewMember && !hasBeenEdited">
          <span class="mr-3" v-if="memberStatus == 'ACTIVE'">{{ $t('M0412') }} {{ $t('M0024') }}</span>
          <span class="mr-3" v-if="memberStatus == 'PROSPECT'">{{ $t('M0212') }}</span>
          <span class="mr-3" v-if="memberStatus == 'ONHOLD'">{{ $t('M0412') }} {{ $t('M0089') }}</span>
          <span class="mr-3" v-if="memberStatus == 'INACTIVE' || memberStatus == 'WITHDRAWN'">{{ $t('M0413') }} {{ $t('M0093') }}</span>
          <!-- Put on hold. -->
          <button v-if="canSetOnHold()" type="button" class="btn btn-primary" @click="setMemberOnHold" data-dismiss="modal">{{ $t('M0461') }}</button>
          <!-- Make member active. -->
          <button v-if="canSetActive()" type="button" class="btn btn-primary" @click="setMemberActive" data-dismiss="modal">{{ $t('M0459') }}</button>
          <!-- Make ex-member. -->
          <button v-if="canSetInactive()" type="button" class="btn btn-primary" @click="setMemberInactive" data-dismiss="modal">{{ $t('M0460') }}</button>
        </div>
      </template>
    </modal>
  `,
  props: ['member'],
  data: function () {
    return {
      editedMember: {},
      hasBeenEdited: false,
      isReset: false, // True if a change in editedStudio is caused by a reset.
      showWeightSeries: false
    }
  },
  methods: {
    reset: function() {
      this.isReset = true; // Will cause hasBeenEdited to become false.
      this.editedMember = deepClone(fit20.app.formModel(this).editedMember, this.member);
    },
    putMember: function() {
      this.editedMember.weight = (this.editedMember.weight || '').toString().replace(',', '.');
      this.editedMember.length = (this.editedMember.length || '').toString().replace(',', '.');
      if (this.editedMember.birthDate == '') {
        delete this.editedMember.birthDate;
      }
      if (this.editedMember.membershipSince == '') {
        delete this.editedMember.membershipSince;
      }
      if (this.editedMember.membershipUntil == '') {
        delete this.editedMember.membershipUntil;
      }
      var scope = this;
      // Refresh the member list and the studio list (for member counts) after the new member has been created or updated.
      fit20.put('member', scope.editedMember, function(member) {
        scope.$emit('memberStored', member);
        fit20.memberStore.memberHasChanged();
      }).
      catch(function(error){
        fit20.app.addAlert('error', error);
      });
    },
    canSetOnHold: function() {
      var status = this.member && this.member.memberStatus;
      return isDefined(status) ? status == 'ACTIVE' : this.memberActive;
    },
    canSetActive: function() {
      var status = this.member && this.member.memberStatus;
      return isDefined(status) ? status =='PROSPECT' || status == 'WITHDRAWN' || status == 'INACTIVE' || status == 'ONHOLD' : !this.memberActive;
    },
    canSetInactive: function() {
      var status = this.member && this.member.memberStatus;
      return isDefined(status) ? status =='PROSPECT' || status == 'ACTIVE' || status == 'ONHOLD' : this.memberActive;
    },
    setMemberOnHold: function() {
      // Refresh the member list and the studio list (for member counts) after the member has been added.
      fit20.put('putMemberOnHold', this.member.id, function(member){
        fit20.memberStore.memberHasChanged();
      });
    },
    setMemberActive: function() {
      // Refresh the member list and the studio list (for member counts) after the member has been added.
      fit20.put('addMemberToStudio', this.member.id, function(member){
        fit20.memberStore.memberHasChanged();
      });
    },
    setMemberInactive: function() {
      // Refresh the member list and the studio list (for member counts) after the member has been removed.
      if (window.confirm($t('M0088', {name: this.member.fullName}))) {
        fit20.put('removeMemberFromStudio', this.member.id, function(member){
          fit20.memberStore.memberHasChanged();
        });
      }
    },
    showWeightHistory: function(){
      this.showWeightSeries = !this.showWeightSeries;
    }
  },
  computed: {
    isNewMember: function() {
      return isUndefined(this.member);
    },
    memberStatus: function(){
      return this.member && this.member.memberStatus;
    },
    memberActive: function() {
      return this.member &&this.member.active;
    }
  },
  watch: {
    member: {
      handler: function() {
        this.reset();
      },
      deep: true // Trigger when a property anywhere in member changes.
    },
    editedMember: {
      handler: function() {
        this.hasBeenEdited = !this.isReset;
        this.$nextTick(function(){this.isReset = false}); // Do this after reactive changes have been processed.
      },
      deep: true // Trigger when a property anywhere in editedMember changes.
    }
  }
};
