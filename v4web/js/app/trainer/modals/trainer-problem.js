fit20.components.trainerproblem = {
  'template': `
    <modal size="lg" @open="clearReport" @close="clearReport">
      <template #title>{{ $t('M0240') }}</template>
            <div class="container-fluid">
              <div class="form-group row">
                <div class="col-6 px-2">
                  <label class="form-text">{{ $t('M0009') }}</label>
                  <input type="text" disabled="" class="form-control" v-model="trainer.contactName">
                </div>
                <div class="col-6 px-2">
                  <label class="form-text">{{ $t('M0020') }}</label>
                  <input type="text" disabled="" class="form-control" v-model="trainer.email">
                </div>
              </div><!-- end of form-group -->
              <div class="form-group row">
                <div class="col-12 px-2 border">
                  <label class="form-text">{{ $t('M0241') }}</label>
                  <textarea v-model="message"></textarea>
                </div>
              </div><!-- end of form-group -->
              <div class="form-group row">
                {{ $t('M0242') }}
              </div><!-- end of form-group -->
              <div class="form-group row">
                {{ $t('M0243') }}
              </div><!-- end of form-group -->
            </div>
      <template #controls>
            <button type="button" class="btn btn-primary" @click="sendReport()" data-dismiss="modal">{{ $t('M0013') }}</button>
      </template>
    </modal>
  `,
  data: function() {
    return {
      message: ''
    }
  },
  computed: {
    trainer: function() {
      if (isEmpty(fit20.store.state.currentTrainer)) {
        return {
          contactName: fit20.app.userInfo.name,
          email: fit20.app.userInfo.email
        };
      } else {
        return fit20.store.state.currentTrainer;
      }
    }
  },
  methods: {
    sendReport: function() {
      var studioName = (fit20.store.state.currentStudio
          ? `studio ${fit20.store.state.currentStudio.name} ${fit20.store.state.currentStudio.subName} (${fit20.store.state.currentStudio.id})`
          : '<unknown studio>')
      var location = `${this.trainer.contactName} (${this.trainer.id}) ${this.trainer.email} from ${studioName}`;
      // This will be the last line in the log that is sent by email.
      fit20.log(`* Problem report sent by ${location}`);
      // Log level 10 is special; These messages will be sent by email to fit20 support.
      fit20.logServer(this.message, location, 10, {screenshot: fit20.app.screenshot});
      // After sending, clear the report.
      this.clearReport();
    },
    clearReport: function() {
      this.message = '';
    }
  }
};
