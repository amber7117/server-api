import uuid from "uuid/v4";
export default function () {
  createAdminUser.apply(this, []);
  createRole.apply(this, []);
}
const permissions = {
  ENGINEER: [
    // {
    //   key: "SERVICE_MANAGE",
    //   description: "can manages Service Jobs",
    // },
  ],
};
export async function createAdminUser() {
  const adminEmail = this.config.admin.email;
  let adminUser = null;
  try {
    adminUser = await this.firebaseAdmin.getUserByEmail(adminEmail);
  } catch (e) {
    console.error("Admin User not found, Creating..");
  }
  if (!adminUser) {
    const { uid } = await this.firebaseAdmin.createLocalUser(
      this.config.admin.email,
      this.config.admin.password,
      {
        role: "admin",
      }
    );
    await this.firebaseAdmin.updateUser(uid, {
      emailVerified: true,
    });
  }
}
 
async function createPermissions() {
  const obj = await this.firebaseAdmin.getRecord("/roles");
  await Promise.all(
    Object.keys(obj).map(async (key) => {
      const { code } = obj[key];
      const array = permissions[code];
      if (array) {
        await Promise.all(
          array.map(async (item) => {
            const { key, description } = item;
            await createPermission.apply(this, [key, description]);
          })
        );
        await this.firebaseAdmin.updateRecord("/roles/" + key, {
          permissions: array.map((item) => item.key),
        });
      }
    })
  );
}

async function createPermission(key, description) {
  await this.firebaseAdmin.createRecord("/permission", {
    key,
    description,
  });
}

async function createRecord(code, index) {
  console.log(`Creating ${code} role as it does not exist`);
  await this.firebaseAdmin.createRecord("/roles", {
    key: uuid(),
    ...this.config.role[index],
  });
}

export async function createRole() {
  let role;
  let values = {
    CUSTOMER: 0,
    ENGINEER: 0,
  };
  try {
    role = await this.firebaseAdmin.getRecord("/roles");
  } catch (e) {
    console.log("No roles found");
  }

  if (role) {
    Object.values(role).forEach((element) => {
      values[element.code] = 1;
    });
  }

  if (values["CUSTOMER"] === 0) {
    await createRecord.apply(this, ["CUSTOMER", 1]);
  }
  if (values["ENGINEER"] === 0) {
    await createRecord.apply(this, ["ENGINEER", 2]);
  }
  //await createPermissions.apply(this, []);
}
