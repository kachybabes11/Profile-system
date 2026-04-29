import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/token.js";

export const githubCallback = (req, res) => {
  const user = req.user;

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // WEB (cookie-based auth)
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: false,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: false,
  });

  // CLI / API response
  res.json({
    user,
    accessToken,
    refreshToken,
  });
};