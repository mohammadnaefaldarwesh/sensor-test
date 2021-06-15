fit20.components.alphabetscroll = {
  template: `
    <div class="scroll-bar">
      <span :class="{ inactive : !scrollToItems[char] }" class="badge badge-info" v-for="char in alphabet" @click="clickChar(char)">{{ char }}</span>
    </div>
  `,
  props: ['list', 'itemToName'],
  methods: {
    clickChar: function(char) {
      if(this.scrollToItems[char]){
        this.$emit('scrollTo', this.scrollToItems[char]);
      };
    }
  },
  computed: {
    alphabet: function() {
       // return Object.keys(this.scrollToItems);
     return "abcdefghijklmnopqrstuvwxyz".toUpperCase().split("");
    },
    scrollToItems: function() {
      var items = {};
      var itemToName = this.itemToName;
       if(this.list) {
		   this.list.forEach(function(item, index){
	          var name = itemToName(item) || '';
	          var firstLetter = name.charAt(0).toUpperCase();
	          if(!items[firstLetter]) {
	            items[firstLetter] = item;
	          }
	       });
       }
      return items;
    }
  }
};