fit20.components.traineredit= {
  template: `
    <modal size="lg">
      <template #title>{{ $t('M0009') }}</template>
            <input type="hidden" v-model="trainer.id">
            <div class="container-fluid">
              <div class="row trainer-modal">
                <div class="col-8">
                  <div class="form-group row">
                    <div class="col-6 px-2">
                      <label class="form-text">{{ $t('M0318') }}</label>
                      <input type="text" class="form-control" v-model="trainer.firstName">
                    </div>
                    <div class="col-6 px-2">
                      <label class="form-text">{{ $t('M0319') }}</label>
                      <input type="text" class="form-control" v-model="trainer.intercalation">
                    </div>
                  </div>
                  <div class="form-group row">
                    <div class="col-6 px-2">
                      <label class="form-text">{{ $t('M0320') }}</label>
                      <input type="text" class="form-control" v-model="trainer.lastName">
                    </div>
                    <div class="col-6 px-2">
                      <label class="form-text">{{ $t('M0316') }}</label>
                      <select class="custom-select w-100" v-model="trainer.gender">
                        <option value="M0038">{{ $t('M0038') }}</option>
                        <option value="M0330">{{ $t('M0330') }}</option>
                        <option value="M0329">{{ $t('M0329') }}</option>
                      </select>
                    </div>
                  </div><!-- end of form-group -->
                  <div class="form-group row">
                    <div class="col-6 px-2">
                      <label class="form-text">{{ $t('M0336') }}</label>
                      <input type="date" class="form-control" v-model="trainer.birthDate">
                    </div>
                    <div class="col-6 px-2">
                      <label class="form-text">{{ $t('M0020') }}</label>
                      <input type="email" class="form-control" v-model="trainer.email" disabled="only allowed for admin">
                    </div>
                  </div><!-- end of form-group -->
                  <div class="form-group row">
                    <div class="col-6 px-2">
                      <label class="form-text">{{ $t('M0018') }}</label>
                      <select class="custom-select w-100" v-model="trainer.language">
                        <option v-for="language in languages" :value="language.code">{{ language.name }}</option>
                      </select>
                    </div>
                  </div><!-- end of form-group -->
                </div>
                <div class="col-4">
                  <div class="form-group row">
                    <div class="col-12 px-2 border">
                      <label class="form-text">{{ $t('M0062') }}</label>
                      <makephoto :subject="trainer" :callback="refreshTrainer" :embedded="true"></makephoto>
                    </div>
                  </div><!-- end of form-group -->
                </div>
              </div>
            </div>
      <template #controls>
            <button type="button" class="btn btn-primary" v-on:click="putTrainer()" data-dismiss="modal">{{ $t('M0028') }}</button>
      </template>
    </modal>
  `,
  components: {
    'makephoto': fit20.components.makephoto
  },
  methods: {
    putTrainer: function() {
      if (this.trainer.birthDate == '') {
        delete this.trainer.birthDate;
      }
      fit20.put('currentTrainer', this.trainer);
      fit20.i18n.setLanguage(this.trainer.language);
    },
    refreshTrainer: function() {
      fit20.get('currentTrainer', true);
    }
  },
  computed: {
    trainer: function() {
      if (isEmpty(fit20.store.state.currentTrainer)) {
        return {};
      } else {
        return fit20.store.state.currentTrainer;
      }
    },
    languages: function() {
      return fit20.i18n.languages;
    }
  }
};
