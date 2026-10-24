sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"employee/test/integration/pages/EmployeeSrvList.gen",
	"employee/test/integration/pages/EmployeeSrvObjectPage.gen"
], function (JourneyRunner, EmployeeSrvListGenerated, EmployeeSrvObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('employee') + '/test/flp.html#app-preview',
        pages: {
			onTheEmployeeSrvListGenerated: EmployeeSrvListGenerated,
			onTheEmployeeSrvObjectPageGenerated: EmployeeSrvObjectPageGenerated
        },
        async: true
    });

    return runner;
});

