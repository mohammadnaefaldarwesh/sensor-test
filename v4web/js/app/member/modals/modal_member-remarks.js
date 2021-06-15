/** Modal for the member remarks */
fit20.components.memberremarks = {
  template: `
    <modal @open="reset">
      <template #title>{{ $t(messageTypeCode) }}</template>
          <div class="modal-body-remarks">
            <div class="container-fluid">
              <div class="form-group row">
                <div class="col-12">
                  <textarea v-model="messageText" class="mt-1" placeholder="..."></textarea>
                  <button type="button" class="btn btn-primary float-right"
                    v-show="messageText != ''"
                    @click="putRemarks" data-dismiss="modal">{{ $t('M0094') }}</button>
                </div>
              </div>
            </div>
          </div>
      <template #controls>
          <div class="modal-body-remarks">
            <div class="container-fluid">
              <div class="form-group row ordered flex-row">
                <div class="col-12 mt-1" v-for="(item, index) in messages" :style="{ order: -index }">
                  <div class="form-group row">
                    <div class="col-10">
                      <textarea v-model="messages[index]"></textarea>
                    </div>
                    <div class="col-2">
                      <button type="button" class="btn btn-primary btn-block mb-1" @click="changeRemark(item, index)" data-dismiss="modal">
                        <i class="fas fa-check"></i>
                      </button>
                      <button type="button" class="btn btn-warning btn-block" @click="changeRemark('', index)" data-dismiss="modal">
                        <i class="fas fa-trash-alt"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div><!-- form-group -->
            </div>
          </div>
      </template>
    </modal>
  `,
  props: ['memberId', 'messages', 'messagesType', 'messageTypeCode'],
  data: function() {
    return {
      messageText: ""
    }
  },
  methods: {
    reset: function() {
      this.messageText = "";
    },
    putRemarks: function() {
      fit20.put('add'+this.messagesType, {memberId: this.memberId, text: this.remarkFull});
      this.reset();
    },
    changeRemark: function(item, index) {
      fit20.put('change'+this.messagesType, {memberId: this.memberId, index: index, text: item})
    }
  },
  computed: {
	  remarkFull: function() {
		  var date = new Date();
		  return dateFormat(date, $t('L1001')) + ": " + this.messageText;
	  }
  }
};