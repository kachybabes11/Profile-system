import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import dotenv from "dotenv";
dotenv.config();

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_REDIRECT_URL,
    },
    (accessToken, refreshToken, profile, done) => {
      const username = profile.username;

      const role =
        username === "kachybabes11" ? "admin" : "analyst";

      return done(null, {
        username,
        role,
      });
    }
  )
);

export default passport;