/* 2020-02-21
 * When using v-if in member.js, this component was instantiated more than once, causing many stopwatches to vbe created.
 * Because of the complex in-out communication between member and stopwatch, I decided to embed the stopwatch directly in member.
 */
fit20.components.stopwatch = {
  template: `
    <div class="stopwatch align-items-center">
      <span class="stopwatch-display p-1" style="width: 4rem">
        {{ display }}
      </span>
      <button type="button" class="btn btn-primary" @click="start()" v-if="!running"><i class="fa fa-play" aria-hidden="true"></i></button>
      <button type="button" class="btn btn-primary" @click="pause()" v-if="showPauseButton && running"><i class="fa fa-pause" aria-hidden="true"></i></button>
      <button type="button" class="btn btn-primary" @click="restart()" v-if="showPauseButton" :class="{'invisible' : running }"><i class="fa fa-redo" aria-hidden="true"></i></button>
    </div>
  `,
  data: function() {
    return {
      startTime: undefined, // Time when stopwatch was started or re-started after pause.
      totalTimeMs: 0, // Time to add because of pausing or lead-in.
      timer: undefined, // The javascript interval timer.
      display: "0:00",
      showPauseButton: false
    }
  }, // data
  methods: {
    start: function() {
      this.startTime = Date.now();
      this.timer = setInterval(this.showTime, 1000);
      this.$emit('start');
      fit20.log(`⏱ stopwatch ${this.timer} started at ${this.startTime}+${this.totalTimeMs}`);
    },
    pause: function() {
      // this.totalTimeMs gets the elapsed time until the pause.
      this.totalTimeMs = this.getTotalTimeMs();
      clearInterval(this.timer);
      // After the pause, this.startTime will start at Date.now().
      this.startTime = undefined;
      this.showTime();
      fit20.log(`⏱ stopwatch ${this.timer} paused at ${this.startTime}+${this.totalTimeMs}`);
    },
    restart: function() {
      clearInterval(this.timer);
      this.startTime = undefined;
      this.totalTimeMs = 0;
      this.showTime();
      fit20.log(`⏱ stopwatch ${this.timer} restarting at ${this.startTime}+${this.totalTimeMs}`);
    },
    showTime: function() {
      this.display = showTime(Math.round(this.getTotalTimeMs() / 1000)); // showTime is a global function.
    },
    isRunning: function() {
      return isDefined(this.startTime) || this.totalTimeMs > 0;
    },
    getTotalTimeMs: function() {
      if (isDefined(this.startTime)) {
        return Date.now() - this.startTime + this.totalTimeMs;
      } else {
        return this.totalTimeMs;
      }
    },
    getTotalTimeS: function() {
      var totalTimeSec = Math.round(this.getTotalTimeMs() / 1000);
      fit20.log(`⏱ stopwatch ${this.timer} getTotalTimeS at ${this.startTime}+${this.totalTimeMs} showing ${totalTimeSec}`);
      return totalTimeSec;
    },
    addSeconds: function(seconds) {
      this.totalTimeMs += 1000*seconds;
      fit20.log(`⏱ stopwatch ${this.timer} addSeconds at ${this.startTime}+${this.totalTimeMs}`);
    }
  }, // methods
  computed: {
    running: function() {
      return isDefined(this.startTime);
    }
  } // computed
};
