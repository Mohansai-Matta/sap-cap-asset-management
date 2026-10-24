const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {

    const {
    DepartmentSrv,
    EmployeeSrv,
    ManagerSrv,
    VendorSrv,
    AssetSrv,
    AssetCategorySrv,
    OwnershipLedgerSrv
    } = this.entities;
    /* =========================
       Department Actions
    ========================= */

    this.on('CreateDepartment', async (req) => {

        const data = {
            dept_id: req.data.dept_id,
            name: req.data.name,
            cost_center: req.data.cost_center
        };

        const tx = cds.transaction(req);

        await tx.run(
            INSERT.into(DepartmentSrv).entries(data)
        );

        return req.data;
    });
    this.on('UpdateDepartment', async (req) => {

    const tx = cds.transaction(req);

    const result = await tx.run(
        UPDATE(DepartmentSrv)
            .set({
                name: req.data.name,
                cost_center: req.data.cost_center
            })
            .where({
                dept_id: req.data.dept_id
            })
    );

    return result;
    });

    this.on('DeleteDepartment', async (req) => {

    const tx = cds.transaction(req);

    const result = await tx.run(
        DELETE.from(DepartmentSrv)
            .where({
                dept_id: req.data.dept_id
            })
    );

    return result;
    });

    //CreateEmoloyee
    this.on('CreateEmployee', async (req) => {

    const tx = cds.transaction(req);

    const department = await tx.run(
        SELECT.one.from(DepartmentSrv)
            .where({ dept_id: req.data.dept_id })
    );

    if (!department) {
        req.error(400, 'Department does not exist');
    }

    const data = {
        employee_id: req.data.employee_id,
        full_name: req.data.full_name,
        email: req.data.email,
        phone: req.data.phone,
        location: req.data.location,
        status: req.data.status,
        department_dept_id: req.data.dept_id
    };

    
    const result = await tx.run(
        INSERT.into(EmployeeSrv).entries(data)
    );

    return req.data
    
    });

    this.on('UpdateEmployee', async (req) => {

    const tx = cds.transaction(req);

    const result = await tx.run(
        UPDATE(EmployeeSrv)
            .set({
                full_name: req.data.full_name,
                email: req.data.email,
                phone: req.data.phone,
                location: req.data.location,
                status: req.data.status,
                department_dept_id: req.data.dept_id
            })
            .where({
                employee_id: req.data.employee_id
            })
    );

    return result;
    });

    this.on('DeleteEmployee', async (req) => {

    const tx = cds.transaction(req);

    const result = await tx.run(
        DELETE.from(EmployeeSrv)
            .where({
                employee_id: req.data.employee_id
            })
    );

    return result;
    });

    // Create Manager
   this.on('CreateManager', async (req) => {

    const tx = cds.transaction(req);

    const employee = await tx.run(
        SELECT.one.from(EmployeeSrv)
            .where({
                employee_id: req.data.employee_id
            })
    );

    if (!employee) {
        req.error(400, 'Employee does not exist');
    }

    const department = await tx.run(
        SELECT.one.from(DepartmentSrv)
            .where({
                dept_id: req.data.dept_id
            })
    );

    if (!department) {
        req.error(400, 'Department does not exist');
    }

    const data = {
        manager_id: req.data.manager_id,
        full_name: req.data.full_name,
        email: req.data.email,
        phone: req.data.phone,
        employee_employee_id: req.data.employee_id,
        department_dept_id: req.data.dept_id
    };

    const result = await tx.run(
        INSERT.into(ManagerSrv).entries(data)
    );

    return [data];
    });


    this.on('UpdateManager', async (req) => {

    const tx = cds.transaction(req);

    const result = await tx.run(
        UPDATE(ManagerSrv)
            .set({
                full_name: req.data.full_name,
                email: req.data.email,
                phone: req.data.phone,
                employee_employee_id: req.data.employee_id,
                department_dept_id: req.data.dept_id
            })
            .where({
                manager_id: req.data.manager_id
            })
    );

    return result;
    });

   this.on('DeleteManager', async (req) => {

    const tx = cds.transaction(req);

    const result = await tx.run(
        DELETE.from(ManagerSrv)
            .where({
                manager_id: req.data.manager_id
            })
    );

    return result;
    });

    //Create AssetCategory

    this.on('CreateAssetCategory', async (req) => {

    const data = {
        asset_category_id: req.data.asset_category_id,
        name: req.data.name,
        lifespan_months: req.data.lifespan_months
    };

    const tx = cds.transaction(req);

    const result = await tx.run(
        INSERT.into(AssetCategorySrv).entries(data)
    );

    return [data];
    });

    //vendor

    this.on('CreateVendor', async (req) => {

    const tx = cds.transaction(req);

    const manager = await tx.run(
        SELECT.one.from(ManagerSrv)
            .where({
                manager_id: req.data.manager_id
            })
    );

    if (!manager) {
        req.error(400, 'Manager does not exist');
    }

    const data = {
        vendor_id: req.data.vendor_id,
        manager_manager_id: req.data.manager_id,
        name: req.data.name,
        email: req.data.email
    };

    const result = await tx.run(
        INSERT.into(VendorSrv).entries(data)
    );

    return [data];
    });

})