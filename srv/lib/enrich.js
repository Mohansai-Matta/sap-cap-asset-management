const { db } = require('./common');

/** Fills the virtual 'assigned_on' of assets with the start date of their current ownership */
const addAssignedOn = async (assets, req) => {
    const columns = req?.query?.SELECT?.columns;
    const wanted = !columns || columns.some((c) => c === '*' || c.ref?.[0] === 'assigned_on');
    if (!wanted) return;
    const list = Array.isArray(assets) ? assets : assets ? [assets] : [];
    const ids = list.filter((a) => a.asset_id).map((a) => a.asset_id);
    if (!ids.length) return;
    const owned = await SELECT.from(db().AssetOwnerships).columns('asset_asset_id', 'start_date')
        .where({ asset_asset_id: { in: ids }, is_current: true });
    const byAsset = new Map(owned.map((o) => [o.asset_asset_id, o.start_date]));
    for (const a of list) a.assigned_on = byAsset.get(a.asset_id) ?? null;
};

module.exports = { addAssignedOn };
