fit20.components.helpdocs = {
  template: `
    <article>
      <section class="my-2 helpdocs" v-if="!showingDocument">
        <div class="container-fluid scrollable">
          <div class="row card-gutters">
            <div v-for="question in questions" v-if="isAvailable(question)"
                :title="question.document_id"
                class="col-6"
            >
              <div class="card card-body h4" @click="openHelpDoc(question)">
                {{ question[language] }}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section class="my-2 d-flex" v-if="showingDocument">
        <div style="width: 100% !important; min-height: 100% !important; display: flex; flex-direction: column; -webkit-overflow-scrolling:touch; overflow: auto;">
          <h4>
            <button type="button" class="btn btn-danger mb-1 mr-1 float-right" aria-label="Close" @click="closeHelpDoc">
              <span aria-hidden="true" class="close">&times;</span>
            </button>
            <span>{{ helpDocTitle }}</span>
          </h4>
          <iframe id="helpDocIframe" :src="helpDocUrl" style="width:100%!important; overflow:scroll!important; flex: 1 1 auto;">Please wait</iframe>
        </div>
      </section>
    </article>
  `,
  data: function() { return {
    questions: [], // [ {document_id, nl, ...} ]
    helpDocTitle: '',
    helpDocUrl: '',
    showingDocument: false,
    // The indexTsvUrl below does not work. It always gives 401 Unauthorized.
    //indexTsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSmoIm4VQlVJUDBz_TCepXSymEycsiPJFtPoasJH426SnFzQjBYSnQaDEKmfl9sSFScX-koPil7gY35/pub?gid=0&single=true&output=tsv',
    // Use src/main/webapp/index.tsv from the helpdocs project.
    indexTsvUrl: 'https://helpdocs-dot-fit20app-4-module.appspot.com/index.tsv'
  }},
  computed: {
    language : function() {
      return fit20.i18n.getLanguage();
    }
  },
  methods: {
    openHelpDoc: function(question) {
      this.helpDocTitle = question[this.language];
      this.helpDocUrl = question['url_'+this.language]+'?embedded=true';
      this.showingDocument = true;
    },
    closeHelpDoc: function() {
      this.showingDocument = false;
    },
    isAvailable: function(question) {
      return question[this.language] && question['url_'+this.language];
    }
  },
  mounted: function() {
    var scope = this;
    $.ajax(this.indexTsvUrl, {
      success: function(data, textStatus, jqXHR) {
        var lines = data.split(/\r?\n/);
        // The first line contains field names.
        var fields = lines[0].split(/\t/);
        fields[0] = 'document_id'; // just to make sure
        // Read through pairs of lines.
        for (var lnr = 1; lnr < lines.length; lnr += 2) {
          // First line contains questions.
          var question_items = lines[lnr].split(/\t/);
          var question = {};
          for (var i = 0; i < fields.length; ++i) {
            question[fields[i]] = question_items[i];
          }
          // Second line contains answer documents.
          var answer_docs = lines[lnr+1].split(/\t/);
          for (var i = 1; i < fields.length; ++i) {
            question['url_'+fields[i]] = answer_docs[i];
          }
          // Push the question to the list.
          scope.questions.push(question);
        }
      },
      error: function(jqXHR, textStatus, error) {
        message = `Cannot get helpdocs index: ${textStatus} (${jqXHR.status}), ${error}`;
        scope.questions = [{}];
        scope.questions[0][scope.language] = message;
        scope.questions[0]['url_'+scope.language] = 'javascript:return';
        fit20.log("!! "+message);
      }
    });
  }
};
