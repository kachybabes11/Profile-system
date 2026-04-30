/*import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/token.js";


router.get(
  "/github/callback",
  passport.authenticate("github", {
    failureRedirect: `${process.env.FRONTEND_URL}/login`
  }),
  (req, res) => {

    const user = req.user;

    const role =
      user.username === "kachybabes11" ? "admin" : "analyst";

    const payload = {
      username: user.username,
      role
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store for WEB (cookie)
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      sameSite: "lax"
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax"
    });

    // redirect to frontend
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
); */