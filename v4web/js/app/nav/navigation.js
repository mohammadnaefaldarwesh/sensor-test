/**
 * This file contains the tabs and the panels that belong to them.
 * Use keys in v-for: https://vuejs.org/v2/guide/list.html#Maintaining-State
 */

fit20.components.navigation = {
  template: `
    <nav class="navbar navbar-expand">
      <div class="collapse navbar-collapse w-100">
        <ul class="nav nav-pills">
        
          <li class="nav-item">
            <a class="btn navbar-brand arrow-right" href="#studios" id="studios-tab" @click.stop.prevent="selectTab">
            </a>
          </li>
          
          <li class="nav-item">
            <a class="btn btn-primary arrow align-middle"
	            @click.stop.prevent="selectTab"
	            id="members-tab" href="#members"
              v-show="currentStudio"
	            :title="currentStudio ? currentStudio.id : ''"
	          >
	            <span v-if="currentStudio">
                {{ currentStudio.name }}<br v-if="currentStudio.subName">{{ currentStudio.subName }}
	            </span>
            </a>
          </li>
          
          <li class="nav-item member-tab" v-for="member in currentMembers" :key="'tab-'+member.id">
            <a class="btn btn-primary arrow text-white align-middle"
               @click.stop.prevent="selectTab"
               :id="'member-tab-'+member.id" :href="'#member-tab-panel-'+member.id"
               :title="member.id"
             >
              <div>{{ member.fullName }}<div v-if="member.duoPartner">{{ memberName(member.duoPartner) }}</div></div>
              <span class="badge badge-pill badge-danger" v-if="isInSession(member.id)"><i class="far fa-clock"></i></span>
              <span class="badge badge-pill badge-danger" v-else="" @click.stop.prevent="forgetMemberId(member.id)"><i class="far fa-times"></i></span>
            </a>
          </li>
          
          <li class="nav-item" style="margin-left:-1.5em;"><!-- spacer --></li>
          
          <li class="nav-item ml-auto">
            <a class="btn btn-primary arrow-left text-primary align-middle ml-auto" style="width: 5em;"
               @click.stop.prevent="selectTab"
               id="helpdocs-tab" href="#helpdocs-tab-panel"
               title="???"
            >
              <i class="far fa-question-circle h2 my-0"></i>
            </a>
          </li>
          
        </ul>
      </div>
    </nav>
  `,
  props: ['currentMembers', 'selectedTabHref'],

  computed: {
    currentStudio: function() {
      return fit20.store.state.currentStudio;
    }
  }, // computed

  methods: {

    selectTab: function(event) {
      event.preventDefault();
      event.stopPropagation()
      var href = event.currentTarget.href;
      href = href.substring(href.indexOf('#')); // includes leading #
      fit20.app.vue.selectTab(href);
      return false;
    },

    activateTabPanel: function() {
      var $selectedTab = $(this.$el).find(`.nav-item > a[href=\\${this.selectedTabHref}]`);
      var $otherTabs = $(this.$el).find('.nav-item>a').not($selectedTab);
      $otherTabs.removeClass(['active']);
      $selectedTab.addClass(['active']);
    },

    forgetMemberId : function(memberId) {
      event.preventDefault();
      event.stopPropagation();
      fit20.app.vue.forgetMemberId(memberId);
    },

    memberName: function(memberId) {
      return fit20.store.state.members[memberId] ?
        fit20.store.state.members[memberId].fullName : "";
    },

    isInSession: function(memberId) {
      if (isDefined(memberId)) {
        return fit20.store.state.activeMemberSessions &&
               isDefined(fit20.store.state.activeMemberSessions[memberId]);
      } else {
        // Because of #396, any ongoing session could block closing a tab.
        return fit20.store.state.activeMemberSessions &&
             Object.values(fit20.store.state.activeMemberSessions).some(isDefined);
      }
    } // isInSession

  }, // methods

  mounted: function() {
    this.activateTabPanel()
  }, // mounted

  watch: {
    selectedTabHref: function() {this.activateTabPanel()}
  } // watch
};


fit20.components.tabpanels = {
  template: `
    <main class="tab-content">

      <div class="tab-pane fade show active" id="studios">
        <studios></studios>
      </div>

      <div class="tab-pane fade" id="members" onactivate="activateStudio">
        <members :ref="'studio_members'" :studio="currentStudio" :sensorconnect="sensorconnect"></members>
      </div>

      <div v-for="member in currentMembers"
        :key="'tabpanel-'+member.id"
        class="tab-pane fade" :id="'member-tab-panel-'+member.id"
      >
        <!-- The ref is used to call functions like cancelSession. See ui.js. -->
        <!-- See [https://vuejs.org/v2/api/#key] for the use of ':key'. -->
        <member :key="member.id" :member-id="member.id" :ref="'member_screen_'+member.id"></member>
      </div>

      <div class="tab-pane fade" id="helpdocs-tab-panel">
        <helpdocs></helpdocs>
      </div>

    </main><!-- .tab-content -->
  `,
  components: {
    'studios': fit20.components.studios,
    'members': fit20.components.members,
    'member': fit20.components.member,
    'helpdocs': fit20.components.helpdocs
  },

  // selectedTabHref starts with #
  props: ['currentMembers', 'selectedTabHref'],

  computed: {
    currentStudio: function() {
      return fit20.store.state.currentStudio;
    },
    sensorconnect: function() {
      return fit20.sensors && fit20.sensors.sensorconnect;
    }
  }, // computed

  methods: {
    activateTabPanel: function() {
      var $selectedPanel = $(this.selectedTabHref);
      var $otherPanels = $(this.$el).find('.tab-pane').not($selectedPanel);
      $otherPanels.removeClass(['show', 'active']);
      $selectedPanel.addClass(['show', 'active']);
      // The onactivate attribute on a .tab-pane specifies the name of a callback function.
      var onActivate = $selectedPanel.attr('onactivate');
      if (onActivate && this[onActivate]) {
        this[onActivate]();
      }
    },
    activateStudio: function() {
      // Checking the sensor happens in sensor-connect.init, not here.
//      if (fit20.sensors.connect && this.currentStudio) {
//        fit20.log(`* activateStudio Checking if current studio has a connected sensor.`);
//        fit20.sensors.connect(this.currentStudio);
//      }
    }
  }, // methods

  mounted: function() {
    this.activateTabPanel()
  }, // mounted

  watch: {
    selectedTabHref: function() {this.activateTabPanel()}
  } // watch
};
