fit20.components.makephoto = {
  'template': `
    <div class="form-group row">
      <div class="col-6 mb-4 text-center">
        <img :src="photoURI" :id="photoId" alt="" class="editPhotoSize">
      </div>
      <div class="col-6 mb-4">
        <!-- new image -->
        <img :id="newPhotoId" alt="" class="editPhotoSize" v-show="fileSelected"></img>
      </div>
      <div class="col-6 text-left">
        <div class="btn btn-emphasis inputFileHidden">
          {{ $t('M0334') }}
          <input :id="inputId"
               name="image"
               type="file"
               class="form-control"
               accept="image/*"
               capture="camera"
               @change="selectFile"
    		  >
        </div>
      </div>
      <div class="col-6 text-right">
        <button type="button" class="btn btn-primary" v-if="fileSelected"
          @click="putPhoto()" :data-dismiss="doDismiss">{{ $t('M0028') }}</button>
        <button type="button" class="btn btn-secondary" v-if="embedded && fileSelected"
          @click="forgetPhoto()" :data-dismiss="doDismiss">{{ $t('M0025') }}</button>
      </div>
    </div><!-- end of form-group -->
  `,
  // The subject must have id, photoURI, photoPostURI and thumbnail properties.
  // When embedded, the form buttons will not close the containing modal.
  props: ['subject', 'callback', 'embedded'],
  data: function() {
    return {
      file: undefined
    }
  },
  methods: {
    selectFile: function() {
      var my = this;
      // Read the new image data and dispay in the new photo image.
      var reader = new FileReader();
      reader.onload = function (e) {
        $('#'+my.newPhotoId).attr('src', e.target.result);
      };
      this.file = $('#'+this.inputId)[0].files[0];
      reader.readAsDataURL(this.file);
    },
    putPhoto: function() {
      var my = this;
      // Post the new image data to the server.
      var formData = new FormData();
      formData.append('image', my.file);
      fit20.callAJAX(fit20.app.addAccessTokenNoCache(this.subject.photoPostURI),
        {
          type: 'POST',
          contentType: false,
          data: formData,
          processData: false,
          cache: false,
          success: function(data, textStatus, jqXHR) {
            // Make the new photo the actual photo.
            $('#'+my.photoId).attr('src', my.photoURI);
            // No new photo
            my.file = undefined;
            // Execute the callback.
            if (my.callback) my.callback();
          },
          error: function(jqXHR, textStatus, error) {
            var message = $t('M9590')+" ("+textStatus+") "+$t(error);
            fit20.app.addAlert('error', message);
            fit20.log("!! "+message);
          }
        }
      )
    }, // putPhoto
    forgetPhoto: function() {
      this.file = undefined;
    }
  }, // methods
  computed: {
    photoId: function() {
      return isEmpty(this.subject) ? '_photo-image' : this.subject.id+'_photo-image'
    },
    newPhotoId: function() {
      return isEmpty(this.subject) ? '_new-photo-image' : this.subject.id+'_new-photo-image'
    },
    inputId: function() {
      return isEmpty(this.subject) ? '_make-photo-image' : this.subject.id+'_make-photo-image'
    },
    thumbnail: function() {
      return isEmpty(this.subject) ? '' : this.subject.thumbnail;
    },
    photoURI: function() {
      return isEmpty(this.subject) ? '' : fit20.app.addAccessTokenNoCache(this.subject.photoURI);
    },
    fileSelected: function() {
      return isDefined(this.file);
    },
    doDismiss: function() {
      return this.embedded ? null : 'modal'
    }
  }
};
