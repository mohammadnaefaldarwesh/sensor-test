fit20.components.studios = {
  template: `
    <article>
      <header class="container-fluid py-2"  v-if="countStudios > 4">
        <div class="row no-gutters">
          <div class="col-4">
            <search-box v-model="studioFilter"></search-box>
          </div>
          <div class="col-7"></div>
          <button class="col-1 btn btn-primary" @click="refresh"><i class="fas fa-sync"></i></button>
        </div>
        <div class="row" v-if="countStudios < 1">
          <div class="card-holder empty-indicator ifUI ifSignedIn">{{ $t('M0091') }}</div>
        </div>
      </header>
      <section class="pt-2 d-flex flex-row">
        <div class="container-fluid scrollable">
          <div class="row custom-gutters" v-if="studiosNotLoaded">{{ $t('L0104') }}</div>
          <div id="studio-list" class="row card-gutters studios">
            <div v-for="studio in listStudios"
              class="card-holder"
              :id="'studio-'+studio.id"
              :title="studio.id"
            >
              <div class="card"
                v-on:click="selectStudio(studio)"
                role="button"
              >
                <div class="card-body studio-body">
                  <div class="name">
                    <h5 class="card-title">{{ studio.name  || '\xA0' }}</h5>
                    <h6 class="card-subtitle">{{ studio.subName || '\xA0' }}</h6>
                  </div>
                  <div class="count">
                    <span class="badge badge-primary">{{ studio.nrMembers }} <i class="fas fa-users"></i></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <alphabetscroll v-if="countStudios > 14" :list="listStudios" :itemToName="itemToSortName" @scrollTo="scrollTo"></alphabetscroll>
      </section>
      <trainercontrols :showtrainer="true">
        <button class="btn btn-primary text-white align-middle" onclick="fit20.refreshAll();">
          <i class="fas fa-sync-alt"></i>
          <div class="small">{{ $t('M0110') || 'Reload' }}</div>
        </button>
      </trainercontrols>
    </article>
  `,
  components: {
    'trainercontrols': fit20.components.trainercontrols,
	  'alphabetscroll': fit20.components.alphabetscroll
  },
  data: function() {
    return {
      studioFilter: ""
    };
  },
  methods: {
    refresh: function() {
      fit20.log('* Refreshing studios list')
      fit20.get('studios');
    }, // refresh
    // Select a studio. The studio parameter is a complete studio object.
    selectStudio: function(studio) {
      if (fit20.app.vue.isInSession()) {
        if (fit20.app.vue.currentStudio.id == studio.id) {
        } else {
          fit20.app.addAlert('warning', 'M9034', [{text: $t('M0030'), callback: () => this._selectStudio(studio)}, {text: $t('M0031')}]);
        }
      } else {
        this._selectStudio(studio);
      }
    }, // selectStudio
    _selectStudio: function(studio) {
      fit20.log(`* Selecting studio ${studio.name} ${studio.subName}.`);
      fit20.app.vue.closeAllMemberTabs().
        then(function(){
          fit20.log(`* selectStudio is switching studio`);
          fit20.store.commit('setMembers', undefined);
          fit20.store.commit('setCurrentStudio', studio);
          fit20.app.vue.selectStudioId(studio.id);
        });
    }, // _selectStudio
    itemToSortName: function(studio) {
      return studio.name;
    },
    scrollTo: function(studio) {
      var $scrollTo = $('#studio-'+studio.id);
      var $scrollable = $scrollTo.closest('section').children('.scrollable');
      $scrollable.animate({scrollTop : $scrollTo.offset().top - $scrollable.offset().top + $scrollable.scrollTop()}, 500);
    }
  }, // methods
  computed: {
    studiosNotLoaded: function() {
      return isUndefined(fit20.store.state.studios);
    },
    listStudios: function() {
      // The following line is reactive to studios.
      var studios = fit20.store.state.studios || [];
      var filter = this.studioFilter.toLowerCase();
      return studios.
        filter(function(studio){
          return studio.active &&
                 (!filter ||
                  (studio.name || '').toLowerCase().indexOf(filter) >= 0 ||
                  (studio.subName || '').toLowerCase().indexOf(filter) >= 0
                 );
        }).
        sort(function(a, b) {
          return a.name.localeCompare(b.name) || a.subName.localeCompare(b.subName);
        });
    },
    countStudios: function() {
      if(isEmpty(fit20.store.state.studios)) {
        return 0;
      } else {
        return fit20.store.state.studios.length;
      }
    },
    countActiveMembers: function() {
      // Count all active members in all studios.
      var memberCount = 0;
      var studios = fit20.store.state.studios;
      for (i = 0; i < studios.length; i++) {
        memberCount += studios[i].nrMembers;
      }
      return memberCount;
    }
  }, // computed
  mounted: function() {
    this.refresh();
  }
};
