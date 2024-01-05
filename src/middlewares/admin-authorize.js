/**
 * Middleware to check if user is a admin
 * @param req
 * @param res
 * @param next
 * @returns {Promise.<void>}
 */
export default async function (req, res, next) {
  const { security } = req;
  //todo : Method Level Security also to be implemented
  if (security ) {
    try {
      const isAllowed = isUserAllowed(
        {
          ...req.security,
          roles: req.security.roles || req.security.role || [],
          permissions: req.security.permissions || [],
        },
        {
          permissions: req.user.permissions,
          role: req.user.role,
          //req
        }
      );
      if (!isAllowed) {
        throw this.createError("403", "You do not have access to "+req.apiKey+" API");
      }
    } catch (e) {
      console.error(e);
      next(e);
    }
  }
  next();
}

export function isUserAllowed(featureConfig, userConfig) {
  featureConfig = featureConfig || {};
  userConfig = userConfig || {};
  let {
    permissions: allowedPermissions,
    roles: allowedRoles,
    isAllowed,
    extraSecurityCheck,
  } = featureConfig;
  //console.debug({featureConfig,userConfig})
  const { permissions, role } = userConfig;
  if (isAllowed instanceof Function) {
    return isAllowed(featureConfig, userConfig);
  }
  let allowed = true;
  if (allowedPermissions instanceof Function) {
    allowedPermissions = allowedPermissions(permissions, role);
  }
  if (allowedRoles instanceof Function) {
    allowedRoles = allowedRoles(permissions, role);
  }
  if (role !== "admin") {
    if (typeof allowedRoles === "string") {
      allowedRoles = [allowedRoles];
    }
    if (allowedRoles && allowedRoles.length > 0) {
      allowed = allowed && allowedRoles.indexOf(role) !== -1;
    }
    if (allowedPermissions && allowedPermissions.length > 0) {
      allowed =
        allowed &&
        permissions &&
        permissions.length > 0 &&
        allowedPermissions.findIndex((key) => {
          return (
            permissions.findIndex((perm) => {
              return key.toUpperCase() === perm.toUpperCase();
            }) !== -1
          );
        }) !== -1;
    }
  }
  if (extraSecurityCheck && extraSecurityCheck instanceof Function) {
    allowed =
      allowed &&
      extraSecurityCheck(allowedPermissions, allowedRoles, permissions, role);
  }
  return allowed;
}
