sap.ui.define([
    "sap/m/GenericTile",
    "sap/m/TileContent",
    "sap/m/NumericContent",
    "sap/m/Text",
    "sap/m/VBox",
    "sap/f/Card",
    "sap/f/cards/Header",
    "sap/ui/model/json/JSONModel",
    "./format"
], function (GenericTile, TileContent, NumericContent, Text, VBox, Card, CardHeader, JSONModel, format) {
    "use strict";

    const PALETTE = ["#0070F2", "#2CA05A", "#E76500", "#AA0808", "#7858FF", "#1DB1B1", "#CC00DC", "#798C77"];

    const requireModules = (names) => new Promise((resolve, reject) => sap.ui.require(names, (...m) => resolve(m), reject));

    let vizLoaded = null;
    const loadViz = function () {
        if (!vizLoaded) {
            vizLoaded = requireModules(["sap/ui/core/Lib"])
                .then(([Lib]) => Lib.load({ name: "sap.viz" }))
                .then(() => requireModules([
                    "sap/viz/ui5/controls/VizFrame",
                    "sap/viz/ui5/data/FlattenedDataset",
                    "sap/viz/ui5/controls/common/feeds/FeedItem"
                ]));
        }
        return vizLoaded;
    };

    return {
        /**
         * KPI tile
         * @param {{title:string, subtitle?:string, value:number, icon?:string, color?:string, unit?:string, press?:function}} o
         */
        kpi: function (o) {
            const tile = new GenericTile(Object.assign({
                header: o.title,
                subheader: o.subtitle || "",
                frameType: "OneByOne",
                tileContent: [new TileContent({
                    unit: o.unit || "",
                    footer: o.footer || "",
                    content: new NumericContent({
                        value: o.value === undefined || o.value === null ? "0" : String(o.value),
                        icon: o.icon,
                        valueColor: o.color || "Neutral",
                        withMargin: false,
                        animateTextChange: false
                    })
                })]
            }, o.press ? { press: o.press } : {})); // an undefined press handler breaks the tile
            tile.addStyleClass("amKpiTile");
            return tile;
        },

        /**
         * Card with a chart (sap.viz VizFrame).
         * @param {{title:string, subtitle?:string, type:string, rows:object[], measure?:string, measureLabel?:string, height?:string}} o
         * @returns {sap.f.Card}
         */
        chart: function (o) {
            const measure = o.measure || "count";
            const measureLabel = o.measureLabel || (measure === "amount" ? "Amount" : "Count");
            const content = new VBox({ width: "100%" });
            const card = new Card({
                width: "100%",
                header: new CardHeader({ title: o.title, subtitle: o.subtitle || "" }),
                content: content
            });
            card.addStyleClass("amCard");

            const rows = (o.rows || []).map((r) => Object.assign({}, r, {
                label: format.status(r.label),
                count: Number(r.count || 0),
                amount: Number(r.amount || 0)
            }));
            if (!rows.length) {
                content.addItem(new Text({ text: "No data available" }).addStyleClass("amEmptyText"));
                return card;
            }

            loadViz().then(([VizFrame, FlattenedDataset, FeedItem]) => {
                const pie = o.type === "donut" || o.type === "pie";
                const viz = new VizFrame({
                    vizType: o.type,
                    width: "100%",
                    height: o.height || "300px",
                    uiConfig: { applicationSet: "fiori" },
                    dataset: new FlattenedDataset({
                        dimensions: [{ name: "Label", value: "{label}" }],
                        measures: [{ name: measureLabel, value: "{" + measure + "}" }],
                        data: { path: "/rows" }
                    }),
                    feeds: [
                        new FeedItem({ uid: pie ? "size" : "valueAxis", type: "Measure", values: [measureLabel] }),
                        new FeedItem({ uid: pie ? "color" : "categoryAxis", type: "Dimension", values: ["Label"] })
                    ],
                    vizProperties: {
                        title: { visible: false },
                        legend: { visible: pie },
                        legendGroup: { layout: { position: "bottom" } },
                        plotArea: {
                            colorPalette: PALETTE,
                            dataLabel: { visible: true },
                            drawingEffect: "normal"
                        },
                        valueAxis: { title: { visible: false } },
                        categoryAxis: { title: { visible: false } },
                        interaction: { selectability: { mode: "NONE" } }
                    }
                });
                viz.setModel(new JSONModel({ rows: rows }));
                content.addItem(viz);
            }).catch((error) => {
                content.addItem(new Text({ text: "Chart could not be loaded: " + error.message }).addStyleClass("amEmptyText"));
            });
            return card;
        }
    };
});
