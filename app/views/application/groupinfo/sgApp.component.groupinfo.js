/* jshint node: true */

'use strict';

/**
 * @ngdoc overview
 * @name groupInfoComponent
 * @description
 * Plan select component of the Small Group Application app.
 */

import angular from 'angular';
import groupInfoTemplate from './groupinfo.html';
import sgAppRoot from '../../../root/sgApp.component.root';
const domesticPartnerORTooltip = require('!html!./domestic_partner_or.html');
const _get = require('lodash/get');

export default angular
  .module(sgAppRoot.name)
  .component('groupInfoFormComponent', {
    templateUrl: groupInfoTemplate,
    bindings: {
      $router: '<'
    },
    require: {
      appCtrl: '^applicationComponent'
    },
    controller: GroupInfoFormCtrl
  });

/*@ngInject*/
function GroupInfoFormCtrl(GroupinfoComponentSvc, DataSvc, UtilsSvc, $scope, $log, ConstantsSvc, ApplicationSvc, CachingSvc, RulesSvc, $rootRouter, $rootScope, $sce, $timeout, STORAGE_KEYS) {
  const vm = this;
  let deregisterAppDataWatch;
  const bindingObj = { vm, GroupinfoComponentSvc, DataSvc, UtilsSvc, $scope, $log, ConstantsSvc, ApplicationSvc, CachingSvc, RulesSvc, $rootRouter, $rootScope, $sce, $timeout, STORAGE_KEYS };
  const maxLegalNameChars = _get(RulesSvc, 'rules.groupRules.employerLegalName.maxLength', 0);
  const empMinContribPctArr = _get(RulesSvc, 'rules.groupRules.medPremiumEmpContribution.minContribPct', '')
    .toString()
    .split('');
  const empMinContribDolString = _get(RulesSvc, 'rules.groupRules.medPremiumEmpContribution.minContribDol', '')
    .toString();
  const empMinContribCentsArr = empMinContribDolString.substring(empMinContribDolString.indexOf('.') + 1)
    .split('');

  GroupinfoComponentSvc.setOrResetEmployerContribs(vm);

  vm.minHoursRequired = _get(RulesSvc, 'rules.eligibilityRules.minHoursRequired', 0);
  vm.serUrl = ConstantsSvc.SER_URL;
  vm.quoteId = $rootRouter.currentInstruction.component.routeData.data.quoteId;

  /***************
   ** NAICS section
   ***************/

  vm.noNAICSResults = false;
  vm.searchingNAICS = false;

  //initial naics empty array, for use with dynamic typeahead ui-select
  vm.naicsList = [];

  vm.getNAICSCodes = (search) => {
    vm.noNAICSResults = false;
    // if (!search || (UtilsSvc.isNonEmptyString(search) && search.length < 3)) {
    //   return;
    // }
    if (search && angular.isString(search) && search.length > 2) {
      vm.searchingNAICS = true;
      DataSvc.getNAICSCodes(search)
        .then((response) => {
          vm.naicsList = response.naics;
          vm.noNAICSResults = angular.isArray(response.naics) && response.naics.length === 0;
        }, (rejection) => {
          $log.error('Failed to get NAICS codes: ' + angular.fromJson(rejection));
          vm.noNAICSResults = true;
        })
        .finally(() => {
          vm.searchingNAICS = false;
          $timeout(() => {
            vm.groupinfoform.groupcodes.naics.$setPristine();
          });
        });
    }
  };

  vm.setNAICSCode = (item, model) => {
    vm.selectedNAICS = item;
    vm.appCtrl.appdata.group.naicsCode = model;
  }

  vm.checkNAICSChanged = (isOpen) => {
    if (!isOpen) {
      vm.naicsList = []; //reset the list
      if (vm.groupinfoform.groupcodes.modified) {
        if (angular.isArray(vm.groupinfoform.groupcodes.modifiedModels) &&
          vm.groupinfoform.groupcodes.modifiedModels
          .filter((modelCtrl) => (/naics/i).test(modelCtrl.$name) &&
            angular.isObject(modelCtrl.$modelValue))
          .length > 0) {
          $log.debug('the NAICS code has changed');
        } else {
          $log.debug('nothing has changed with the NAICS code');
          GroupinfoComponentSvc.resetPristineStateOnNAICSSearch(vm);
        }
      }
    }
  };

  vm.checkDirtyState = (e) => {
    $log.debug(e);
    GroupinfoComponentSvc.resetPristineStateOnNAICSSearch(vm);
  };

  /**********************
   ** Eligibility section
   **********************/

  vm.eligibility = {}; //container for holding model values that persist to appdata on action

  vm.eligPeriodArray = [];
  vm.domesticPartnerTypes = ConstantsSvc.DOMESTIC_PARTNER_TYPES;
  vm.reportTypes = ConstantsSvc.REPORT_TYPES;
  vm.eligibleDaysPattern = /\d+/;

  //copy primary to billing address and name info

  //toggle reset of domestic partner type dropdown
  vm.onDpCoverageSelect = function() {
    $log.debug('triggered onDpCoverageSelect : ' + vm.appCtrl.appdata.domesticPartner);
    if ((vm.appCtrl.appdata.domesticPartner === 'N' || !vm.appCtrl.appdata.domesticPartner) && vm.appCtrl.groupOR) {
      vm.groupinfoform.eligibilityform.dpselect.$setPristine();
      vm.groupinfoform.eligibilityform.dpselect.$setUntouched();
    }
  };

  /**************************
   ** End Eligibility section
   **************************/

  /*************************
   ** Prior coverage section
   *************************/

  vm.priorcoverage = {}; //container for holding model values that persist to appdata on action

  /*****************************
   ** End Prior coverage section
   *****************************/
  //copy or update primary address
  vm.copyPrimaryAddress = () => {
    if (angular.isArray(vm.appCtrl.appdata.group.address)) {
      if (vm.primaryAddressSame) {
        const primAddrCopy = angular.copy(vm.appCtrl.appdata.group.address[0]);
        primAddrCopy.addressType = 'PRIM';
        vm.appCtrl.appdata.group.address[1] = primAddrCopy;
      } else {
        GroupinfoComponentSvc.clearPrimaryAddress(vm);
      }
    }
  };

  //copy or update primary address or contact to billing
  vm.copyBillingAddress = () => {
    if (angular.isArray(vm.appCtrl.appdata.group.address)) {
      if (vm.appCtrl.appdata.group.billingAddressSame) {
        vm.appCtrl.appdata.group.billingName = angular.copy(vm.appCtrl.appdata.group.employerLegalName);

        if (vm.ctrl.appCtrl.groupOR && vm.ctrl.appCtrl.effDate.getFullYear() !== 2016) {
          const primAddrCopy = angular.copy(vm.appCtrl.appdata.group.address[1]);
          primAddrCopy.addressType = 'BILL';
          vm.appCtrl.appdata.group.address[2] = primAddrCopy;
        } else {
          const primAddrCopy = angular.copy(vm.appCtrl.appdata.group.address[0]);
          primAddrCopy.addressType = 'BILL';
          vm.appCtrl.appdata.group.address[1] = primAddrCopy;
        }

      } else {
        GroupinfoComponentSvc.clearBillingAddress(vm);
      }
    }
  };

  vm.copyBillingContact = () => {
    if (angular.isArray(vm.appCtrl.appdata.group.contact)) {
      if (vm.appCtrl.appdata.group.billContactSame) {
        const primContactCopy = angular.copy(vm.appCtrl.appdata.group.contact[0]);
        primContactCopy.contactType = 'BILL';
        vm.appCtrl.appdata.group.contact[1] = primContactCopy;
      } else {
        GroupinfoComponentSvc.clearBillingContact(vm);
      }
    }
  };

  vm.phoneRegex = '\\(*\\d{3}[\\)-\\s]*\\d{3}[-\\s]*\\d{4}'; //TODO - work with masks/filters to refine this

  vm.groupinfo = {
    NAICS: {
      //the NAICS must be digits only, and the pattern enforces min and max length
      pattern: new RegExp('\\d{' + RulesSvc.rules.groupRules.NAICS.minLength + ',' + RulesSvc.rules.groupRules.NAICS.maxLength + '}')
    },
    maxLegalNameChars: maxLegalNameChars,
    legalNameRegex: '\\.{1, ' + maxLegalNameChars + '}',
    empMinContribPctRegex: '^(([' + empMinContribPctArr[0] + '-9][' + empMinContribPctArr[1] + '-9]|100)%?)$',
    //overly complex regex to set the lower limit of employer contrib, which is currently 1 cent (as of the time of writing this)
    empMinContribDolRegex: new RegExp('^\\$?([1-9]\\d{0,2}(,\\d{3})*(\\.\\d{2})?|[1-9]\\d*(\\.\\d{2})?|0?\\.' +
      '(?![0-' + empMinContribCentsArr[0] + '][0-' + (empMinContribCentsArr[1] - 1) + '])\\d{2})$'),
    noMinContribPctRegex: '((\\d{1,2}|100)%?|N\/A)',
    minContribPctVal: RulesSvc.rules.groupRules.medPremiumEmpContribution.minContribPct.toString(),
    minContribDolVal: UtilsSvc.toFixedTwo(RulesSvc.rules.groupRules.medPremiumEmpContribution.minContribDol),
    minContribPctBool: RulesSvc.rules.groupRules.medPremiumEmpContribution.minContribPct.toString() !== '0'
  }; //object for holding view-related values, must be here to access appCtrl values

  vm.resetContributions = () => {
    GroupinfoComponentSvc.setOrResetEmployerContribs(vm);
  };

  //vm values for governing dependent contribution values
  //to be initialized in onInit with computed props for medical and dental
  vm.allowFutureDependents = {};

  //set up tooltip for OR domestic partnership label (too long for a label)
  ConstantsSvc.TIPSOCONFIG = { width: 300 };
  vm.tipsoConfigDPOR = angular.extend(angular.copy(ConstantsSvc.TIPSOCONFIG), {
    content: domesticPartnerORTooltip
  });

  vm.$onInit = function() {
    $log.debug(vm);
    $log.debug('I am in the cobra component controller');

    const originalSave = vm.appCtrl.saveAppData;
    const originalNext = vm.appCtrl.next;
    const originalPrev = vm.appCtrl.prev;
    if (vm.appCtrl.statesArray) {
      const states = vm.appCtrl.statesArray;
      states.map(function(stateObj) {
        stateObj.available = true;
        return stateObj;
      });
    }


    deregisterAppDataWatch = $rootScope.$watchCollection(function() {
      return vm.appCtrl.appdata;
    }, function(newVal) {
      if (UtilsSvc.notNullOrEmptyObj(newVal)) {
        GroupinfoComponentSvc.updateEmployerContributions(vm, { set: true });
        //checkOtherPlans.call(bindingObj);
        GroupinfoComponentSvc.setComputedProps(vm);
        GroupinfoComponentSvc.checkHasOtherPlans(vm);
        GroupinfoComponentSvc.updateViewValues(vm);
        GroupinfoComponentSvc.restoreNAICS(vm);

        deregisterAppDataWatch();
        vm.appCtrl.setRouteReady();

        if (vm.hasSelectedMedPlans === true) {
          angular.forEach(ConstantsSvc.ELIGIBILITY_PERIODS, (value, key) => {
            if (!value.value.startsWith("NINETY_DAYS")) {
              vm.eligPeriodArray.push(value);
            }
          });
        } else {
          vm.eligPeriodArray = ConstantsSvc.ELIGIBILITY_PERIODS;
        }

        // Calling set-pristine on the main form and groupcodes subform after digest cycle.
        vm.appCtrl.resetPristineState();
      }
    });

    //override application controller's save to update values before save, then save on callback
    vm.appCtrl.saveAppData = (option) => {
      const callback = option && option.callback;
      const next = option && option.next;
      const prev = option && option.prev;
      CachingSvc.getNAICS(vm.appCtrl.appdata.group.naicsCode);
      if (callback || next || prev) {
        originalSave(option); //pass the option, which may contain the instruction to navigate
      } else {
        GroupinfoComponentSvc.updateEmployerContributions(vm, { save: true }, originalSave);
      }
    };

    //override application controller's navigate to update values before navigate, then save and navigate on callback
    vm.appCtrl.next = (option) => {
      const callback = option && option.callback;
      CachingSvc.getNAICS(vm.appCtrl.appdata.group.naicsCode);
      if (callback) {
        originalNext(option);
      } else {
        GroupinfoComponentSvc.updateEmployerContributions(vm, { save: true }, originalNext);
      }
    };

    vm.appCtrl.prev = (option) => {
      const callback = option && option.callback;
      if (callback) {
        originalPrev(option);
      } else {
        GroupinfoComponentSvc.updateEmployerContributions(vm, { save: true }, originalPrev);
      }
    };
  };
}

function eligArrSuccess(response) {
  this.vm.eligPeriodArray = response.data.eligPeriods; //TODO - misspelling will be fixed
}

function eligArrFailure(reason) {
  this.$log.debug(reason);
}
