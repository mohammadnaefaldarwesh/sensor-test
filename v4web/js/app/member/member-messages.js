fit20.components.membermessages = {
  template: `
    <div class="member-messages-panel pl-2">
      <div :id="accordionId('accordion')" role="tablist" class="accordion">
        <div class="card">
          <h5 class="mb-0 card-header" role="tab" :id="accordionId('remark-header')">
            <a class="add no-photo-icon" v-on:click="remarkModal('Remark')">
              <i class="fas fa-pencil-alt"></i>
            </a>
            <a class="select collapsed" data-toggle="collapse" :href="accordionId('#remark-collapse')">
              {{ $t('M0305') }}
            </a>
          </h5>
          <div class="collapse card-body ordered" :id="accordionId('remark-collapse')" role="tabpanel" :data-parent="accordionId('#accordion')">
            <div v-for="(remark, index) in memberRemarks" :style="{ order: -index }">
              {{ remark }}
            </div>
          </div>
        </div>
        <div class="card">
          <h5 class="mb-0 card-header" role="tab" :id="accordionId('aim-header')">
            <a class="add no-photo-icon" v-on:click="remarkModal('Aim')">
              <i class="fas fa-pencil-alt"></i>
            </a>
            <a class="select collapsed" data-toggle="collapse" :href="accordionId('#aim-collapse')">
              {{ $t('M0306') }}
            </a>
          </h5>
          <div class="collapse card-body ordered" :id="accordionId('aim-collapse')" role="tabpanel" :data-parent="accordionId('#accordion')">
            <div v-for="(aim, index) in memberAims" :style="{ order: -index }">
              {{ aim }}
            </div>
          </div>
        </div>
        <div class="card">
          <h5 class="mb-0 card-header" role="tab" :id="accordionId('result-header')">
            <a class="add no-photo-icon" v-on:click="remarkModal('Result')">
              <i class="fas fa-pencil-alt"></i>
            </a>
            <a class="select collapsed" data-toggle="collapse" :href="accordionId('#result-collapse')">
              {{ $t('M0307') }}
            </a>
          </h5>
          <div class="collapse card-body ordered" :id="accordionId('result-collapse')" role="tabpanel" :data-parent="accordionId('#accordion')">
             <div v-for="(result, index) in memberResults" :style="{ order: -index }">
              {{ result }}
            </div>
          </div>
        </div>
      </div>
      <memberremarks
          :memberId="memberId"
          :messages="messages"
          :messagesType="messagesType"
          :messageTypeCode="messageTypeCode"
          :id="accordionId('memberRemarks')"
      ></memberremarks>
    </div>
  `,
  props: ['member', 'activeSession'],
  components: {
    'memberremarks': fit20.components.memberremarks
  },
  data: function() {
    return {
      messagesType: undefined,
      messageTypeCode: undefined
    }
  }, // data
  methods: {
    accordionId: function(id) {
      return id + this.memberId;
    },
    remarkModal: function(type) {
      this.messagesType = type;
      if (this.messagesType === 'Remark') {
        this.messageTypeCode = 'M0305';
      } else if (this.messagesType === 'Aim') {
		    this.messageTypeCode = 'M0306';
	    } else if (this.messagesType === 'Result') {
		    this.messageTypeCode = 'M0307';
	    }
      fit20.app.modal(this.accordionId('memberRemarks'));
    },
  },
  computed: {
    messages: function() {
      if (this.messagesType) {
        return this.member[this.messagesType.toLowerCase()+'s'];
      } else {
        return undefined;
      }
    },
    memberId: function() {
      return this.member && this.member.id;
    },
    memberRemarks: function() {
	    return this.member ? this.member['remarks'] : [];
    },
    memberAims: function() {
	    return this.member ? this.member['aims'] : [];
    },
    memberResults: function() {
	    return this.member ? this.member['results'] : [];
    }
  }
};
