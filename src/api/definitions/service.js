import Joi, { func } from "joi";
import {
  checkServiceKeyDuplicacy,
  checkValidKeyInServiceForMany,
  checkValidKeyInService,
} from "../helpers/common";

const createSchema = {
  key: Joi.string().required(),
  date: Joi.string().required(),
  corporateNumber: Joi.string().optional().allow("", null),
  customer: Joi.alternatives(
    Joi.string().required(),
    Joi.object()
      .keys({
        customerName: Joi.string().required(),
        address: Joi.string().required(),
        homeNumber: Joi.string().optional().allow("", null),
        key: Joi.string().required(),
        officeNumber: Joi.string().optional().allow("", null),
        email: Joi.string().optional().allow("", null),
        products: Joi.array().items(Joi.string().required()).optional(),
        createUser: Joi.boolean(),
      })
      .required()
  ).required(),
  saveCustomer: Joi.boolean(),
  productType: Joi.string().allow("", null), //.required(), //
  productBrand: Joi.string().optional(), //
  model: Joi.string().optional(), //
  serialNumber: Joi.string().optional(), //
  assignedTo: Joi.array().items(Joi.string().required()).optional(),
  discount: Joi.number().optional(),
  jobStatus: Joi.string().required(),
  sign: Joi.optional().allow("", null),
  faultReported: Joi.string().optional().allow("", null),
  faultDiagnosed: Joi.string().optional().allow("", null),
  serviceDetails: Joi.string().optional().allow("", null),
  repairCompletedDate: Joi.string().optional().allow("", null),
  parts: Joi.array().items(
    Joi.object().keys({
      partCost: Joi.number().required(),
      partKey: Joi.string().required(),
      partName: Joi.string().required(),
    })
  ).optional(),
  services: Joi.array().items(
    Joi.object().keys({
      key: Joi.string().required(),
      price: Joi.number().required(),
      title: Joi.string().required(),
    })
  ).optional(),
  labourTransportCosts: Joi.number().optional().allow("", null),
  generalRemarks: Joi.string().optional().allow("", null),
  attachment: Joi.array().items().allow(null),
};
const updateSchema = {
  sent: Joi.boolean(),
  jobNumber: Joi.string(),
  date: Joi.string(),
  corporateNumber: Joi.string().optional(),
  customer: Joi.alternatives(
    Joi.string().required(),
    Joi.object()
      .keys({
        customerName: Joi.string().required(),
        address: Joi.string().required(),
        homeNumber: Joi.string().optional().allow("", null),
        key: Joi.string().required(),
        officeNumber: Joi.string().optional().allow("", null),
        email: Joi.string().optional().allow("", null),
        products: Joi.array().items(Joi.string().required()),
      })
      .required()
  ),
  parts: Joi.array().items(
    Joi.object().keys({
      partKey: Joi.string().required(),
      partName: Joi.string().required(),
      partCost: Joi.number().required(),
    })
  ),
  services: Joi.array().items(
    Joi.object().keys({
      key: Joi.string().required(),
      title: Joi.string().required(),
      price: Joi.number().required(),
    })
  ),
  saveCustomer: Joi.boolean(),
  productType: Joi.string().allow("", null),
  productBrand: Joi.string(),
  model: Joi.string(),
  serialNumber: Joi.string(),
  assignedTo: Joi.array().items(Joi.string()),
  discount: Joi.number().optional(),
  jobStatus: Joi.string().optional(),
  sign: Joi.optional().allow("", null),
  faultReported: Joi.string().optional().allow("", null),
  faultDiagnosed: Joi.string().optional().allow("", null),
  serviceDetails: Joi.string().optional().allow("", null),
  repairCompletedDate: Joi.string().optional().allow("", null),
  partsUsed: Joi.string().optional().allow("", null),
  partsCosts: Joi.number().optional().allow("", null),
  labourTransportCosts: Joi.number().optional().allow("", null),
  generalRemarks: Joi.string().optional().allow("", null),
  attachment: Joi.array().items().allow(null),
};
const create = {
  validateSchema: createSchema,
  onBefore: async function (input, req) {
    const { customer, saveCustomer, assignedTo } = input;
    await checkServiceKeyDuplicacy.apply(this, ["service", input, "service"]);

    if (assignedTo && assignedTo.length) {
      const assignedUsers = await checkValidKeyInServiceForMany.apply(this, [
        "users",
        assignedTo,
      ]);
      req.assignedTo = assignedUsers;
    }

    if (typeof customer === "object" && saveCustomer) {
      const { key } = await this.service("customer").create(customer, req);
      input.customer = key;
    }
    input.generatedDate = new Date().toLocaleString();
  },
  onAfter: async function (output, input, req) {
    await this.firebaseAdmin.incrementValueAtLocation("/jobNumber");
    const { jobStatus, key } = output;

    if (jobStatus === "Completed") {
      await this.service("invoice").create({
        key,
      });
    }
    if (typeof output.customer === "string") {
      output.customer = await this.service("customer").get({
        id: output.customer,
      });
    }
    const costSummary = getServiceCostSummary(output);
    if (output.customer.email) {
      (async () => {
        try {
          const { value: invoiceLogo } = await this.service(
            "configuration"
          ).get({
            id: "INVOICELOGO",
          });
          await this.service("emails").create({
            to: output.customer.email,
            template: "ServiceCreate",
            data: {
              invoiceLogo,
              ...output,
              serviceKey: key,
              ...costSummary,
            },
          });
        } catch (e) {
          console.log("error while sending email for create job:" + e);
        }
      })();
    }
    (async () => {
      try {
        await Promise.all(
          (req.assignedTo || []).map(async (user) => {
            return this.service("emails").create({
              to: user.email,
              template: "ServiceAssigned",
              data: {
                assignedUser: {
                  displayName: user.displayName || "",
                },
                serviceKey: key,
                link: await this.helper("generateWebClientLink")("login"),
              },
            });
          })
        );
      } catch (e) {
        console.log("error while sending assignment email for create job:" + e);
      }
    })();
    (async () => {
      if (output.customer && output.customer.key) {
        try {
          await this.service("sms").create({
            to: output.customer.key,
            template: "ServiceCreate",
            data: {
              key,
              customerName: output.customer.customerName,
              ...costSummary,
            },
          });
        } catch (e) {
          console.log("error while creating sms for create job:" + e);
        }
      }
    })();
  },
  security: {
    permissions: ["SERVICE_CREATE", "MY-JOBS_CREATE"],
  },
};

async function checkJobAccess(req, id, permission) {
  if (
    req.user.role !== "admin" &&
    req.user.permissions.indexOf(permission) === -1
  ) {
    const job = await this.service("service").get({
      id,
    });
    if ((job.assignedTo || []).indexOf(req.user.uid) === -1) {
      throw {
        status: 403,
        message: "You don't have access to edit this job",
      };
    }
  }
}

const update = {
  validateSchema: updateSchema,
  onBefore: async function (input, req) {
    const { customer, saveCustomer, assignedTo } = input.data;
    !!req &&
      (await checkJobAccess.apply(this, [req, input.id, "SERVICE_EDIT"]));
    if (assignedTo && assignedTo.length) {
      const job = await this.service("service").get({
        id: input.id,
      });

      const assignedUsers = await checkValidKeyInServiceForMany.apply(this, [
        "users",
        assignedTo,
      ]);

      // Send Email to only those who werenot assigned Before
      req.assignedTo = assignedUsers.filter(({ uid }) => {
        return (job.assignedTo || []).indexOf(uid) === -1;
      });
    }
    if (typeof customer === "object" && saveCustomer) {
      const { key } = await this.service("customer").create(customer);
      input.customer = key;
    }
  },
  onAfter: async function (output, input, req) {
    let jobStatus;
    if (output.jobStatus) {
      jobStatus = output.jobStatus;
    }
    const { key } = output;
    //Only when first time status is changed, this should happen.
    if (input.data && input.data.jobStatus === "Completed") {
      this.service("invoice").create({
        key,
      });
    }
    const sendEmail = async () => {
      const service = await this.service("service").get({
        id: key,
      });
      if (typeof service.customer === "string") {
        try {
          service.customer = await this.service("customer").get({
            id: service.customer,
          });
        } catch (e) {
          console.log("error while geting the customer");
        }
      }

      const to = service.email || (service.customer && service.customer.email);
      const costSummary = getServiceCostSummary(service);
      if (to) {
        try {
          this.service("emails").create({
            to,
            template: "ServiceChange",
            data: {
              ...service,
              ...service.customer,
              serviceKey: key,
              ...(jobStatus && { jobStatus }),
              ...costSummary,
            },
          });
        } catch (e) {
          console.log("error while creating an email for customer details:", e);
        }
      }
      if (service.customer && service.customer.key) {
        try {
          this.service("sms").create({
            to: service.customer.key,
            template: "ServiceChange",
            data: {
              key,
              customer: service.customer.customerName,
              ...service,
              ...(jobStatus && { jobStatus }),
              ...costSummary,
            },
          });
        } catch (e) {
          console.log(
            "error while creating the sms for service change details:",
            e
          );
        }
      }
    };
    (async () => {
      try {
        await Promise.all(
          ((req && req.assignedTo) || []).map(async (user) => {
            return this.service("emails").create({
              to: user.email,
              template: "ServiceAssigned",
              data: {
                assignedUser: {
                  displayName: user.displayName || "",
                },
                serviceKey: key,
                link: await this.helper("generateWebClientLink")("login"),
              },
            });
          })
        );
      } catch (e) {
        console.log("error while sending assignment email for create job:" + e);
      }
    })();
    input.data.jobStatus && sendEmail();
  },
  security: {
    permissions: ["SERVICE_EDIT", "MY-JOBS_EDIT"],
  },
};

/**
 * To send the Job create email and message to the email and phone no if mentioned
 */
const send = {
  method: "POST",
  security: true,
  callback: async function (req) {
    await Joi.validate(
      { ...req.body, ...req.query },
      Joi.object().keys({
        email: Joi.string().required(),
        phoneNo: Joi.string(),
        id: Joi.string().required(),
      })
    );
    const { id } = req.query;
    const { email } = req.body;
    const service = await checkValidKeyInService.apply(this, ["service", id]);
    const { customer } = service;
    if (typeof customer === "string") {
      service.customer = await this.service("customer").get({
        id: customer,
      });
    }
    const costSummary = getServiceCostSummary(service);
    const sendEmail = async () => {
      const { value: invoiceLogo } = await this.service("configuration").get({
        id: "INVOICELOGO",
      });
      this.service("emails").create({
        to: email,
        template: "ServiceCreate",
        data: {
          ...service,
          serviceKey: id,
          invoiceLogo,
          ...costSummary,
        },
      });
      if (req.body.phoneNo) {
        try {
          this.service("sms").create({
            to: req.body.phoneNo,
            template: "ServiceCreate",
            data: {
              key: id,
              customerName: service.customer.customerName,
              ...costSummary,
            },
          });
        } catch (e) {
          console.log("error while creating sms", e);
        }
      }
    };
    sendEmail();
  },
};
/**
 * To get Job number in service Api
 */
const getJobNumber = {
  method: "GET",
  security: {
    permissions: ["SERVICE_CREATE", "MY-JOBS_CREATE"],
  },
  callback: async function () {
    const { type, value } = await this.service("configuration").get({
      id: "JOBNUMBERFORMAT",
    });
    let res = await this.firebaseAdmin.getRecord("/jobNumber");
    console.log({ res });
    res = (res || 0) + 1;
    if (type === "text") {
      const index = value.indexOf("X");
      return (
        value.substring(0, index) +
        res.toString().padStart(value.length - index, 0)
      );
    }
  },
};
export const customerFilter = function (item, uid) {
  const { customerKey } = item;
  return customerKey === uid;
};

export const engineerFilter = function (item, uid) {
  const { assignedTo } = item;
  return (assignedTo || []).indexOf(uid) !== -1;
};

export function getServiceCostSummary(service) {
  const { parts, services, labourTransportCosts, discount } = service;
  const totalPartsCost = (parts || []).reduce((sum, item) => {
    const { partCost } = item;
    return sum + parseFloat(partCost);
  }, 0);
  const totalServicesCost = (services || []).reduce((sum, item) => {
    const { price } = item;
    return sum + parseFloat(price);
  }, 0);
  const totalPartsAndServicesCost = parseFloat(
    (totalPartsCost + totalServicesCost).toFixed()
  );
  const total = parseFloat(
    (totalPartsAndServicesCost + (labourTransportCosts || 0)).toFixed(2)
  );
  const totalPayable = parseFloat((total - (discount || 0)).toFixed(2));
  return {
    totalPartsCost,
    totalServicesCost,
    totalPartsAndServicesCost,
    total,
    totalPayable,
    discount: discount || 0,
  };
}

const guestJob = {
  method: "POST",
  security: false,
  callback: async function (req, res) {
    await Joi.validate(
      { ...req.body },
      Joi.object().keys({
        name: Joi.string().required(),
        email: Joi.string().required(),
        phoneNumber: Joi.string(),
        address: Joi.string().required(),
        description: Joi.string().required(),
      })
    );
    console.log(await getJobNumber.callback.apply(this, []))
    const job = await this.service("service").create({
      customer: {
        customerName: req.body.name,
        key: req.body.phoneNumber,
        address: req.body.address,
        email: req.body.email,
      },
      key: await getJobNumber.callback.apply(this, []),
      jobStatus: "Pending",
      date : new Date().toISOString()
    });
    return job;
  },
};

export default {
  //security: {},
  create,
  update,
  find: {
    validateSchema: {
      role: Joi.string(),
      status: Joi.string(),
      current: Joi.boolean(),
    },
    security: {
      permissions: ["SERVICE_READ", "MY-JOBS_READ"],
    },
    onAfter : async function(output,input,req){
      if(output.data){
        output.data = await Promise.all(output.data.map(async (item)=>{
          item = {...item}
          if (item.assignedTo && item.assignedTo.length > 0) {
            try {
              item.assignedUsers = await checkValidKeyInServiceForMany.apply(
                this,
                ["users", item.assignedTo]
              );
            } catch (e) {
              console.error(
                "Error while populating users in service",
                item.assignedTo,e
              );
              item.assignedUsers = [];
            }
          }
          return item
        }))
      }

    }
  },
  get: {
    security: "admin", // User will not get it directly from api
  },
  additionalPaths: {
    send: send,
    getJobNumber,
    guestJob
  },
  remove: {
    onBeforeEach: async function (id, obj, req) {
      !!req && (await checkJobAccess.apply(this, [req, id, "SERVICE_REMOVE"]));
    },
    onAfterEach: async function (output, id) {
      try {
        //if(output.jobStatus === "Completed"){
        await this.service("invoice").remove({ id });
        //}
      } catch (e) {
        console.error("Error while removing invoice ", e);
      }
    },
    security: { permissions: ["SERVICE_REMOVE", "MY-JOBS_REMOVE"] },
  },
  indexingConfig: async function (input, req) {
    //const { role } = input || {};
    let preFilters = [];
    if (req) {
      const { uid, role } = req.user;
      if (role !== "admin") {
        /**
         * Current Jobs are requested, Customer will
         * have their jobs and others will have their assigned Jobs
         */
        if (req.query.current) {
          if (role === "CUSTOMER") {
            const {
              data: [customer],
            } = await this.service("customer").find({
              searchField: "userUid",
              search: uid,
            });
            const { key } = customer || {};
            preFilters.push(function (item) {
              return customerFilter(item, key);
            });
          } else {
            preFilters.push(function (item) {
              return engineerFilter(item, uid);
            });
          }
        } else {
          /**
           * All jobs are requested, Must have SERVICE_READ
           */
          if ((req.user.permissions || []).indexOf("SERVICE_READ") === -1) {
            throw {
              status: 403,
              message: "You only have access to your own jobs",
            };
          }
        }
      }
    }
    const preFilter = (item) => {
      let result = true;
      preFilters.forEach((fn) => {
        result = result && fn(item);
      });
      return result;
    };
    return {
      fields: [
        "assignedTo",
        "customerKey",
        "customerName",
        "monthYear",
        "phoneNumber",
        "jobStatus",
        "serialNumber",
        "corporateNumber",
        "key",
        "model",
        "customer",
        "homeNumber",
        "officeNumber",
        "year",
        "month",
      ],
      preFilter,
      populate: async function (output) {
        let { key, date } = output;

        if (!date) {
          date = new Date();
          JSON.stringify(date);
        }
        try {
          if (!output.customer) {
            output = {
              ...(await this.service("service").get({
                id: key,
              })),
              ...output,
            };
          }
          if (typeof output.customer !== "object") {
            const customer = await this.service("customer").get({
              id: output.customer,
            });
            output.customerKey = customer.key;
            delete customer.key;
            delete customer.createdAt;
            delete customer.updatedAt;
            output = {
              ...output,
              ...customer,
            };
          } else {
            output.customerKey = output.customer ? output.customer.key : undefined;
          }
          output.key = key;
          output.month = (new Date(date).getMonth() + 1).toString();
          output.year = new Date(date).getFullYear().toString();
          output.monthYear =
            (output.month < 10 ? "0" + output.month : output.month) +
            "/" +
            output.year;
          output.timestamp = new Date(date).getTime();
          output.phoneNumber = `${output.customerKey} ${
            output.homeNumber || ""
          } ${output.officeNumber || ""}`;
          return output;
        } catch (e) {
          console.log("Error while populating service - ", e);
        }
      },
    };
  },
  order: 2,
};
