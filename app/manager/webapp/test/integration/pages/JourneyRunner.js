sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"manager/test/integration/pages/ManagerSrvList.gen",
	"manager/test/integration/pages/ManagerSrvObjectPage.gen"
], function (JourneyRunner, ManagerSrvListGenerated, ManagerSrvObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('manager') + '/test/flp.html#app-preview',
        pages: {
			onTheManagerSrvListGenerated: ManagerSrvListGenerated,
			onTheManagerSrvObjectPageGenerated: ManagerSrvObjectPageGenerated
        },
        async: true
    });

    return runner;
});

