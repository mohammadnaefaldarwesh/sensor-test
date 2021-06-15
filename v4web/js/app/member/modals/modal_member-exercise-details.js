/** Modal for the member exercise remarks */
fit20.components.memberexercisedetails = {
  template: `
    <modal v-if="exercise && machine">
      <template #title>{{ $t('M0801') }} {{ exercise.order }}: {{ machine ? machine.name : $t('M0038') }}</template>
            <div class="container-fluid">
              <div class="row">
              <table class="table w-100 table-stripe bg-secondary text-white table-bordered" style="border-radius:5px; border-color:white;">
                <tr>
                  <td>
                    <i class="fas fa-calendar-alt pr-1"></i>
                      {{ date | dateFormat('long') }}
                  </td>
                  <td class="text-right">
                    <i class="fas fa-balance-scale pr-1"></i>
                      {{ exercise.weight }} {{ machine ? machine.weightUnit : '' }}
                  </td>
                  <td class="text-right">
                    <i class="fas fa-stopwatch pr-1"></i>
                      {{ exercise.duration | showTime }}
                  </td>
                </tr>
              </table>
              </div>
            </div>
            <div class="mb-4 mt-2" v-if="exercise.qs_average > 0.0">
              <table class="w-100 text-center font-weight-bold">
                <tr style="height: 3em;">
                  <td colspan="2" rowspan="2"><img src="images/icon-award.svg" alt="" style="width:8em;"></td>
                  <td><img src="images/icon-tempo.svg" alt="" style="width:4em;"></td>
                  <td class="font-weight-bold">{{ $t('M0902') }}</td>
                  <td class="text-danger">{{ exercise.qs_tempo | round }}</td>
                </tr>
                <tr style="height: 3em;">
                  <td><img src="images/icon-rhythm.svg" alt="" style="width:4em;"></td>
                  <td class="font-weight-bold">{{ $t('M0903') }}</td>
                  <td class="text-info">{{ exercise.qs_rhythm | round }}</td>
                </tr>
                <tr style="height: 3em;">
                  <td colspan="2" class="font-weight-bold text-primary h2">{{ exercise.qs_average | round }}</td>
                  <td><img src="images/icon-range.svg" alt="" style="width:4em;"></td>
                  <td class="font-weight-bold">{{ $t('M0904') }}</td>
                  <td class="text-emphasis">{{ exercise.qs_range | round }}</td>
                </tr>
              </table>
            </div>
            <hr v-if="exercise.remark">
            <div class="container-fluid" v-if="exercise.remark">
              <h5 class="modal-title">{{ $t('M0815') }}</h5>
              <div class="row">
                <div class="col-12">
                  {{ exercise.remark }}
                </div><!-- col -->
              </div><!-- row -->
            </div><!-- container-fluid -->
      <template #controls>
      </template>
    </modal>
  `,
  props: ['machine', 'exercise', 'date']
};