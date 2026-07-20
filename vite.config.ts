import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset URLs — the same dist/ must work both at the site root
  // (https://<subdomain>.surething.host/) and under the owner-only preview
  // path (/api/websites/<id>/deployments/<id>/preview/).
  base: "./",
});
