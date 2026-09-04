import jwt from "jsonwebtoken";

export function requireAuth(...allowedRoles) {
  return (req, res, next) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith("Bearer ")) throw new Error("Missing token");
      req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET_KEY);
      if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: "You do not have permission to perform this action." });
      }
      next();
    } catch {
      return res.status(401).json({ message: "Invalid or expired authentication token." });
    }
  };
}
