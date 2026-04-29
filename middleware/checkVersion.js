export function checkApiVersion(req, res, next) {
  const version = req.headers["x-api-version"];
  
    console.log("HEADERS RECEIVED:", req.headers);

  if (!version) {
    return res.status(400).json({
      status: "error",
      message: "API version header required"
    });
  }

  next();
}