sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"assetmanagement/department/test/integration/pages/DepartmentSrvList.gen",
	"assetmanagement/department/test/integration/pages/DepartmentSrvObjectPage.gen"
], function (JourneyRunner, DepartmentSrvListGenerated, DepartmentSrvObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('assetmanagement/department') + '/test/flp.html#app-preview',
        pages: {
			onTheDepartmentSrvListGenerated: DepartmentSrvListGenerated,
			onTheDepartmentSrvObjectPageGenerated: DepartmentSrvObjectPageGenerated
        },
        async: true
    });

    return runner;
});

