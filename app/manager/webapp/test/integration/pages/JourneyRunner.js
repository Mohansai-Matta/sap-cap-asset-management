sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"assetmanagement/manager/test/integration/pages/ManagerSrvList.gen",
	"assetmanagement/manager/test/integration/pages/ManagerSrvObjectPage.gen"
], function (JourneyRunner, ManagerSrvListGenerated, ManagerSrvObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('assetmanagement/manager') + '/test/flp.html#app-preview',
        pages: {
			onTheManagerSrvListGenerated: ManagerSrvListGenerated,
			onTheManagerSrvObjectPageGenerated: ManagerSrvObjectPageGenerated
        },
        async: true
    });

    return runner;
});

