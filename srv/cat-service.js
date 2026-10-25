const cds = require('@sap/cds');
const { dependentsOf, assertAssetDeletable, deleteAssetChildren } = require('./lib/common');
const ownership = require('./lib/ownership');
const { registerAudit } = require('./lib/audit');

module.exports = class CatalogService extends cds.ApplicationService {

    init() {

        const {
            Departments,
            Employees,
            Managers,
            Vendors,
            Assets,
            AssetCategories,
            AssetAssignmentHistory,
            MaintenanceRecords,
            ArchiveRecords
        } = cds.entities('asset.management');

        const {
            DepartmentSrv,
            EmployeeSrv,
            ManagerSrv,
            AssetSrv
        } = this.entities;

        /* =========================
           Helpers
        ========================= */

        // Rejects the request if a referenced record does not exist
        const assertExists = async (req, entity, key, value, label) => {
            if (value === undefined || value === null) return;
            const found = await SELECT.one.from(entity).columns(key).where({ [key]: value });
            if (!found) req.reject(400, `${label} '${value}' does not exist`);
        };

        // Rejects the request if other records still point to the record to be deleted
        const assertNoDependents = async (req, dependents, value, label) => {
            for (const { entity, fk, what } of dependents) {
                const used = await SELECT.one.from(entity).columns('1 as x').where({ [fk]: value });
                if (used) req.reject(409, `${label} '${value}' cannot be deleted because it is still referenced by ${what}`);
            }
        };

        // Removes undefined values so that UPDATE only touches the fields that were sent
        const defined = (obj) => Object.fromEntries(
            Object.entries(obj).filter(([, v]) => v !== undefined)
        );

        // Applies the model's @mandatory, @assert.format and @assert.range rules to action input,
        // as actions write to the database directly and bypass the generic input validation
        const assertValid = (req, entity, row, isCreate) => {
            const isEmpty = (v) => v === undefined || v === null || v === '';
            for (const [name, element] of Object.entries(entity.elements)) {
                if (element.key || element.isAssociation) continue;
                const value = row[name];

                if (element['@mandatory'] && (isCreate || name in row) && isEmpty(value)) {
                    req.reject(400, `Value for '${name}' is required`);
                }
                if (value === undefined || value === null) continue;

                const format = element['@assert.format'];
                if (format && !new RegExp(format).test(value)) {
                    req.reject(400, `Value '${value}' for '${name}' has an invalid format`);
                }

                const range = element['@assert.range'];
                if (range && element.enum) {
                    const allowed = Object.entries(element.enum).map(([key, e]) => e.val ?? key);
                    if (!allowed.includes(value)) {
                        req.reject(400, `Value '${value}' for '${name}' is not one of: ${allowed.join(', ')}`);
                    }
                } else if (Array.isArray(range)) {
                    const [min, max] = range.map((r) => (typeof r === 'number' ? r : undefined));
                    if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
                        req.reject(400, `Value '${value}' for '${name}' is out of range`);
                    }
                }
            }
        };

        const assertDateOrder = (req, from, to, message) => {
            if (from && to && new Date(to) < new Date(from)) req.reject(400, message);
        };

        /**
         * Registers Create<name>, Update<name> and Delete<name> actions
         * for one entity in a uniform way.
         */
        const registerCrudActions = (name, { entity, key, label, refs = [], toRow, dependents = [], validate, afterCreate, beforeDelete, create }) => {

            const checkRefs = async (req) => {
                for (const ref of refs) {
                    await assertExists(req, ref.entity, ref.key, req.data[ref.param], ref.label);
                }
            };

            this.on(`Create${name}`, create || (async (req) => {
                const id = req.data[key] || cds.utils.uuid();

                const existing = await SELECT.one.from(entity).columns(key).where({ [key]: id });
                if (existing) req.reject(409, `${label} '${id}' already exists`);

                await checkRefs(req);
                const row = { ...defined(toRow(req.data)), [key]: id };
                assertValid(req, entity, row, true);
                if (validate) await validate(req, row);

                await INSERT.into(entity).entries(row);
                if (afterCreate) await afterCreate(req, row);

                return SELECT.from(entity).where({ [key]: id });
            }));

            this.on(`Update${name}`, async (req) => {
                const id = req.data[key];
                if (!id) req.reject(400, `Parameter '${key}' is required`);

                const current = await SELECT.one.from(entity).where({ [key]: id });
                if (!current) req.reject(404, `${label} '${id}' not found`);

                await checkRefs(req);
                const changes = defined(toRow(req.data));
                assertValid(req, entity, changes, false);
                if (validate) await validate(req, { ...current, ...changes });

                if (Object.keys(changes).length) {
                    await UPDATE(entity).set(changes).where({ [key]: id });
                }
                return `${label} '${id}' updated successfully`;
            });

            this.on(`Delete${name}`, async (req) => {
                const id = req.data[key];
                if (!id) req.reject(400, `Parameter '${key}' is required`);

                await assertNoDependents(req, dependents, id, label);
                if (beforeDelete) await beforeDelete(req, id);

                const deleted = await DELETE.from(entity).where({ [key]: id });
                if (!deleted) req.reject(404, `${label} '${id}' not found`);

                return `${label} '${id}' deleted successfully`;
            });

            return { dependents, label, key };
        };

        /* =========================
           Validation rules
        ========================= */

        const validateAsset = (req, asset) => {
            assertDateOrder(req, asset.purchase_date, asset.warranty_expiry,
                'Warranty expiry must not be before the purchase date');
            assertDateOrder(req, asset.purchase_date, asset.first_distribution_date,
                'First distribution date must not be before the purchase date');
        };

        const assertUniqueAssetTag = async (req, asset) => {
            if (!asset.asset_tag) return;
            const other = await SELECT.one.from(Assets).columns('asset_id').where({ asset_tag: asset.asset_tag });
            if (other && other.asset_id !== asset.asset_id) {
                req.reject(409, `Asset tag '${asset.asset_tag}' is already used by another asset`);
            }
        };

        const validateMaintenance = (req, record) => {
            assertDateOrder(req, record.reported_date, record.completed_date,
                'Completed date must not be before the reported date');
        };

        /* =========================
           Department Actions
        ========================= */

        const department = registerCrudActions('Department', {
            entity: Departments,
            key: 'dept_id',
            label: 'Department',
            toRow: (d) => ({
                name: d.name,
                cost_center: d.cost_center
            }),
            dependents: dependentsOf('Departments')
        });

        /* =========================
           Employee Actions
        ========================= */

        const employee = registerCrudActions('Employee', {
            entity: Employees,
            key: 'employee_id',
            label: 'Employee',
            refs: [
                { param: 'dept_id', entity: Departments, key: 'dept_id', label: 'Department' },
                { param: 'manager_id', entity: Managers, key: 'manager_id', label: 'Manager' }
            ],
            toRow: (d) => ({
                full_name: d.full_name,
                email: d.email,
                phone: d.phone,
                location: d.location,
                designation: d.designation,
                status: d.status,
                department_dept_id: d.dept_id,
                manager_manager_id: d.manager_id
            }),
            dependents: dependentsOf('Employees')
        });

        /* =========================
           Manager Actions
        ========================= */

        const manager = registerCrudActions('Manager', {
            entity: Managers,
            key: 'manager_id',
            label: 'Manager',
            refs: [
                { param: 'employee_id', entity: Employees, key: 'employee_id', label: 'Employee' },
                { param: 'dept_id', entity: Departments, key: 'dept_id', label: 'Department' }
            ],
            toRow: (d) => ({
                full_name: d.full_name,
                email: d.email,
                phone: d.phone,
                employee_employee_id: d.employee_id,
                department_dept_id: d.dept_id
            }),
            dependents: dependentsOf('Managers')
        });

        /* =========================
           Vendor Actions
        ========================= */

        registerCrudActions('Vendor', {
            entity: Vendors,
            key: 'vendor_id',
            label: 'Vendor',
            refs: [
                { param: 'manager_id', entity: Managers, key: 'manager_id', label: 'Manager' }
            ],
            toRow: (d) => ({
                manager_manager_id: d.manager_id,
                name: d.name,
                email: d.email
            }),
            dependents: dependentsOf('Vendors')
        });

        /* =========================
           Asset Category Actions
        ========================= */

        registerCrudActions('AssetCategory', {
            entity: AssetCategories,
            key: 'asset_category_id',
            label: 'Asset category',
            toRow: (d) => ({
                name: d.name,
                lifespan_months: d.lifespan_months
            }),
            dependents: dependentsOf('AssetCategories')
        });

        /* =========================
           Asset Actions
        ========================= */

        registerCrudActions('Asset', {
            entity: Assets,
            key: 'asset_id',
            label: 'Asset',
            refs: [
                { param: 'category_id', entity: AssetCategories, key: 'asset_category_id', label: 'Asset category' },
                { param: 'vendor_id', entity: Vendors, key: 'vendor_id', label: 'Vendor' },
                { param: 'manager_id', entity: Managers, key: 'manager_id', label: 'Manager' },
                { param: 'employee_id', entity: Employees, key: 'employee_id', label: 'Employee' }
            ],
            toRow: (d) => ({
                asset_tag: d.asset_tag,
                name: d.name,
                serial_number: d.serial_number,
                category_asset_category_id: d.category_id,
                vendor_vendor_id: d.vendor_id,
                manager_manager_id: d.manager_id,
                model: d.model,
                purchase_date: d.purchase_date,
                purchase_cost: d.purchase_cost,
                currency_code: d.currency,
                warranty_expiry: d.warranty_expiry,
                first_distribution_date: d.first_distribution_date,
                condition: d.condition,
                location: d.location,
                // 'Assigned' (and the holder) are set by the ownership logic only - see afterCreate
                status: d.status === 'Assigned' ? undefined : d.status
            }),
            validate: async (req, row) => {
                if (req.event === 'UpdateAsset' && req.data.employee_id && req.data.employee_id !== row.current_holder_employee_id) {
                    req.reject(400, 'Use CreateOwnershipLedger (Assign / Transfer / Return) to change the holder of an asset');
                }
                validateAsset(req, row);
                await assertUniqueAssetTag(req, row);
            },
            afterCreate: async (req, row) => {
                if (req.data.employee_id) {
                    await ownership.assign(req, { asset_id: row.asset_id, employee_id: req.data.employee_id, start_date: req.data.first_distribution_date });
                }
            },
            beforeDelete: async (req, id) => {
                await assertAssetDeletable(req, id);
                await deleteAssetChildren(id);
            }
        });

        /* =========================
           Ownership Ledger Actions
        ========================= */

        // New ledger entries go through the ownership logic, which keeps asset, ownership and history in sync
        const createLedgerEntry = async (req) => {
            const d = req.data;
            const recorded = { notes: d.notes, recorded_by: d.manager_id };
            if (d.action === 'Assign') {
                await ownership.assign(req, { ...recorded, asset_id: d.asset_id, employee_id: d.to_employee_id, start_date: d.transition_date });
            } else if (d.action === 'Transfer') {
                await ownership.transfer(req, { ...recorded, asset_id: d.asset_id, to_employee_id: d.to_employee_id, transfer_date: d.transition_date });
            } else if (d.action === 'Return') {
                await ownership.returnAsset(req, { ...recorded, asset_id: d.asset_id, return_date: d.transition_date });
            } else {
                req.reject(400, "Parameter 'action' must be one of: Assign, Transfer, Return");
            }
            return SELECT.from(AssetAssignmentHistory).where({ asset_asset_id: d.asset_id })
                .orderBy('createdAt desc', 'transition_date desc').limit(1);
        };

        registerCrudActions('OwnershipLedger', {
            entity: AssetAssignmentHistory,
            key: 'ledger_id',
            label: 'Ownership ledger entry',
            refs: [
                { param: 'asset_id', entity: Assets, key: 'asset_id', label: 'Asset' },
                { param: 'from_employee_id', entity: Employees, key: 'employee_id', label: 'Employee' },
                { param: 'to_employee_id', entity: Employees, key: 'employee_id', label: 'Employee' },
                { param: 'manager_id', entity: Managers, key: 'manager_id', label: 'Manager' }
            ],
            toRow: (d) => ({
                asset_asset_id: d.asset_id,
                from_employee_employee_id: d.from_employee_id,
                to_employee_employee_id: d.to_employee_id,
                action: d.action,
                transition_date: d.transition_date,
                recorded_by_manager_id: d.manager_id,
                notes: d.notes,
                created_at: d.created_at
            }),
            create: createLedgerEntry
        });

        /* =========================
           Fiori (draft) handlers
        ========================= */

        // Same referential checks for deletions triggered from the Fiori apps
        for (const [srvEntity, crud] of [
            [DepartmentSrv, department],
            [EmployeeSrv, employee],
            [ManagerSrv, manager]
        ]) {
            this.before('DELETE', srvEntity, (req) =>
                assertNoDependents(req, crud.dependents, req.data[crud.key], crud.label)
            );
        }

        this.before('DELETE', AssetSrv, async (req) => {
            await assertAssetDeletable(req, req.data.asset_id);
            await deleteAssetChildren(req.data.asset_id);
        });

        this.before(['CREATE', 'UPDATE'], AssetSrv, async (req) => {
            const before = req.event === 'UPDATE'
                ? await SELECT.one.from(Assets).columns('current_holder_employee_id').where({ asset_id: req.data.asset_id })
                : null;
            if (req.data.status === 'Assigned' && !before?.current_holder_employee_id) {
                req.reject(400, "Status 'Assigned' is set automatically when the asset is assigned to an employee");
            }
            validateAsset(req, req.data);
            await assertUniqueAssetTag(req, req.data);
            for (const m of req.data.maintenance_records ?? []) validateMaintenance(req, m);
        });

        this.before(['CREATE', 'UPDATE'], 'MaintenanceRecordSrv', (req) => validateMaintenance(req, req.data));

        registerAudit(this);
        return super.init();
    }
};
