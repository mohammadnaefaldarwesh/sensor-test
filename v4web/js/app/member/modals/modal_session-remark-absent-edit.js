/** Modal to display session remark & absent reason. Also a button to edit the session */
fit20.components.membersessionpopup = {
  template: `
    <modal>
      <template #title>{{ $t('M0850') }} {{ session.date | dateFormat('short') }}</template>
            <div class="block pb-5" v-if="session.absent">
              <h5 class="modal-title pb-1">{{ $t('M0411') }} {{ $t(session.absentReason) }}</h5>
            </div>
            <div class="block pb-5" v-if="session.remark">
              <h5 class="modal-title pb-1">{{ $t('M0816') }}</h5>
              <span>{{ session.remark }}</span>
            </div>
      <template #controls>
            <button type="button" class="btn btn-primary"
              v-show="canedit" v-on:click="editSession(session)" data-dismiss="modal"
            >{{ $t('M0346') }}</button>
      </template>
    </modal>
  `,
  props: ['session', 'canedit'],
  methods: {
    editSession: function(session) {
      this.$emit('editSession', session);
    }
  }
}