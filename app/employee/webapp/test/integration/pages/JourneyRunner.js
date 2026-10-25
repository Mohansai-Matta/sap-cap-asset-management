sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"assetmanagement/employee/test/integration/pages/EmployeeSrvList.gen",
	"assetmanagement/employee/test/integration/pages/EmployeeSrvObjectPage.gen"
], function (JourneyRunner, EmployeeSrvListGenerated, EmployeeSrvObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('assetmanagement/employee') + '/test/flp.html#app-preview',
        pages: {
			onTheEmployeeSrvListGenerated: EmployeeSrvListGenerated,
			onTheEmployeeSrvObjectPageGenerated: EmployeeSrvObjectPageGenerated
        },
        async: true
    });

    return runner;
});

