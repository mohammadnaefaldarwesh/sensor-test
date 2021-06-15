/** Modal form to change member photo. */
fit20.components.membereditphoto = {
  'template': `
    <modal>
      <template #title>{{ $t('M0335') }}</template>
      <makephoto :subject="member" :callback="refreshMember" :embedded="false"></makephoto>
    </modal>
  `,
  components: {
    'makephoto': fit20.components.makephoto
  },
  props: ['member'],
  methods: {
    refreshMember: function() {
      fit20.memberStore.refreshDetails(this.member.id);
    }
  }
};
