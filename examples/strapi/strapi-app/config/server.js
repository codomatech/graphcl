module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  admin: {
    auth: {
      secret: env('ADMIN_JWT_SECRET', 'b6c4ee2b41e044b8643469c681082acc'),
    },
    apiToken: {
      enabled: true,
    },
  },
});
