import moment from "moment";
/**
 * Create Method configuration
 */
const find = {
  callback: async function (req) {
    const role = req.user.role.toLowerCase();
    const services = (
      await this.service("service").find({ from: -1})
    ).data;
    let serviceCount = {
      today: 0,
      outstanding: 0,
      total : 0
    };
    services.forEach(({ jobStatus, assignedTo,createdBy }) => {      
      if (
        role !== "admin" &&
        !(createdBy === req.user.uid ||
          (assignedTo || []).indexOf(req.user.uid) !== -1)
      ) {
        return;
      }
      if(jobStatus!== 'Cancelled'){
        serviceCount.total++;
      }      
      serviceCount[jobStatus] = serviceCount[jobStatus] || 0;
      serviceCount[jobStatus] = serviceCount[jobStatus] + 1;
    });
    return {
      ...(role === "admin"
        ? {
            users: (await this.service("users").find({ from: -1 }))
              .total,
            customers: (
              await this.service("customer").find({ from: -1 })
            ).total,
          }
        : {}),
      service: serviceCount,
    };
  },
};

export default {
    security: true,
    additionalPaths: {
        "stats": find
    },
    disableNotDefinedMethods: true
};
