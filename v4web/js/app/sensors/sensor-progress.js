fit20.components.sensorprogress = {
  template: `
    <div>
      <div class="referencebar mb-1">
        <span v-if="isRunning" class="overlay h4 m-0"><i class="fas fa-repeat-alt"></i>&nbsp;{{ repetition }}</span>
        <span v-if="isStationary" class="overlay h4 m-0"><i class="far fa-hand-paper"></i></span>
        <div class="progress" :class="referenceClass" :style="referenceStyle"></div>
        <div class="calibra" :style="{ left : calcPosition(0)}"></div>
        <div class="calibra" :style="{ left : calcPosition(1)}"></div>
        <div class="before" :style="{ width : calcPosition(0)}"></div>
        <div class="center" :style="{ width : calcPosition(0.8)}"></div>
        <div class="after" :style="{ width : calcPosition(0)}"></div>
      </div>
      <div class="progressbar">
        <span class="overlay h4 m-0">{{ count }}</span>
        <div class="progress" :style="progressStyle"></div>
        <div class="calibra" :style="{ left : calcPosition(0)}"></div>
        <div class="calibra" :style="{ left : calcPosition(1)}"></div>
        <div class="before" :style="{ width : calcPosition(0)}"></div>
        <div class="before-text">{{ beforeContent }}</div>
        <div class="center" :style="{ width : calcPosition(0.8)}"></div>
        <div class="after" :style="{ width : calcPosition(0)}"></div>
        <div class="after-text">{{ afterContent }}</div>
      </div>
    </div>
  `,
  /**
   * count: Count to display during exercise, 0 .. 10.
   * actual_position, reference_position: 0.0 = calibrated start position ; 1.0 = calibrated end position.
   * tracking: < -2 | > 2 = way off ; -2..-1 | +1..+2 = slightly off ; -1..+1 = doing fine.
   * repetition: 0 = start; > 0 = moving, -1 = stationary.
   */
  props: ['count', 'actual_position', 'reference_position', 'tracking', 'repetition', 'colorScheme'],
  data: function() {
    return {
      slack: 0.2, // under- and overshoot of position to display
      maxTracking: 0, // maximum tracking for which a color is defined
      trackingIndexFactor: 0, // multiplication factor to convert tracking into index in color table
      colorTableSize: 40, // size of the color table
      colorTable: [] // colors for tracking in steps depending on colorTableSize and trackingIndexFactor
    }
  },
  methods: {
    // Calculate the position as a percentage, taking slack into account.
    calcPosition: function(position) {
      var scaled = (position + this.slack) / (1.0 + 2 * this.slack) * 100;
      return Math.max(0, Math.min(100, scaled)) + "%";
    },
    trackingColor: function(tracking, colorScheme) {
      var csAboveIdx = colorScheme.findIndex(cs => cs.tracking > tracking);
      if (csAboveIdx == 0) {
        return colorScheme[0].color;
      }
      if (csAboveIdx < 0) {
        return colorScheme[colorScheme.length-1].color
      }
      var csBelowIdx = csAboveIdx - 1;
      var csAbove = colorScheme[csAboveIdx];
      var csBelow = colorScheme[csBelowIdx];
      var mixFactor = (tracking - csBelow.tracking) /
                      (csAbove.tracking -  csBelow.tracking);
      var palette = [{color: csBelow.color, weight: 1 - mixFactor},
                     {color: csAbove.color, weight: mixFactor}];
      var colorMix = {r: 0.0, g: 0.0, b: 0.0};
      var totalWeight = 0.0;
      // Parse each of the colors into r, g, b, and sum them.
      for (var plt of palette) {
        colorMix.r += parseInt(plt.color.substr(1, 2), 16) * plt.weight;
        colorMix.g += parseInt(plt.color.substr(3, 2), 16) * plt.weight;
        colorMix.b += parseInt(plt.color.substr(5, 2), 16) * plt.weight;
        totalWeight += plt.weight;
      }
      // Compute 2-digit hex codes.
      var hex2 = num => {
        var s = Math.round(num).toString(16);
        return s.length == 0 ? '00' : s.length == 1 ? '0'+s : s;
      };
      // Take weighted average and turn into hex.
      var rgbMix = hex2(colorMix.r / totalWeight) +
                   hex2(colorMix.g / totalWeight) +
                   hex2(colorMix.b / totalWeight);
      return '#'+rgbMix;
    } // trackingColor
  },
  computed: {
    referenceStyle: function() {
      return {
        'width' : this.calcPosition(this.reference_position)
      };
    },
    referenceClass: function() {
      if (this.repetition == 0) {
        return "bg-secondary";
      } else if (this.repetition > 0) {
        return "bg-info";
      } else {
        return "bg-darkshade";
      }
    },
    progressStyle: function() {
      var trackingIndex = Math.ceil(this.trackingIndexFactor * Math.min(this.maxTracking, Math.abs(this.tracking)));
      var color = this.colorTable[trackingIndex];
      return {
        'background-color' : color,
        'width' : this.calcPosition(this.actual_position)
      };
    },
    beforeContent : function() {
      return (this.actual_position < 0 - this.slack) ? '<<' : '';
    },
    afterContent : function() {
      return (this.actual_position > 1 + this.slack) ? '>>' : '';
    },
    isRunning: function() {
      return this.repetition > 0;
    },
    isStationary: function() {
      return this.repetition < 0;
    }
  }, // computed
  mounted: function() {
    this.colorTable = [];
    // Compute the colorTable using colorTableSize and trackingIndexFactor
    this.maxTracking = this.colorScheme[this.colorScheme.length - 1].tracking;
    this.trackingIndexFactor = this.colorTableSize / this.maxTracking;
    for (var trackingIndex = 0; trackingIndex <= this.colorTableSize; ++trackingIndex) {
      this.colorTable[trackingIndex] = this.trackingColor(trackingIndex / this.trackingIndexFactor, this.colorScheme);
    }
  }
}