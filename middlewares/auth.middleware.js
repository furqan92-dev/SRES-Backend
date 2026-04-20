import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : null;
  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    req.user = user;
    next();
  })
}

const authMiddleware = verifyToken;
export default authMiddleware;