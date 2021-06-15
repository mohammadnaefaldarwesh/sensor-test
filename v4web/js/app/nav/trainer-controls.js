/* Trainer controls, should be displayed inside <article>, after <section> */

fit20.components.trainercontrols = {
  template: `
    <footer class="footer py-1">
      <div class="container-fluid">
        <div class="row align-items-center">

          <div class="col-1" title="Left thumb of trainer goes here.">
            <span style="position: absolute; font-size: 65%;">
              <span v-if="appNeedsUpdate" class="text-white bg-danger">{{ $t('L0102') }}</span>
              <span class="text-gray">{{ appServer }}<br>{{ appVersion }}</span>
            </span>
            <img class="loading-spinner bg-light" src="images/spinner.svg" style="visibility: hidden;"/>
            &#xA0;
          </div>

          <div class="col-10 d-flex justify-content-between hide-during-loading">
            <button class="btn btn-primary align-middle" @click="reportProblem">
              <i class="fas fa-exclamation-triangle"></i>
              <div class="small">{{ $t('M0238') }}</div>
            </button>
            <slot><!-- Specific trainer controls go here. --></slot>
            <div v-if="showtrainer">
              <button type="button" class="btn btn-outline-primary ifSignedOut" id="signinButton"
                onclick="fit20.app.signin()"
              >
                <i class="fa fa-sign-in"></i>
                <div class="small">{{ $t('M0106') || 'Login' }}</div>
              </button>
              <button type="button" class="btn btn-outline-primary ifSignedIn" id="signoutButton"
                @click="signOut"
              >
                <i class="fas fa-sign-out"></i>
                <div class="small">{{ $t('M0102') || 'Logout' }}</div>
              </button>
              <button type="button" class="btn btn-outline-primary ifSignedIn"
                  @click="editTrainer"
              >
                <div>
                  <div class="small" style="max-width: 12em; overflow: hidden; text-overflow: ellipsis;" :title="userInfo.name">{{ trainerName }}</div>
                  <div class="small">({{ $t(userInfo.role || 'M0009') }})</div>
                </div>
              </button>
            </div><!-- v-if="showtrainer" -->
            <!--div v-else=""></div-->
          </div><!-- .col-10 -->

          <div class="col-1" title="Right thumb of trainer goes here." style="text-align: right;">
            <img class="loading-spinner" src="images/spinner.svg" style="visibility: hidden;"/>
            &#xA0;
            <span :class="sensorStatus" class="icon icon-sensor"></span>
          </div>

        </div>
      </div>
    </footer>
  `,
  props: ['showtrainer'],
  methods: {
    'editTrainer' : function() {
      if (isDefined(fit20.store.state.currentTrainer)) {
        fit20.log("* Editing trainer info.");
        fit20.app.modal('trainer-edit');
      } else {
        alert(`${$t(fit20.app.userInfo.role || 'M0009')} ${fit20.app.userInfo.email}`);
      }
    },
    'reportProblem' : function() {
      fit20.app.startLoading("L0103");
      // Take a screenshot.
      html2canvas(document.getElementById('app')).
      then(function(canvas) {
        fit20.app.screenshot = canvas.toDataURL();
      }).
      catch(function(error){
        debugger;
        fit20.log(`!! Cannot create a screenshot: ${error.toString()}`);
        fit20.app.screenshot = null;
      }).
      then(function(canvas) {
        fit20.app.stopLoading(true);
        // Open the problem form.
        fit20.app.modal('trainer-problem');
      });
    },
    'signOut' : function() {
      fit20.log(`* Trainer ${this.trainerName} (${fit20.app.userInfo.email}) signing out`);
      if (fit20.app.vue && fit20.app.vue.isInSession()) {
        fit20.app.addAlert('warning', 'M9034', [{text: $t('M0030'), callback: fit20.app.signout}, {text: $t('M0031')}]);
      } else {
        fit20.app.signout();
      }
    }
  },
  computed: {
    appServer: function(){
      return window.appServer;
    },
    appVersion: function() {
      var version = window.appVersion.replace(/[t.]\d.*/, '');
      if (version == 'null') version = 'no_version';
      return version;
    },
    appNeedsUpdate: function() {
      return fit20.appNeedsUpdate;
    },
    userInfo: function() {
      return fit20.app.userInfo;
    },
    trainer: function() {
      if (isEmpty(fit20.store.state.currentTrainer)) {
        return {};
      } else {
        return fit20.store.state.currentTrainer;
      }
    },
    trainerName: function() {
      if (isEmpty(fit20.store.state.currentTrainer)) {
        return this.userInfo.name;
      } else {
        return this.trainer.contactName;
      }
    },
    // The sensorStatus reflects sensors.active.
    sensorStatus: function() {
      if (fit20.store.state.currentStudio) {
        var gip = fit20.store.state.currentStudio.gatewayIPAddress;
        if (isEmpty(gip)) {
          return "d-none";
        } else {
          if (fit20.sensors.active) {
            return fit20.sensors.active < 0 ? 'text-warning' : 'text-primary';
          } else {
            return 'text-danger';
          }
        }
      } else {
        return 'd-none';
      }
    }
  } // computed
};
