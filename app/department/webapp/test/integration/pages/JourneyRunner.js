sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"department/test/integration/pages/DepartmentSrvList.gen",
	"department/test/integration/pages/DepartmentSrvObjectPage.gen"
], function (JourneyRunner, DepartmentSrvListGenerated, DepartmentSrvObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('department') + '/test/flp.html#app-preview',
        pages: {
			onTheDepartmentSrvListGenerated: DepartmentSrvListGenerated,
			onTheDepartmentSrvObjectPageGenerated: DepartmentSrvObjectPageGenerated
        },
        async: true
    });

    return runner;
});

