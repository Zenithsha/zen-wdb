module.exports = ({ env }) => ({
  // Make issued JWTs last 30 days so users stay signed in across browser
  // restarts and idle days. The frontend cookie max-age in lib/auth.ts is
  // set to the same 30-day window.
  'users-permissions': {
    config: {
      jwt: {
        expiresIn: env('JWT_EXPIRES_IN', '30d'),
      },
    },
  },
});
